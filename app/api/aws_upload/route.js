import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { getS3, validatePathAccess } from "@util/storage/aws";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
	try {
		const url = new URL(request.url);
		let path = url.searchParams.get("path") || "";

		if (!path) {
			structuredLogger.debug(`[AWS UPLOAD API] INVALID_PATH: No path provided`);
			throw "INVALID_PATH";
		}

		const user = await getSessionUser(request);
		if (!user) {
			structuredLogger.debug("[AWS UPLOAD API] ACCESS DENIED");
			throw "ACCESS_DENIED";
		}

		const isAdmin = roleAuth(user.role, "admin");
		const isStudent = roleAuth(user.role, "student");
		let allowed = false;

		const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

		if (isAdmin) {
			allowed = true;
		} else if (isStudent) {
			const isPersonalPath =
				checkPath.startsWith(`personal/${user.id}/`) ||
				checkPath === `personal/${user.id}`;
			if (isPersonalPath) {
				allowed = true;
			}
		}

		if (!allowed) {
			structuredLogger.debug(
				`[AWS UPLOAD API] ACCESS DENIED: User ${user.id} cannot write to path: ${path}`,
			);
			throw "ACCESS_DENIED: " + user.id + " cannot write to this path: " + path;
		}

		validatePathAccess(path);

		const s3 = await getS3({});
		const key = path.startsWith("/") ? path.substring(1) : path;

		const contentType = url.searchParams.get("contentType") || "";

		const command = new PutObjectCommand({
			Bucket: process.env.AWS_BUCKET,
			Key: key,
			ContentType: contentType || undefined,
			ChecksumAlgorithm: undefined, // Explicitly disable checksums for DO compatibility
		});

		const uploadUrl = await getSignedUrl(s3, command, {
			expiresIn: 3600,
			unhoistedHeaders: new Set(["content-type"]),
		});
		return NextResponse.json({ url: uploadUrl });
	} catch (err) {
		structuredLogger.error("aws_upload error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}
