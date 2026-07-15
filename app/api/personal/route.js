import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { assertSameOrigin } from "@util/auth/requestSecurity";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { handleRequest } from "@util/storage/mongo";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handlePersonal(request) {
	try {
		if (request.method !== "GET") assertSameOrigin(request);
		const user = await getSessionUser(request);
		const id = user.id;

		let body = null;
		try {
			body = await request.json();
		} catch {
			body = null;
		}

		const bodyObj = body && Array.isArray(body) ? body[0] || {} : body || {};
		let path = bodyObj.id || bodyObj.folder || bodyObj.path || "";

		if (!path) {
			const headerIdVal = request.headers.get("id");
			if (headerIdVal) {
				path = decodeURIComponent(headerIdVal);
			} else {
				const queryHeader = request.headers.get("query");
				if (queryHeader) {
					try {
						const query = JSON.parse(decodeURIComponent(queryHeader));
						path = query.folder || query.id || "";
					} catch (e) {
						structuredLogger.error(
							"[Personal API] Failed to parse query header:",
							e,
						);
					}
				}
			}
		}

		const url = new URL(request.url);
		const req = {
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			body,
			query: Object.fromEntries(url.searchParams.entries()),
		};

		const result = await handleRequest({
			collectionName: "fs_" + id.toLowerCase(),
			req,
			readOnly: false,
		});
		return NextResponse.json(result);
	} catch (err) {
		structuredLogger.error("personal error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}

export async function GET(request) {
	return handlePersonal(request);
}
export async function PUT(request) {
	return handlePersonal(request);
}
export async function POST(request) {
	return handlePersonal(request);
}
export async function DELETE(request) {
	return handlePersonal(request);
}
