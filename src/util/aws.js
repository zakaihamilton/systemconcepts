import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command
} from "@aws-sdk/client-s3";
import { lockMutex } from "@sync/mutex";
import fs from "fs";
import { makePath, isBinaryFile } from "@util/path";
import { getSafeError } from "./safeError";

let s3Client = null;

/**
 * Helper to parse S3 location strings. 
 * Supports "bucket/key" or just "key" (uses default bucket).
 */
function parseUrl(url) {
    if (!url) return [process.env.AWS_BUCKET, ""];
    const parts = url.split("/");
    // If it looks like a full path "bucket/folder/file"
    if (parts.length > 1 && !url.startsWith("/")) {
        return [parts[0], parts.slice(1).join("/")];
    }
    // Default to environment bucket if just a key is provided
    return [process.env.AWS_BUCKET, url];
}

let wasabiClient = null;
let wasabiBucket = null;

async function getWasabi() {
    if (wasabiClient) return { client: wasabiClient, bucket: wasabiBucket };
    const unlock = await lockMutex({ id: "wasabi" });
    if (!wasabiClient) {
        if (!process.env.WASABI_URL) {
            throw new Error("WASABI_URL not defined");
        }
        const wasabiUri = new URL(process.env.WASABI_URL);
        wasabiBucket = wasabiUri.pathname.replace("/", "");
        wasabiClient = new S3Client({
            endpoint: `https://${wasabiUri.host}`,
            region: wasabiUri.searchParams.get("region") || "us-east-1",
            credentials: {
                accessKeyId: decodeURIComponent(wasabiUri.username),
                secretAccessKey: decodeURIComponent(wasabiUri.password),
            },
            forcePathStyle: true,
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED"
        });
    }
    unlock();
    return { client: wasabiClient, bucket: wasabiBucket };
}

function isWasabiPath(path) {
    return path && (path.startsWith("sessions/") || path === "sessions");
}

function getWasabiPath(path) {
    if (path === "sessions") return "";
    return path.substring("sessions/".length);
}

export async function getS3({
    accessKeyId = process.env.AWS_ID,
    secretAccessKey = process.env.AWS_SECRET,
    endpointUrl = process.env.AWS_ENDPOINT
}) {
    // 1. Performance: Check if client exists before locking (Double-Checked Locking)
    if (s3Client) {
        return s3Client;
    }

    if (!accessKeyId) throw new Error("No Access ID");
    if (!secretAccessKey) throw new Error("No Secret Key");
    if (!endpointUrl) throw new Error("No End Point");

    const unlock = await lockMutex({ id: "aws" });

    // Re-check inside lock
    if (!s3Client) {
        // 2. Reliability: Better region fallback than splitting by dot
        const region = process.env.AWS_REGION || (endpointUrl.includes(".") ? endpointUrl.split(".")[1] : "us-east-1");

        s3Client = new S3Client({
            region,
            endpoint: "https://" + endpointUrl,
            credentials: {
                accessKeyId,
                secretAccessKey
            },
            forcePathStyle: true, // Often needed for custom S3 endpoints (MinIO/DigitalOcean/etc)
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED"
        });
    }
    unlock();
    return s3Client;
}

/**
 * Normalize path by removing leading slash
 */
function normalizePath(path) {
    if (!path) return path;
    return path.startsWith('/') ? path.substring(1) : path;
}

/**
 * Validate path access to prevent traversal and restricted folder access
 */
export function validatePathAccess(path) {
    if (!path) return; // Allow empty path (root listing) if logical, or throw if strict.

    // Decode first to ensure %2e%2e is caught as ..
    const decoded = decodeURIComponent(path);
    const normalized = normalizePath(decoded);

    // 3. Security: Robust traversal check
    if (normalized.split("/").includes("..")) {
        throw new Error("ACCESS_DENIED");
    }

    // Block private folder access
    if (normalized.startsWith("private/") || normalized === "private") {
        throw new Error("ACCESS_DENIED");
    }
}

export async function uploadFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const isWasabi = isWasabiPath(to);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(to);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = normalizePath(to);
    }

    // Note: In Next.js (Serverless), 'from' must be in /tmp/ or accessible via fs.
    if (!fs.existsSync(from)) {
        throw new Error(`Source file not found: ${from}`);
    }

    const fileStream = fs.createReadStream(from);
    const uploadParams = {
        Bucket: bucket,
        Key: key,
        Body: fileStream,
        // Note: Check if your bucket blocks public ACLs. If so, remove the line below.
        ACL: "public-read"
    };
    return await s3.send(new PutObjectCommand(uploadParams));
}

export async function downloadFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const isWasabi = isWasabiPath(from);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(from);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = from;
    }

    const downloadParams = {
        Bucket: bucket,
        Key: key
    };

    const response = await s3.send(new GetObjectCommand(downloadParams));

    // 4. Stability: Use pipeline or simple write for Next.js context
    // Direct pipe can be risky if error handling isn't attached to both streams.
    const fileStream = fs.createWriteStream(to);

    // Readable.fromWeb or simple pipe for Node >= 18
    if (response.Body.pipe) {
        response.Body.pipe(fileStream);
    } else {
        // Fallback for some SDK versions or mocked streams
        const buffer = await response.Body.transformToByteArray();
        fs.writeFileSync(to, buffer);
        return;
    }

    await new Promise((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
        response.Body.on("error", reject);
    });
}

export async function uploadData({ path, data, bucketName = process.env.AWS_BUCKET }) {
    const isWasabi = isWasabiPath(path);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(path);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = normalizePath(path);
    }

    const uploadParams = {
        Bucket: bucket,
        Key: key,
        Body: data,
        ACL: "public-read"
    };
    return await s3.send(new PutObjectCommand(uploadParams));
}

export async function downloadData({ path, binary, bucketName = process.env.AWS_BUCKET }) {
    const isWasabi = isWasabiPath(path);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(path);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = normalizePath(path);
    }

    const downloadParams = {
        Bucket: bucket,
        Key: key
    };

    const response = await s3.send(new GetObjectCommand(downloadParams));

    // 5. Memory Optimization: Use SDK built-in transform methods
    if (binary) {
        const uint8Array = await response.Body.transformToByteArray();
        // Convert Uint8Array to Buffer for compatibility with existing code
        return Buffer.from(uint8Array);
    }
    return await response.Body.transformToString();
}

export async function copyFile(from, to) {
    const [fromBucketName, fromPath] = parseUrl(from);
    const [toBucketName, toPath] = parseUrl(to);

    const s3 = await getS3({});

    // CopySource must be URL encoded, but the slash between bucket and key must remain
    const copyParams = {
        Bucket: toBucketName,
        CopySource: `${fromBucketName}/${encodeURIComponent(fromPath)}`,
        Key: toPath
    };
    return await s3.send(new CopyObjectCommand(copyParams));
}

export async function moveFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});

    // 6. Bug Fix: Don't encode the slash between Bucket and Key
    const encodedSource = `${bucketName}/${encodeURIComponent(from)}`;

    const copyParams = {
        Bucket: bucketName,
        CopySource: encodedSource,
        Key: to
    };

    const copyResponse = await s3.send(new CopyObjectCommand(copyParams));
    await deleteFile({ path: from, bucketName });
    return copyResponse;
}

export async function deleteFile({ path, bucketName = process.env.AWS_BUCKET }) {
    const isWasabi = isWasabiPath(path);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(path);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = normalizePath(path);
    }

    const deleteParams = {
        Bucket: bucket,
        Key: key
    };
    return await s3.send(new DeleteObjectCommand(deleteParams));
}

export async function metadataInfo({ path, bucketName = process.env.AWS_BUCKET }) {
    path = normalizePath(path);
    const isWasabi = isWasabiPath(path);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(path);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = path;
    }

    try {
        const headParams = { Bucket: bucket, Key: key };
        const headResponse = await s3.send(new HeadObjectCommand(headParams));
        const name = path.split("/").pop();
        return {
            type: headResponse.ContentType,
            name,
            size: headResponse.ContentLength,
            date: headResponse.LastModified?.valueOf()
        };
    } catch {
        // If file not found, check if it is a folder (CommonPrefixes)
        const listParams = {
            Bucket: bucket,
            Delimiter: "/",
            Prefix: key ? key + "/" : "",
            MaxKeys: 1
        };

        try {
            const listResponse = await s3.send(new ListObjectsV2Command(listParams));
            if ((listResponse.Contents && listResponse.Contents.length > 0) ||
                (listResponse.CommonPrefixes && listResponse.CommonPrefixes.length > 0)) {
                const name = path.split("/").pop();
                return {
                    type: "application/x-directory",
                    name
                };
            }
        } catch {
            // Ignore list errors, return null
        }
    }
    return null;
}

export async function list({ path, bucketName = process.env.AWS_BUCKET }) {
    path = normalizePath(path);
    console.log(`[S3 list] Listing path: ${path}, bucket: ${bucketName}`);

    const isWasabi = isWasabiPath(path);
    let s3, bucket, key;

    if (isWasabi) {
        const wasabi = await getWasabi();
        s3 = wasabi.client;
        bucket = wasabi.bucket;
        key = getWasabiPath(path);
    } else {
        s3 = await getS3({});
        bucket = bucketName;
        key = path;
    }

    const items = [];
    let continuationToken = undefined;

    do {
        const listParams = {
            Bucket: bucket,
            Delimiter: "/",
            Prefix: key ? key + "/" : "",
            ContinuationToken: continuationToken
        };
        console.log(`[S3 list] ListParams:`, listParams);
        const listResponse = await s3.send(new ListObjectsV2Command(listParams));
        console.log(`[S3 list] Response - CommonPrefixes: ${listResponse.CommonPrefixes?.length || 0}, Contents: ${listResponse.Contents?.length || 0}`);

        listResponse.CommonPrefixes?.forEach(prefix => {
            const name = prefix.Prefix.substring(0, prefix.Prefix.length - 1).split("/").pop();
            // Block private folder from listing
            if (name === "private") return;

            items.push({ type: "dir", name });
        });

        listResponse.Contents?.forEach(content => {
            const name = content.Key.split("/").pop();
            if (!name) return;

            const type = content.ContentType === "application/x-directory" ? "dir" : "file";
            items.push({
                name,
                stat: {
                    type,
                    size: content.Size,
                    mtimeMs: content.LastModified && content.LastModified.valueOf()
                }
            });
        });

        continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return items;
}

export async function handleRequest({ readOnly, req, path }) {
    const headers = req.headers || {};

    const resolvePath = () => {
        if (path !== undefined) return path;
        const headerPath = headers.path;
        return headerPath ? decodeURIComponent(headerPath) : headerPath;
    };

    const currentPath = resolvePath();
    console.log(`[handleRequest] Method: ${req.method}, CurrentPath: ${currentPath}, ReadOnly: ${readOnly}`);

    // 7. Security: Always validate path traversal regardless of method
    // (Previously only validated in GET readOnly, allowing PUT/DELETE exploits)
    if (currentPath) {
        validatePathAccess(currentPath);
    }

    if (req.method === "GET") {
        const query = req.query || {};
        let binary = query.binary || headers.binary;
        let type = query.type || headers.type;
        let exists = query.exists || headers.exists;

        if (exists) {
            const metadata = await metadataInfo({ path: currentPath });
            if (metadata) {
                const type = metadata.type === "application/x-directory" ? "dir" : "file";
                return { ...metadata, type };
            }
            return {};
        }

        try {
            if (type === "dir") {
                console.log(`[handleRequest] Listing directory: ${currentPath}`);
                const result = await list({ path: currentPath });
                console.log(`[handleRequest] Directory listing returned ${result?.length || 0} items`);
                return result;
            } else {
                return await downloadData({ path: currentPath, binary });
            }
        } catch (err) {
            if (err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
                return "";
            }
            console.error("get error: ", err);
            return { err: getSafeError(err) };
        }

    } else if (req.method === "PUT") {
        if (readOnly) {
            throw { message: "READ_ONLY_ACCESS", status: 403 };
        }

        // Handle batch uploads
        const items = Array.isArray(req.body) ? req.body : [req.body]; // Handle single or array

        for (const item of items) {
            let { body, path: itemPath } = item;

            // Validate specific item path
            validatePathAccess(itemPath);

            if (typeof body === "string" && isBinaryFile(itemPath)) {
                body = Buffer.from(body, "base64");
            }
            await uploadData({ path: itemPath, data: body });
        }
        return { success: true };

    } else if (req.method === "DELETE") {
        if (readOnly) {
            throw { message: "READ_ONLY_ACCESS", status: 403 };
        }
        // validatePathAccess was already called on 'currentPath' at start of function
        await deleteFile({ path: currentPath });
        return { success: true };
    }
}