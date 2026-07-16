import { enforceRateLimit } from "@util/api/api";
import { handle } from "@util/api/logger";
import { clientLogRequestSchema, parseBody } from "@util/api/schemas";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_LOG_BYTES = 10 * 1024;

export async function POST(request) {
	const rateLimited = await enforceRateLimit(request, {
		limit: 20,
		windowMs: 60 * 1000,
	});
	if (rateLimited) return rateLimited;

	const length = Number.parseInt(
		request.headers.get("content-length") || "0",
		10,
	);
	if (length > MAX_LOG_BYTES) {
		return NextResponse.json({ err: "Payload too large" }, { status: 413 });
	}

	let raw = "";
	try {
		raw = await request.text();
	} catch (_err) {
		return NextResponse.json({ err: "Invalid body" }, { status: 400 });
	}
	if (Buffer.byteLength(raw, "utf8") > MAX_LOG_BYTES) {
		return NextResponse.json({ err: "Payload too large" }, { status: 413 });
	}

	let body = {};
	try {
		body = JSON.parse(raw);
	} catch (_err) {
		return NextResponse.json({ err: "Invalid JSON" }, { status: 400 });
	}
	body = parseBody(clientLogRequestSchema, body);
	if (!body) {
		return NextResponse.json({ err: "Invalid payload" }, { status: 400 });
	}
	handle({
		type: body.type === "error" ? "error" : "log",
		props: {
			component: String(body.props?.component || "client").slice(0, 100),
			message: String(body.props?.message || "").slice(0, 2000),
			throwError: false,
		},
	});
	return NextResponse.json({});
}
