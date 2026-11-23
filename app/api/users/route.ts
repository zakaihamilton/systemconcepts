import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { isValidNewPassword } from "@util/auth/passwordPolicy";
import { perministerAuthEnabled } from "@util/auth/perminister";
import { assertSameOrigin } from "@util/auth/requestSecurity";
import { roleAuth } from "@util/auth/roles";
import {
	getAuthErrorStatus,
	getSessionUser,
	revokeAllSessions,
} from "@util/auth/session";
import { getS3 } from "@util/storage/aws";
import { findRecord, getCollection, handleRequest } from "@util/storage/mongo";
import { hash as bcryptHash } from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const collectionName = "users";

async function deleteUserData(userId: string) {
	const id = userId.trim().toLowerCase();
	if (!/^[a-z0-9._-]{1,254}$/.test(id) || id.includes("..")) {
		throw "INVALID_USER_ID";
	}

	const personalCollection = await getCollection({
		collectionName: `fs_${id}`,
	});
	await personalCollection.deleteMany({});

	const bucket = process.env.AWS_BUCKET;
	if (bucket) {
		const s3 = await getS3({});
		const prefix = `personal/${id}/`;
		const objectsToDelete: { Key: string }[] = [];
		let continuationToken: string | undefined;
		do {
			const page = await s3.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				}),
			);
			for (const item of page.Contents ?? []) {
				const key = item.Key;
				if (typeof key === "string" && key.startsWith(prefix)) {
					objectsToDelete.push({ Key: key });
				}
			}
			continuationToken = page.NextContinuationToken;
		} while (continuationToken);

		for (let offset = 0; offset < objectsToDelete.length; offset += 1000) {
			const deleted = await s3.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: {
						Objects: objectsToDelete.slice(offset, offset + 1000),
						Quiet: true,
					},
				}),
			);
			if (deleted.Errors?.length) {
				throw new Error("PERSONAL_STORAGE_CLEANUP_FAILED");
			}
		}

		await s3.send(
			new DeleteObjectCommand({ Bucket: bucket, Key: `personal/${id}` }),
		);
	}

	await revokeAllSessions(id);
}

async function handleUsers(request: any) {
	try {
		if (request.method !== "GET") assertSameOrigin(request);
		const user = await getSessionUser(request);
		const id = user.id;
		const queryId = request.headers.get("id");

		let body = null;
		try {
			body = await request.json();
		} catch {
			body = null;
		}

		// Resolve the same records that storage will write before authorizing them.
		// Always forward writes as an array so storage cannot reinterpret a wrapper.
		const isWrite = request.method === "PUT" || request.method === "DELETE";
		const records = Array.isArray(body)
			? body
			: body && Object.hasOwn(body, collectionName)
				? body[collectionName]
				: [body];
		if (isWrite && !Array.isArray(records)) throw "INVALID_REQUEST";

		if (!roleAuth(user && user.role, "admin")) {
			if (!queryId) throw "ACCESS_DENIED";
			const parsedId = decodeURIComponent(queryId);
			if (parsedId !== id) throw "ACCESS_DENIED";
			if (isWrite) {
				if (
					!records.length ||
					records.some((record: any) => !record || record.id !== id)
				)
					throw "ACCESS_DENIED";
			}
			if (request.method === "PUT") {
				const existing = await findRecord({
					query: { id: parsedId },
					collectionName,
				});
				if (
					!existing ||
					records.some((record: any) => record.role !== existing.role)
				)
					throw "ACCESS_DENIED";
				for (const record of records) {
					for (const field of [
						"hash",
						"salt",
						"role",
						"credentials",
						"perministerSubjectId",
						"resetToken",
						"resetTokenExpiry",
						"date",
						"utc",
					]) {
						record[field] = existing[field];
					}
					delete record.password;
					delete record.rssToken;
				}
			}
		} else if (request.method === "PUT") {
			for (const record of records) {
				if (
					record?.password &&
					typeof record.id === "string" &&
					!isValidNewPassword(record.password)
				) {
					throw "INVALID_PASSWORD";
				}
			}
			for (const record of records) {
				if (!record || typeof record.id !== "string") continue;
				const existing = await findRecord({
					query: { id: record.id },
					collectionName,
				});
				if (
					perministerAuthEnabled() &&
					existing &&
					record.role !== existing.role
				) {
					throw "ACCESS_DENIED";
				}
				if (record.password) {
					record.hash = await bcryptHash(record.password, 10);
					delete record.password;
					if (existing) await revokeAllSessions(record.id);
				} else if (existing?.hash) {
					record.hash = existing.hash;
				} else if (!record.hash) {
					throw "PASSWORD_REQUIRED";
				}
				if (existing) {
					record.salt = existing.salt;
					record.credentials = existing.credentials;
					record.perministerSubjectId = existing.perministerSubjectId;
					record.resetToken = existing.resetToken;
					record.resetTokenExpiry = existing.resetTokenExpiry;
					record.date = existing.date;
					record.utc = existing.utc;
				}
				delete record.rssToken;
			}
		}

		const url = new URL(request.url);
		const req = {
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			body: isWrite ? records.filter((record: any) => record != null) : body,
			query: Object.fromEntries(url.searchParams.entries()),
		};
		if (request.method === "DELETE") {
			for (const record of req.body) {
				if (typeof record?.id === "string") await deleteUserData(record.id);
			}
		}

		const result = await handleRequest({ collectionName, req });
		const sanitizeUser = (user: any) => {
			if (!user || typeof user.id !== "string") return user;
			const {
				hash,
				salt: _salt,
				resetToken: _resetToken,
				resetTokenExpiry: _resetTokenExpiry,
				credentials: _credentials,
				perministerSubjectId: _perministerSubjectId,
				...rest
			} = user;
			const rssToken = crypto
				.createHash("sha256")
				.update(
					user.id + hash + (process.env.RSS_SECRET || process.env.AWS_SECRET),
				)
				.digest("hex");
			return { ...rest, rssToken };
		};
		const sanitizedResult = Array.isArray(result)
			? result.map(sanitizeUser)
			: sanitizeUser(result);
		return NextResponse.json(sanitizedResult);
	} catch (err: any) {
		structuredLogger.error("users error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}

export async function GET(request: any) {
	return handleUsers(request);
}
export async function PUT(request: any) {
	return handleUsers(request);
}
export async function DELETE(request: any) {
	return handleUsers(request);
}
