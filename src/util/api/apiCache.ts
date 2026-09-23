import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { logger as structuredLogger } from "@util/api/logger";
import { downloadData, getS3, uploadData } from "@util/storage/aws";
import pako from "pako";
import { TextDecoder } from "util";
import { API_CACHE_PREFIX, getCacheObjectPath } from "./apiCacheKeys";

export {
	API_CACHE_PREFIX,
	buildApiCacheKey,
	buildCanonicalApiUrl,
	getCacheObjectPath,
	getContentParams,
	getManifestFingerprint,
} from "./apiCacheKeys";

const decoder = new TextDecoder("utf-8");

export function __clearApiCacheForTests() {
	// No in-process state; hook for test symmetry.
}

function decodeCachedBody(data: any, type: any) {
	const inflated = pako.inflate(data);
	const text = decoder.decode(inflated);
	if (type === "sessions") {
		return text;
	}
	return text;
}

export async function readApiCache(type: any, key: any) {
	const path = getCacheObjectPath(type, key);
	try {
		const data = await downloadData({ path, binary: true });
		return decodeCachedBody(data, type);
	} catch {
		return null;
	}
}

export async function writeApiCache(type: any, key: any, body: any) {
	const path = getCacheObjectPath(type, key);
	const compressed = pako.gzip(body);
	await uploadData({ path, data: Buffer.from(compressed) });
}

export async function purgeApiCache() {
	const s3 = await getS3({});
	const bucket = process.env.AWS_BUCKET;
	const prefix = `${API_CACHE_PREFIX}/`;
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const response = (await s3.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		)) as ListObjectsV2CommandOutput;
		for (const item of response.Contents || []) {
			if (item.Key) keys.push(item.Key);
		}
		continuationToken = response.NextContinuationToken;
	} while (continuationToken);

	if (keys.length === 0) return 0;

	await Promise.all(
		keys.map((Key) =>
			s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })),
		),
	);

	structuredLogger.debug(`[API Cache] Purged ${keys.length} object(s)`);
	return keys.length;
}
