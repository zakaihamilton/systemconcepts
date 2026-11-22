import { S3Client } from "@aws-sdk/client-s3";
import { lockMutex } from "@sync/mutex";
import { logger as structuredLogger } from "@util/api/logger";

let s3Client: any = null;

export async function getS3(params: any) {
	const unlock = await lockMutex({ id: "s3" });
	try {
		if (s3Client) {
			return s3Client;
		}
		structuredLogger.debug("getS3: initializing s3Client");

		const { endpoint, region } = params || {};
		let finalEndpoint = endpoint || process.env.AWS_ENDPOINT;
		const finalRegion = region || process.env.AWS_REGION || "sfo3";

		if (finalEndpoint) {
			if (!finalEndpoint.startsWith("http")) {
				finalEndpoint = `https://${finalEndpoint}`;
			}
			try {
				new URL(finalEndpoint);
			} catch (_err: any) {
				structuredLogger.error("getS3: Invalid endpoint URL:", finalEndpoint);
			}
		}

		structuredLogger.debug("getS3: initializing s3Client", {
			finalEndpoint,
			finalRegion,
		});

		const accessKeyId = process.env.AWS_ID;
		const secretAccessKey = process.env.AWS_SECRET;

		structuredLogger.debug("getS3: credentials check", {
			hasAccessKey: !!accessKeyId,
			hasSecretKey: !!secretAccessKey,
			accessKeyLength: accessKeyId ? accessKeyId.length : 0,
		});

		if (!accessKeyId || !secretAccessKey) {
			structuredLogger.error(
				"getS3: Missing AWS credentials! Check AWS_ID and AWS_SECRET in .env",
			);
		}

		s3Client = new S3Client({
			endpoint: finalEndpoint,
			region: finalRegion,
			...(accessKeyId && secretAccessKey
				? { credentials: { accessKeyId, secretAccessKey } }
				: {}),
			forcePathStyle: true,
		});
		structuredLogger.debug(
			"getS3: created s3Client",
			typeof s3Client,
			typeof s3Client.send,
		);
		return s3Client;
	} finally {
		unlock();
	}
}
