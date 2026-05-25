import { handle } from "@util/api/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_LOG_BYTES = 10 * 1024;

export async function POST(request) {
	const length = Number.parseInt(request.headers.get("content-length") || "0", 10);
	if (length > MAX_LOG_BYTES) {
		return NextResponse.json({ err: "Payload too large" }, { status: 413 });
	}

	let body = {};
	try {
		body = await request.json();
	} catch (_err) {
		return NextResponse.json({ err: "Invalid JSON" }, { status: 400 });
	}
	handle({ ...body, throwError: false });
	return NextResponse.json({});
}
