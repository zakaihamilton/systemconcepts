import { logger as structuredLogger } from "@util/api/logger";
import {
	isLegacyRssMediaRequest,
	isPublicRssMediaPath,
	verifyRssMediaToken,
} from "@util/api/rssMediaToken";
import { NextResponse } from "next/server";
import { MEDIA_CACHE_HEADERS, NO_STORE_HEADERS } from "../cache";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_MS = 23 * 60 * 60 * 1000;
const importedHmacKeys = new Map();
const signedUrlCache = new Map();

async function hmacSha256(key, data) {
	let cryptoKey;
	if (typeof key === "string") {
		cryptoKey = importedHmacKeys.get(key);
		if (!cryptoKey) {
			cryptoKey = crypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(key),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			);
			importedHmacKeys.set(key, cryptoKey);
		}
		cryptoKey = await cryptoKey;
	} else {
		cryptoKey = await crypto.subtle.importKey(
			"raw",
			key,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
	}
	const signature = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		typeof data === "string" ? new TextEncoder().encode(data) : data,
	);
	return new Uint8Array(signature);
}

async function sha256Hex(data) {
	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		typeof data === "string" ? new TextEncoder().encode(data) : data,
	);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// Ultra-lightweight Web Crypto-based AWS Signature V4 presigned URL generator
async function getPresignedUrl({
	endpoint,
	region,
	bucket,
	key,
	accessKeyId,
	secretAccessKey,
	expiresIn = 86400,
	method = "GET",
}) {
	const cacheKey = [endpoint, region, bucket, key, accessKeyId, method].join(
		"\0",
	);
	const nowMs = Date.now();
	const cached = signedUrlCache.get(cacheKey);
	if (cached && cached.expiresAt > nowMs) return cached.promise;

	const promise = createPresignedUrl({
		endpoint,
		region,
		bucket,
		key,
		accessKeyId,
		secretAccessKey,
		expiresIn,
		method,
	});
	signedUrlCache.set(cacheKey, {
		expiresAt: nowMs + SIGNED_URL_TTL_MS,
		promise,
	});
	try {
		return await promise;
	} catch (err) {
		signedUrlCache.delete(cacheKey);
		throw err;
	}
}

async function createPresignedUrl({
	endpoint,
	region,
	bucket,
	key,
	accessKeyId,
	secretAccessKey,
	expiresIn = 86400,
	method = "GET",
}) {
	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[:-]/g, "")
		.replace(/\.\d{3}/, "");
	const dateStamp = amzDate.substring(0, 8);

	let host = endpoint.replace(/^https?:\/\//, "");
	const protocol = endpoint.startsWith("http")
		? endpoint.match(/^https?:\/\//)[0]
		: "https://";

	// Uri-encode path segments (preserving slashes)
	const canonicalUri = `/${bucket}/${key
		.split("/")
		.map((segment) => encodeURIComponent(segment).replace(/%7E/g, "~"))
		.join("/")}`;

	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const queryParams = {
		"X-Amz-Algorithm": "AWS4-HMAC-SHA256",
		"X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
		"X-Amz-Date": amzDate,
		"X-Amz-Expires": expiresIn.toString(),
		"X-Amz-SignedHeaders": "host",
	};

	const canonicalQueryString = Object.keys(queryParams)
		.sort()
		.map(
			(k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`,
		)
		.join("&");

	const canonicalHeaders = `host:${host}\n`;
	const signedHeaders = "host";
	const payloadHash = "UNSIGNED-PAYLOAD";

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join("\n");

	const canonicalRequestHash = await sha256Hex(canonicalRequest);

	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		canonicalRequestHash,
	].join("\n");

	const kDate = await hmacSha256("AWS4" + secretAccessKey, dateStamp);
	const kRegion = await hmacSha256(kDate, region);
	const kService = await hmacSha256(kRegion, "s3");
	const kSigning = await hmacSha256(kService, "aws4_request");

	const signatureBuffer = await hmacSha256(kSigning, stringToSign);
	const signature = Array.from(signatureBuffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return `${protocol}${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

async function handleRequest(request) {
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
		} catch (_e) {
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
		const expiresAt = searchParams.get("exp");
		const signature = searchParams.get("sig");
		const authorized = await verifyRssMediaToken({
			route: "media",
			resource: path,
			expiresAt,
			signature,
		});
		const legacyPublicUrl =
			isLegacyRssMediaRequest({ expiresAt, signature }) &&
			isPublicRssMediaPath(path);
		if (!authorized && !legacyPublicUrl) {
			return new NextResponse("Access Denied", {
				status: 403,
				headers: NO_STORE_HEADERS,
			});
		}
		const capabilityTtlSeconds = authorized
			? Math.max(
					1,
					Math.min(86400, Number(expiresAt) - Math.floor(Date.now() / 1000)),
				)
			: 86400;

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
				const signedHeadUrl = await getPresignedUrl({
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
						...MEDIA_CACHE_HEADERS,
					},
				});
			} catch (err) {
				structuredLogger.warn("[RSS S Proxy] HEAD failed:", s3Key, err.message);
			}
		}

		const signedStr = await getPresignedUrl({
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
				...MEDIA_CACHE_HEADERS,
			},
		});
	} catch (err) {
		structuredLogger.error("[RSS S Proxy] Unexpected error:", err);
		return new NextResponse("Error generating media URL", {
			status: 500,
			headers: NO_STORE_HEADERS,
		});
	}
}

export async function GET(request) {
	return handleRequest(request);
}

export async function HEAD(request) {
	return handleRequest(request);
}
