import { downloadData } from "@util/aws";
import { findRecord } from "@util/mongo";
import pLimit from "@util/p-limit";
import { checkRateLimit } from "@util/rateLimit";
import crypto from "crypto";
import { NextResponse } from "next/server";
import pako from "pako";

export const dynamic = "force-dynamic";

const MANIFEST_PATH = "sync/files.json.gz";

export async function GET(request) {
	try {
		// 1. Rate Limiting Check
		const ip =
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"";
		try {
			await checkRateLimit({ headers: { "x-forwarded-for": ip } }, { limit: 60, windowMs: 60 * 1000 });
		} catch (rlErr) {
			if (rlErr === "RATE_LIMIT_EXCEEDED") {
				return new NextResponse(
					JSON.stringify({ err: "Too many requests. Please try again later." }),
					{
						status: 429,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw rlErr;
		}

		// 2. Authentication Parameters Check
		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		const token = searchParams.get("token");

		if (!id || !token) {
			return new NextResponse(
				JSON.stringify({ err: "Unauthorized. Missing id or token parameter." }),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const user = await findRecord({
			collectionName: "users",
			query: { id: id.toLowerCase() },
		});
		if (!user || user.role === "visitor") {
			return new NextResponse(
				JSON.stringify({ err: "Unauthorized. Access Denied." }),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const expectedToken = crypto
			.createHash("sha256")
			.update(
				user.id +
					user.hash +
					(process.env.RSS_SECRET || process.env.AWS_SECRET),
			)
			.digest("hex");
		if (token !== expectedToken) {
			return new NextResponse(
				JSON.stringify({ err: "Unauthorized. Invalid token." }),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// 3. Optional Filter/Query Parameters
		const group = searchParams.get("group");
		const tag = searchParams.get("tag");
		const date = searchParams.get("date");
		const year = searchParams.get("year");
		const query = searchParams.get("query");
		const count = Math.min(
			parseInt(searchParams.get("count") || "100", 10),
			500,
		);
		const index = Math.max(
			parseInt(searchParams.get("index") || "0", 10),
			0,
		);

		// 4. Download and Parse Manifest
		const manifestData = await downloadData({
			path: MANIFEST_PATH,
			binary: true,
		});

		let manifestStr;
		try {
			const decompressed = pako.inflate(manifestData);
			manifestStr = new TextDecoder("utf-8").decode(decompressed);
		} catch (_e) {
			manifestStr = Buffer.from(manifestData).toString("utf-8");
		}

		const manifest = JSON.parse(manifestStr);

		let files = manifest.filter(
			(f) => f.path && f.path.endsWith(".json") && f.path !== "/files.json",
		);

		// Pre-filter files by group to optimize S3 fetches if group is requested
		if (group) {
			const lowerGroup = group.toLowerCase().trim();
			files = files.filter((f) => {
				const lowerPath = f.path.toLowerCase();
				return (
					f.path === "/bundle.json" ||
					lowerPath === `/${lowerGroup}.json` ||
					lowerPath.startsWith(`/${lowerGroup}/`)
				);
			});
		}

		// 5. Load and Decompress Session Files
		const limit = pLimit(10);
		const sessionPromises = files.map((file) =>
			limit(async () => {
				try {
					const s3Path = `sync${file.path.startsWith("/") ? "" : "/"}${file.path}.gz`;
					const fileData = await downloadData({ path: s3Path, binary: true });
					let jsonStr;
					try {
						const decompressed = pako.inflate(fileData);
						jsonStr = new TextDecoder("utf-8").decode(decompressed);
					} catch (_e) {
						jsonStr = Buffer.from(fileData).toString("utf-8");
					}
					const data = JSON.parse(jsonStr);
					return data.sessions || [];
				} catch (err) {
					console.error(`[API] Error loading sessions from ${file.path}:`, err);
					return [];
				}
			}),
		);

		const sessionsArrays = await Promise.all(sessionPromises);
		const sessionsFlat = sessionsArrays.flat();

		// 6. Deduplicate Sessions
		const sessionMap = new Map();
		for (const session of sessionsFlat) {
			const key = `${(session.group || "").toLowerCase().trim()}_${session.id}`;
			if (!sessionMap.has(key)) {
				sessionMap.set(key, session);
			}
		}
		let sessions = Array.from(sessionMap.values());

		// 7. Apply Query & Metadata Filters
		if (group) {
			const lowerGroup = group.toLowerCase().trim();
			sessions = sessions.filter(
				(s) => (s.group || "").toLowerCase().trim() === lowerGroup,
			);
		}
		if (tag) {
			const lowerTag = tag.toLowerCase().trim();
			sessions = sessions.filter((s) =>
				(s.tags || []).some((t) => t.toLowerCase().trim() === lowerTag),
			);
		}
		if (date) {
			const dateStr = date.trim();
			sessions = sessions.filter((s) => s.date === dateStr);
		}
		if (year) {
			const yearStr = year.trim();
			sessions = sessions.filter((s) => s.year === yearStr);
		}
		if (query) {
			const lowerQuery = query.toLowerCase().trim();
			sessions = sessions.filter(
				(s) =>
					(s.name || "").toLowerCase().includes(lowerQuery) ||
					(s.summaryText || "").toLowerCase().includes(lowerQuery) ||
					(s.tags || []).some((t) => t.toLowerCase().includes(lowerQuery)),
			);
		}

		// 8. Sort: Date (DESC), Group (ASC), Name (ASC)
		sessions.sort((a, b) => {
			const dateA = String(a.date || "").substring(0, 10);
			const dateB = String(b.date || "").substring(0, 10);
			if (dateB > dateA) return 1;
			if (dateB < dateA) return -1;

			const groupA = (a.group || "").toLowerCase();
			const groupB = (b.group || "").toLowerCase();
			const groupDiff = groupA.localeCompare(groupB);
			if (groupDiff !== 0) return groupDiff;

			return (a.name || "").localeCompare(b.name || "");
		});

		// Slice to sliding window of sessions
		sessions = sessions.slice(index, index + count);

		// 9. Map and Enrich with Proxied URLs
		const baseUrl =
			process.env.NEXT_PUBLIC_SITE_URL || "https://systemconcepts.app";

		const getSProxyUrl = (path) => {
			if (!path) return null;
			const cleanPath = path.startsWith("/") ? path.substring(1) : path;
			const b64 = Buffer.from(cleanPath).toString("base64url");
			const ext = path.split(".").pop() || "bin";
			return `${baseUrl}/api/rss/s?p=${b64}&e=.${ext}`;
		};

		const formattedSessions = sessions.map((session) => {
			// Resolve transcription/subtitle file path
			let transcriptPath = session.subtitles?.path || session.transcriptPath;
			if (!transcriptPath && session.transcription) {
				transcriptPath = `wasabi/${session.group}/${session.year}/${session.date} ${session.name}.txt`;
			}

			return {
				id: session.id,
				group: session.group,
				year: session.year,
				date: session.date,
				name: session.name,
				duration: session.duration ? Math.round(session.duration) : 0,
				tags: session.tags || [],
				summaryText: session.summaryText || session.summary || null,
				imageUrl:
					session.image && session.image.path
						? getSProxyUrl(session.image.path)
						: null,
				transcriptionUrl: transcriptPath ? getSProxyUrl(transcriptPath) : null,
			};
		});

		return new Response(JSON.stringify(formattedSessions), {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			},
		});
	} catch (err) {
		console.error("[API] Error generating session list:", err);
		return new NextResponse(
			JSON.stringify({ err: "Error generating sessions JSON API" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
