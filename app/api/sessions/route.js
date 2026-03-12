import { NextResponse } from "next/server";
import { validateApiKey } from "@util/apikey";
import { getSafeError } from "@util/safeError";
import { checkRateLimit } from "@util/rateLimit";
import { roleAuth } from "@util/roles";
import { downloadData } from "@util/aws";

export async function GET(req) {
    try {
        // 1. Rate Limit Check
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
        const dummyReq = {
            headers: { "x-forwarded-for": ip },
            socket: { remoteAddress: ip }
        };
        await checkRateLimit(dummyReq);

        // 2. Auth Check
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
        }

        const apiKey = authHeader.split(" ")[1];
        const user = await validateApiKey(apiKey);

        if (!user || !roleAuth(user.role, "student")) {
            return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
        }

        // 3. Parse Pagination Params
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit")) || 50;
        const offset = parseInt(searchParams.get("offset")) || 0;
        const groupParam = searchParams.get("group");

        if (limit > 500) {
            return NextResponse.json({ error: "Limit cannot exceed 500" }, { status: 400 });
        }

        // 4. Fetch Sessions from S3 (aws.js)
        let allSessions = [];
        let total = 0;

        // Fetch bundled sessions. bundle.json is small and contains almost everything.
        const bundlePath = "sync/bundle.json";
        try {
            const bundleResult = await downloadData({ path: bundlePath });
            if (bundleResult && typeof bundleResult === "string") {
                const bundleData = JSON.parse(bundleResult);
                if (bundleData.sessions && Array.isArray(bundleData.sessions)) {
                    allSessions = bundleData.sessions;
                }
            } else if (bundleResult && typeof bundleResult === "object" && bundleResult.sessions) {
                 allSessions = bundleResult.sessions;
            }
        } catch (err) {
            console.warn("Failed to fetch bundle.json:", err);
            // Fallback: If bundle.json is missing or corrupt, we just return empty array.
            // We do not want to iterate over N+1 group JSONs sequentially to avoid timeouts.
        }

        // Filter by group if requested
        if (groupParam) {
            allSessions = allSessions.filter(s => s.group === groupParam);
        }

        total = allSessions.length;

        // Apply Pagination
        const paginatedSessions = allSessions.slice(offset, offset + limit);

        return NextResponse.json({
            sessions: paginatedSessions,
            pagination: {
                total,
                offset,
                limit,
                has_more: offset + limit < total
            }
        });

    } catch (err) {
        console.error("sessions API error:", err);
        return NextResponse.json({ error: getSafeError(err) }, { status: 500 });
    }
}
