import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { findRecord, handleRequest } from "@util/storage/mongo";
import { hash as bcryptHash } from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const collectionName = "users";

async function handleUsers(request) {
	try {
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
			}
		} else if (request.method === "PUT") {
			const parsedId = queryId ? decodeURIComponent(queryId) : body && body.id;
			const record = parsedId
				? await findRecord({ query: { id: parsedId }, collectionName })
				: null;
			if (record) {
				if (body.password) {
					body.hash = await bcryptHash(body.password, 10);
					delete body.password;
				} else {
					body.hash = record.hash;
				}
				body.salt = record.salt;
				body.date = record.date;
				body.utc = record.utc;
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
		const sanitizeUser = (user) => {
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
	} catch (err) {
		structuredLogger.error("users error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}

export async function GET(request) {
	return handleUsers(request);
}
export async function PUT(request) {
	return handleUsers(request);
}
export async function DELETE(request) {
	return handleUsers(request);
}
