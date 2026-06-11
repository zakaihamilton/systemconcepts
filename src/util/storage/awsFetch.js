/**
 * Edge-compatible S3 downloader via fetch + Web Crypto Signature V4 presigner.
 * Mirrors downloadData() from aws.js but requires no Node.js APIs or @aws-sdk.
 * Compatible with Vercel Edge Runtime, Cloudflare Workers, and Node.js 18+.
 */

async function hmacSha256(key, data) {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		typeof key === "string" ? new TextEncoder().encode(key) : key,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
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

async function getPresignedUrl({
	endpoint,
	region,
	bucket,
	key,
	accessKeyId,
	secretAccessKey,
	expiresIn = 3600,
	method = "GET",
}) {
	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[:-]/g, "")
		.replace(/\.\d{3}/, "");
	const dateStamp = amzDate.substring(0, 8);

	const host = endpoint.replace(/^https?:\/\//, "");
	const protocol = endpoint.startsWith("https") ? "https://" : "http://";

	// URI-encode path segments, preserving slashes
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

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQueryString,
		`host:${host}\n`,
		"host",
		"UNSIGNED-PAYLOAD",
	].join("\n");

	const canonicalRequestHash = await sha256Hex(canonicalRequest);

	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		canonicalRequestHash,
	].join("\n");

	const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
	const kRegion = await hmacSha256(kDate, region);
	const kService = await hmacSha256(kRegion, "s3");
	const kSigning = await hmacSha256(kService, "aws4_request");

	const signatureBuffer = await hmacSha256(kSigning, stringToSign);
	const signature = Array.from(signatureBuffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return `${protocol}${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

function normalizePath(path) {
	if (!path) return path;
	return path.startsWith("/") ? path.substring(1) : path;
}

/**
 * Download an S3 object using a presigned GET URL.
 * Returns Uint8Array when binary=true (default), string otherwise.
 */
export async function downloadDataEdge({ path, binary = true, bucketName }) {
	let endpoint = process.env.AWS_ENDPOINT || "sfo3.digitaloceanspaces.com";
	if (!endpoint.startsWith("http")) {
		endpoint = `https://${endpoint}`;
	}

	const region = "sfo3";
	const bucket = bucketName || process.env.AWS_BUCKET;
	const accessKeyId = process.env.AWS_ID;
	const secretAccessKey = process.env.AWS_SECRET;
	const key = normalizePath(path);

	const url = await getPresignedUrl({
		endpoint,
		region,
		bucket,
		key,
		accessKeyId,
		secretAccessKey,
		expiresIn: 3600,
	});

	const res = await fetch(url);
	if (!res.ok) {
		const err = new Error(`S3 fetch failed: ${res.status} for key "${key}"`);
		if (res.status === 404) err.name = "NoSuchKey";
		throw err;
	}

	if (binary) {
		return new Uint8Array(await res.arrayBuffer());
	}
	return res.text();
}
