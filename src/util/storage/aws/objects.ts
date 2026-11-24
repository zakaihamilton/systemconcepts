import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	type ListObjectsV2CommandInput,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import pLimit from "p-limit";
import { listObjectsV2ToItems } from "../listObjectsV2ToItems";
import { getS3 } from "./client";
import { normalizePath, parseUrl, validatePathAccess } from "./pathSecurity";

export async function getDownloadUrl({
	path,
	bucketName = process.env.AWS_BUCKET,
	expiresIn = 3600,
	responseContentDisposition,
}: any) {
	validatePathAccess(path);
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = normalizePath(path);

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
		...(responseContentDisposition && {
			ResponseContentDisposition: responseContentDisposition,
		}),
	});

	return await getSignedUrl(s3, command, {
		expiresIn,
	});
}

export async function uploadFile({
	from,
	to,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = normalizePath(to);

	if (!fs.existsSync(from)) {
		throw new Error(`Source file not found: ${from}`);
	}

	const fileStream = fs.createReadStream(from);
	const uploadParams = {
		Bucket: bucket,
		Key: key,
		Body: fileStream,
	};
	return await s3.send(new PutObjectCommand(uploadParams));
}

export async function downloadFile({
	from,
	to,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = from;

	const downloadParams = {
		Bucket: bucket,
		Key: key,
	};

	const response = await s3.send(new GetObjectCommand(downloadParams));

	const fileStream = fs.createWriteStream(to);

	if (response.Body.pipe) {
		response.Body.pipe(fileStream);
	} else {
		const buffer = await response.Body.transformToByteArray();
		fs.writeFileSync(to, buffer);
		return;
	}

	await new Promise<void>((resolve, reject) => {
		fileStream.on("finish", resolve);
		fileStream.on("error", reject);
		response.Body.on("error", reject);
	});
}

export async function uploadData({
	path,
	data,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = normalizePath(path);

	const uploadParams = {
		Bucket: bucket,
		Key: key,
		Body: data,
	};
	return await s3.send(new PutObjectCommand(uploadParams));
}

export async function downloadData({
	path,
	binary,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = normalizePath(path);

	const downloadParams = {
		Bucket: bucket,
		Key: key,
	};

	const response = await s3.send(new GetObjectCommand(downloadParams));

	if (binary) {
		const uint8Array = await response.Body.transformToByteArray();
		return Buffer.from(uint8Array);
	}
	return await response.Body.transformToString();
}

export async function copyFile(from: any, to: any) {
	const [fromBucketName, fromPath] = parseUrl(from);
	const [toBucketName, toPath] = parseUrl(to);

	const s3 = await getS3({});

	const copyParams = {
		Bucket: toBucketName,
		CopySource: `${fromBucketName}/${encodeURIComponent(fromPath)}`,
		Key: toPath,
	};
	return await s3.send(new CopyObjectCommand(copyParams));
}

export async function moveFile({
	from,
	to,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});

	const encodedSource = `${bucketName}/${encodeURIComponent(from)}`;

	const copyParams = {
		Bucket: bucketName,
		CopySource: encodedSource,
		Key: to,
	};

	const copyResponse = await s3.send(new CopyObjectCommand(copyParams));
	await deleteFile({ path: from, bucketName });
	return copyResponse;
}

export async function deleteFile({
	path,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = normalizePath(path);

	const deleteParams = {
		Bucket: bucket,
		Key: key,
	};
	return await s3.send(new DeleteObjectCommand(deleteParams));
}

export async function metadataInfo({
	path,
	bucketName = process.env.AWS_BUCKET,
}: any) {
	path = normalizePath(path);
	const s3 = await getS3({});
	const bucket = bucketName;
	const key = path;

	try {
		const headParams = { Bucket: bucket, Key: key };
		const headResponse = await s3.send(new HeadObjectCommand(headParams));
		const name = path.split("/").pop();
		return {
			type: headResponse.ContentType,
			name,
			size: headResponse.ContentLength,
			date: headResponse.LastModified?.valueOf(),
		};
	} catch {
		const listParams = {
			Bucket: bucket,
			Delimiter: "/",
			Prefix: key ? key + "/" : "",
			MaxKeys: 1,
		};

		try {
			const listResponse = await s3.send(new ListObjectsV2Command(listParams));
			if (
				(listResponse.Contents && listResponse.Contents.length > 0) ||
				(listResponse.CommonPrefixes && listResponse.CommonPrefixes.length > 0)
			) {
				const name = path.split("/").pop();
				return {
					type: "application/x-directory",
					name,
				};
			}
		} catch {
			// Ignore list errors, return null
		}
	}
	return null;
}

export async function list({
	path,
	bucketName = process.env.AWS_BUCKET,
	includeCounts = false,
}: any) {
	path = normalizePath(path);

	const s3 = await getS3({});
	const bucket = bucketName;
	const key = path;

	const items: any = [];
	let continuationToken: string | undefined;
	const seenTokens = new Set<string>();
	let pages = 0;
	const MAX_LIST_PAGES = 1000;

	do {
		if (continuationToken) {
			if (seenTokens.has(continuationToken)) {
				break;
			}
			seenTokens.add(continuationToken);
		}
		if (++pages > MAX_LIST_PAGES) {
			break;
		}
		const listParams: ListObjectsV2CommandInput = {
			Bucket: bucket,
			Delimiter: "/",
			Prefix: key ? key + "/" : "",
			ContinuationToken: continuationToken,
		};
		const listResponse = await s3.send(new ListObjectsV2Command(listParams));

		items.push(
			...listObjectsV2ToItems(listResponse, {
				excludePrivateDirectory: true,
			}),
		);

		continuationToken = listResponse.NextContinuationToken;
	} while (continuationToken);

	if (includeCounts) {
		const limit = pLimit(10);
		await Promise.all(
			items
				.filter((item: any) => item.type === "dir")
				.map((item: any) =>
					limit(async () => {
						const childPrefix = `${key ? `${key}/` : ""}${item.name}/`;
						const response = await s3.send(
							new ListObjectsV2Command({
								Bucket: bucket,
								Delimiter: "/",
								Prefix: childPrefix,
							}),
						);
						item.count =
							(response.CommonPrefixes?.length || 0) +
							(response.Contents || []).filter(
								(content: any) => content.Key !== childPrefix,
							).length;
					}),
				),
		);
	}

	return items;
}
