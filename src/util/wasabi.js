import { S3Client, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { lockMutex } from "@sync/mutex";

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

function normalizePath(path) {
    if (!path) return path;
    return path.startsWith('/') ? path.substring(1) : path;
}

export async function downloadData({ path, binary }) {
    const { client, bucket } = await getWasabi();
    const key = normalizePath(path);

    const downloadParams = {
        Bucket: bucket,
        Key: key
    };

    const response = await client.send(new GetObjectCommand(downloadParams));

    if (binary) {
        const uint8Array = await response.Body.transformToByteArray();
        return Buffer.from(uint8Array);
    }
    return await response.Body.transformToString();
}

export async function metadataInfo({ path }) {
    const key = normalizePath(path);
    const { client, bucket } = await getWasabi();

    try {
        const headParams = { Bucket: bucket, Key: key };
        const headResponse = await client.send(new HeadObjectCommand(headParams));
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
            const listResponse = await client.send(new ListObjectsV2Command(listParams));
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

export async function list({ path }) {
    const key = normalizePath(path);
    const { client, bucket } = await getWasabi();

    const items = [];
    let continuationToken = undefined;

    do {
        const listParams = {
            Bucket: bucket,
            Delimiter: "/",
            Prefix: key ? key + "/" : "",
            ContinuationToken: continuationToken
        };
        const listResponse = await client.send(new ListObjectsV2Command(listParams));

        listResponse.CommonPrefixes?.forEach(prefix => {
            const name = prefix.Prefix.substring(0, prefix.Prefix.length - 1).split("/").pop();
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

export async function handleRequest({ req, path }) {
    const headers = req.headers || {};

    const resolvePath = () => {
        if (path !== undefined) return path;
        const headerPath = headers.path;
        return headerPath ? decodeURIComponent(headerPath) : headerPath;
    };

    const currentPath = resolvePath();

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

        if (type === "dir") {
            return await list({ path: currentPath });
        } else {
            return await downloadData({ path: currentPath, binary });
        }
    } else {
        throw { message: "READ_ONLY_ACCESS", status: 403 };
    }
}
