import { NextResponse } from "next/server";
import { validateApiKey } from "@util/apikey";
import { getSafeError } from "@util/safeError";
import { checkRateLimit } from "@util/rateLimit";
import { roleAuth } from "@util/roles";
import { downloadData, list } from "@util/aws";

export async function GET(req) {
    try {
        // 1. Rate Limit Check
        // create a dummy req object for rateLimit which expects req.headers and req.socket
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
        const limit = parseInt(searchParams.get("limit")) || 20; // Lower limit for library articles because we fetch content
        let continuationToken = searchParams.get("token") || undefined;

        if (limit > 100) {
            return NextResponse.json({ error: "Limit cannot exceed 100" }, { status: 400 });
        }

        // 4. Fetch Library Directory Listing from S3
        // Notice we are NOT recursively fetching everything.
        // We will fetch the root "library" folder or a specific subfolder.
        // For a full system, recursive pagination via S3 is complex. We will allow querying by prefix/path.
        const path = searchParams.get("path") || "library";

        const listResult = await list({
            path,
            maxKeys: limit,
            continuationToken
        });

        const items = listResult.items || [];
        const nextToken = listResult.continuationToken;

        const articles = [];

        // Fetch Full Content for each article in the current page
        for (const item of items) {
            // Ignore subdirectories
            if (item.type === "dir" || item.stat?.type === "dir") {
                articles.push({
                    path: path === "" ? item.name : `${path}/${item.name}`,
                    type: "dir"
                });
                continue;
            }

            const itemPath = path === "" ? item.name : `${path}/${item.name}`;

            // Only fetch text content for likely articles
            if (item.name.endsWith(".md") || item.name.endsWith(".txt") || item.name.endsWith(".json")) {
                try {
                    const content = await downloadData({ path: itemPath });

                    let text = "";
                    if (typeof content === "string") {
                        text = content;
                    } else if (Buffer.isBuffer(content)) {
                        text = content.toString("utf8");
                    }

                    articles.push({
                        path: itemPath,
                        type: "file",
                        content: text
                    });
                } catch (err) {
                    console.error("Failed to fetch article", itemPath, err);
                    articles.push({
                        path: itemPath,
                        type: "file",
                        content: null,
                        error: "Failed to fetch content"
                    });
                }
            } else {
                 articles.push({
                    path: itemPath,
                    type: "file",
                    content: null,
                    error: "Not a text article"
                });
            }
        }

        return NextResponse.json({
            articles,
            pagination: {
                limit,
                next_token: nextToken,
                has_more: !!nextToken
            }
        });

    } catch (err) {
        console.error("library API error:", err);
        return NextResponse.json({ error: getSafeError(err) }, { status: 500 });
    }
}
