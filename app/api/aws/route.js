import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { assertSameOrigin } from "@util/auth/requestSecurity";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { getDownloadUrl, handleRequest } from "@util/storage/aws";
import { shouldRedirectStorageFileRead } from "@util/storage/storageRedirect";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
	"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
};

async function handleAWS(request) {
	try {
		if (request.method !== "GET") assertSameOrigin(request);
		let body = null;
		if (request.method === "PUT" || request.method === "DELETE") {
			try {
				body = await request.json();
			} catch {
				body = null;
			}
		}

		const bodyObj = body && Array.isArray(body) ? body[0] || {} : body || {};
		const url = new URL(request.url);
		let path =
			bodyObj.path ||
			request.headers.get("path") ||
			url.searchParams.get("path") ||
			"";
		if (path) {
			path = decodeURIComponent(path);
		}

		const user = await getSessionUser(request);
		if (!user) {
			structuredLogger.debug("[AWS API] ACCESS DENIED");
			throw "ACCESS_DENIED";
		}
		structuredLogger.debug(
			`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${request.method}, Path: ${path}`,
		);

		const validateUserAccess = (user, path, method) => {
			if (roleAuth(user.role, "admin")) return true;
			if (!path) return false;
			const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");
			if (roleAuth(user.role, "student")) {
				const isPersonalPath =
					checkPath.startsWith(`personal/${user.id}/`) ||
					checkPath === `personal/${user.id}`;
				if (method === "GET") {
					const isSyncPath =
						checkPath.startsWith("sync/") || checkPath === "sync";
					const isLibraryPath =
						checkPath.startsWith("library/") || checkPath === "library";
					return isSyncPath || isPersonalPath || isLibraryPath;
				} else if (method === "PUT" || method === "DELETE") {
					return isPersonalPath;
				}
			}
			return false;
		};

		if (!validateUserAccess(user, path, request.method)) {
			structuredLogger.debug(
				`[AWS API] ACCESS DENIED: User ${user.id} cannot ${request.method} path: ${path}`,
			);
			throw (
				"ACCESS_DENIED: " +
				user.id +
				" cannot " +
				request.method +
				" path: " +
				path
			);
		}

		if (request.method === "PUT" && Array.isArray(body)) {
			for (const item of body) {
				let itemPath = item.path || "";
				if (itemPath) itemPath = decodeURIComponent(itemPath);
				if (!validateUserAccess(user, itemPath, request.method)) {
					structuredLogger.debug(
						`[AWS API] ACCESS DENIED: Batch item path: ${itemPath}`,
					);
					throw "ACCESS_DENIED: Batch item unauthorized for path: " + itemPath;
				}
			}
		}

		if (shouldRedirectStorageFileRead(request, url.searchParams)) {
			const downloadUrl = await getDownloadUrl({ path });
			return NextResponse.redirect(downloadUrl, {
				status: 307,
				headers: NO_CACHE_HEADERS,
			});
		}

		const req = {
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			body,
			query: Object.fromEntries(url.searchParams.entries()),
		};

		const result = await handleRequest({
			req,
			readOnly: request.method === "GET",
			path,
		});

		const headers = new Headers(NO_CACHE_HEADERS);

		if (Buffer.isBuffer(result)) {
			return new NextResponse(result, { status: 200, headers });
		} else if (typeof result === "object") {
			return NextResponse.json(result, { status: 200, headers });
		} else {
			return new NextResponse(result, { status: 200, headers });
		}
	} catch (err) {
		structuredLogger.error("aws error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}

export async function GET(request) {
	return handleAWS(request);
}
export async function PUT(request) {
	return handleAWS(request);
}
export async function DELETE(request) {
	return handleAWS(request);
}
