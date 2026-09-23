import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { isValidNewPassword } from "@util/auth/passwordPolicy";
import { assertSameOrigin } from "@util/auth/requestSecurity";
import { roleAuth } from "@util/auth/roles";
import {
	getAuthErrorStatus,
	getSessionUser,
	revokeAllSessions,
} from "@util/auth/session";
import { findRecord, handleRequest } from "@util/storage/mongo";
import { hash as bcryptHash } from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const collectionName = "users";

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

		if (!roleAuth(user && user.role, "admin")) {
			if (!queryId) throw "ACCESS_DENIED";
			const parsedId = decodeURIComponent(queryId);
			if (parsedId !== id) throw "ACCESS_DENIED";
			if (request.method === "PUT") {
				const record = await findRecord({
					query: { id: parsedId },
					collectionName,
				});
				if (!record || !body) throw "ACCESS_DENIED";
				if (record.id !== body.id || record.role !== body.role)
					throw "ACCESS_DENIED";
				body.hash = record.hash;
				body.salt = record.salt;
				body.role = record.role;
				body.credentials = record.credentials;
				body.resetToken = record.resetToken;
				body.resetTokenExpiry = record.resetTokenExpiry;
				body.date = record.date;
				body.utc = record.utc;
				delete body.password;
			} else if (request.method === "DELETE") {
				const records = Array.isArray(body) ? body : [body];
				if (
					!records.length ||
					records.some((record) => !record || record.id !== id)
				)
					throw "ACCESS_DENIED";
			}
		} else if (request.method === "PUT") {
			const records = Array.isArray(body)
				? body
				: body && Array.isArray(body[collectionName])
					? body[collectionName]
					: [body];
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
			body,
			query: Object.fromEntries(url.searchParams.entries()),
		};

		const result = await handleRequest({ collectionName, req });
		const sanitizeUser = (user: any) => {
			if (!user) return user;
			const {
				hash,
				salt: _salt,
				resetToken: _resetToken,
				resetTokenExpiry: _resetTokenExpiry,
				credentials: _credentials,
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
