import { NextResponse } from "next/server";
import { handle } from "@util/logger";

export const dynamic = "force-dynamic";

export async function POST(request) {
    const body = await request.json();
    handle({ ...body, throwError: false });
    return NextResponse.json({});
}
