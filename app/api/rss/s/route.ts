import { logger as structuredLogger } from "@util/api/logger";
import { verifyRssMediaToken } from "@util/api/rssMediaToken";
import { createPresignedUrl } from "@util/storage/awsFetch";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../cache";

export const runtime = "edge";
export const dynamic = "force-dynamic";

async function handleRequest(request: any) {
	try {
		const { searchParams } = new URL(request.url);
		let base64str = searchParams.get("p") || "";
		if (!base64str) {
			return new NextResponse("Not Found", {
				status: 404,
				headers: NO_STORE_HEADERS,
			});
		}
		if (base64str.length > 2048) {
			return new NextResponse("Invalid Path", {
				status: 400,
				headers: NO_STORE_HEADERS,
			});
		}

		if (!/^[A-Za-z0-9_-]+$/.test(base64str)) {
			return new NextResponse("Invalid Path", {
				status: 400,
				headers: NO_STORE_HEADERS,
			});
		}

		base64str = base64str.replace(/-/g, "+").replace(/_/g, "/");
		while (base64str.length % 4 !== 0) {
			base64str += "=";
		}

		let path;
		try {
			path = atob(base64str);
		} catch (_e: any) {
			return new NextResponse("Invalid Path", {
				status: 400,
				headers: NO_STORE_HEADERS,
			});
		}

		path = path.startsWith("/") ? path.substring(1) : path;
		if (!path || path.includes("\0")) {
			return new NextResponse("Invalid Path", {
				status: 400,
				headers: NO_STORE_HEADERS,
			});
		}
		const authorized = await verifyRssMediaToken({
			route: "media",
			resource: path,
			expiresAt: searchParams.get("exp"),
			signature: searchParams.get("sig"),
		});
		if (!authorized) {
			return new NextResponse("Access Denied", {
				status: 403,
				headers: NO_STORE_HEADERS,
			});
		}
		const capabilityTtlSeconds = Math.max(
			1,
			Math.min(
				86400,
				Number(searchParams.get("exp")) - Math.floor(Date.now() / 1000),
			),
		);

		let s3Key = path;
		let endpoint, region, bucket, accessKeyId, secretAccessKey;

		if (s3Key.startsWith("wasabi/")) {
			if (!process.env.WASABI_URL) {
				throw new Error("WASABI_URL not defined");
			}
			const wasabiUri = new URL(process.env.WASABI_URL);
			bucket = wasabiUri.pathname.replace("/", "");
			endpoint = `https://${wasabiUri.host}`;
			region = wasabiUri.searchParams.get("region") || "us-east-1";
			accessKeyId = decodeURIComponent(wasabiUri.username);
			secretAccessKey = decodeURIComponent(wasabiUri.password);
			s3Key = s3Key.replace(/^wasabi\//, "");
		} else {
			endpoint = process.env.AWS_ENDPOINT || "sfo3.digitaloceanspaces.com";
			if (!endpoint.startsWith("http")) {
				endpoint = `https://${endpoint}`;
			}
			region = "sfo3";
			bucket = process.env.AWS_BUCKET;
			accessKeyId = process.env.AWS_ID;
			secretAccessKey = process.env.AWS_SECRET;
		}

		if (request.method === "HEAD") {
			try {
				const signedHeadUrl = await createPresignedUrl({
					endpoint,
					region,
					bucket,
					key: s3Key,
					accessKeyId,
					secretAccessKey,
					expiresIn: capabilityTtlSeconds,
					method: "HEAD",
				});

				const headRes = await fetch(signedHeadUrl, { method: "HEAD" });
				if (!headRes.ok) {
					throw new Error(`S3 HEAD returned status ${headRes.status}`);
				}

				// Determine the correct Content-Type, prioritizing the extension hint from 'e'
				const extHint = (searchParams.get("e") || "").toLowerCase();
				let contentType =
					headRes.headers.get("Content-Type") || "application/octet-stream";

				if (extHint.endsWith(".m4a")) {
					contentType = "audio/x-m4a";
				} else if (extHint.endsWith(".mp4")) {
					contentType = "video/mp4";
				} else if (extHint.endsWith(".mp3")) {
					contentType = "audio/mpeg";
				} else if (extHint.endsWith(".vtt")) {
					contentType = "text/vtt";
				} else if (extHint.endsWith(".txt")) {
					contentType = "text/plain";
				}

				return new NextResponse(null, {
					status: 200,
					headers: {
						"Content-Type": contentType,
						"Content-Length": headRes.headers.get("Content-Length") || "0",
						"Accept-Ranges": "bytes",
						"Last-Modified": headRes.headers.get("Last-Modified") || "",
						ETag: headRes.headers.get("ETag") || "",
						...NO_STORE_HEADERS,
					},
				});
			} catch (err: any) {
				structuredLogger.warn(
					"[RSS S Proxy] HEAD failed:",
					s3Key,
					err instanceof Error ? err.message : err,
				);
			}
		}

		const signedStr = await createPresignedUrl({
			endpoint,
			region,
			bucket,
			key: s3Key,
			accessKeyId,
			secretAccessKey,
			expiresIn: capabilityTtlSeconds,
			method: "GET",
		});

		return new NextResponse(null, {
			status: 302,
			headers: {
				Location: signedStr,
				...NO_STORE_HEADERS,
			},
		});
	} catch (err: any) {
		structuredLogger.error("[RSS S Proxy] Unexpected error:", err);
		return new NextResponse("Error generating media URL", {
			status: 500,
			headers: NO_STORE_HEADERS,
		});
	}
}

export async function GET(request: any) {
	return handleRequest(request);
}

export async function HEAD(request: any) {
	return handleRequest(request);
}
