import { appendFileSync, mkdirSync } from "fs";
import { NextResponse } from "next/server";
import { dirname } from "path";

const LOG_PATH =
	"/Users/zakaihamilton/git/systemconcepts/.cursor/debug-a51d48.log";

export async function POST(request) {
	try {
		const body = await request.json();
		const line =
			JSON.stringify({
				sessionId: "a51d48",
				...body,
				timestamp: body.timestamp || Date.now(),
			}) + "\n";
		mkdirSync(dirname(LOG_PATH), { recursive: true });
		appendFileSync(LOG_PATH, line, "utf8");
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false }, { status: 500 });
	}
}
