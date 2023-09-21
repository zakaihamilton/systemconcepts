import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { lockMutex } from "./mutex";
import fs from "fs";
import { makePath } from "@util/path";

let s3Client = null;

export async function getS3({ accessKeyId = process.env.AWS_ID, secretAccessKey = process.env.AWS_SECRET, endpointUrl = process.env.AWS_ENDPOINT }) {
    if (!accessKeyId) {
        throw "No Access ID";
    }
    if (!secretAccessKey) {
        throw "No Secret Key";
    }
    if (!endpointUrl) {
        throw "No End Point";
    }
    const unlock = await lockMutex({ id: "aws" });
    if (!s3Client) {
        s3Client = new S3Client({
            region: endpointUrl.split(".")[1],
            endpoint: "https://" + endpointUrl,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });
    }
    unlock();
    return s3Client;
}

export async function uploadFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const fileStream = fs.createReadStream(from);
    const uploadParams = {
        Bucket: bucketName,
        Key: to,
        Body: fileStream,
        ACL: "public-read"
    };
    const response = await s3.send(new PutObjectCommand(uploadParams));
    return response;
}

export async function downloadFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const fileStream = fs.createWriteStream(to);
    const downloadParams = {
        Bucket: bucketName,
        Key: from
    };
    const response = await s3.send(new GetObjectCommand(downloadParams));
    response.Body.pipe(fileStream);
    await new Promise((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
    });
}

export async function uploadData({ path, data, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const uploadParams = {
        Bucket: bucketName,
        Key: path,
        Body: data,
        ACL: "public-read"
    };
    const response = await s3.send(new PutObjectCommand(uploadParams));
    return response;
}

export async function downloadData({ path, binary, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const downloadParams = {
        Bucket: bucketName,
        Key: path
    };
    const response = await s3.send(new GetObjectCommand(downloadParams));
    const data = await new Promise((resolve, reject) => {
        const chunks = [];
        response.Body.on("data", (chunk) => chunks.push(chunk));
        response.Body.on("end", () => resolve(Buffer.concat(chunks)));
        response.Body.on("error", reject);
    });
    if (binary) {
        return data;
    }
    return data.toString();
}

export async function copyFile(from, to) {
    const [fromBucketName, fromPath] = parseUrl(from);
    const [toBucketName, toPath] = parseUrl(to);
    const s3 = await getS3({});
    const copyParams = {
        Bucket: toBucketName,
        CopySource: `${fromBucketName}/${fromPath}`,
        Key: toPath
    };
    const response = await s3.send(new CopyObjectCommand(copyParams));
    return response;
}

export async function moveFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const copyParams = {
        Bucket: bucketName,
        CopySource: encodeURIComponent(`${bucketName}/${from}`),
        Key: to
    };
    const copyResponse = await s3.send(new CopyObjectCommand(copyParams));
    await deleteFile({ path: from, bucketName });
    return copyResponse;
}

export async function deleteFile({ path, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const deleteParams = {
        Bucket: bucketName,
        Key: path
    };
    const response = await s3.send(new DeleteObjectCommand(deleteParams));
    return response;
}

export async function metadataInfo({ path, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const headParams = {
        Bucket: bucketName,
        Key: path
    };
    try {
        const headResponse = await s3.send(new HeadObjectCommand(headParams));
        const name = path.split("/").pop();
        return {
            type: headResponse.ContentType,
            name,
            size: headResponse.ContentLength,
            date: headResponse.LastModified.valueOf()
        };
    } catch (err) {
        const listParams = {
            Bucket: bucketName,
            Delimiter: "/",
            ...(path && { Prefix: path + "/" })
        };
        const listResponse = await s3.send(new ListObjectsCommand(listParams));
        if (listResponse?.Contents.length > 0 || listResponse?.CommonPrefixes.length > 0) {
            const name = path.split("/").pop();
            return {
                type: "application/x-directory",
                name
            };
        }
    }
    return null;
}

export async function list({ path, bucketName = process.env.AWS_BUCKET }) {
    const s3 = await getS3({});
    const items = [];
    let continuationToken = undefined;
    do {
        const listParams = {
            Bucket: bucketName,
            Delimiter: "/",
            ...(path && { Prefix: path + "/" }),
            ContinuationToken: continuationToken
        };
        const listResponse = await s3.send(new ListObjectsV2Command(listParams));
        listResponse.CommonPrefixes?.forEach(prefix => {
            const name = prefix.Prefix.substring(0, prefix.Prefix.length - 1).split("/").pop();
            if (name === "private") {
                return;
            }
            items.push({
                type: "dir",
                name
            });
        });
        listResponse.Contents?.forEach(content => {
            const name = content.Key.split("/").pop();
            if (!name) {
                return;
            }
            const type = content.ContentType === "application/x-directory" ? "dir" : "file";
            const stat = {
                type,
                size: content.Size,
                mtimeMs: content.LastModified && content.LastModified.valueOf()
            };
            items.push({
                name,
                stat
            });
        });
        continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
    return items;
}

export function cdnUrl(path) {
    let tokens = makePath(path).split("/");
    tokens.shift();
    let fileName = tokens.pop();
    path = tokens.join("/");
    const url = `https://${makePath(process.env.AWS_CDN, path, encodeURIComponent(fileName))}`;
    return url;
}

export async function handleRequest({ readOnly, req }) {
    const headers = req.headers || {};
    if (req.method === "GET") {
        let { path, binary, type, exists } = headers;
        if (exists) {
            path = decodeURIComponent(path);
            const metadata = await metadataInfo({ path });
            if (metadata) {
                const type = metadata.type === "application/x-directory" ? "dir" : "file";
                return {
                    ...metadata,
                    type
                };
            }
            return {};
        }
        try {
            path = decodeURIComponent(path);
            if (type === "dir") {
                const items = await list({ path, useCount: true });
                return items;
            }
            else {
                return await downloadData({ path, binary });
            }
        }
        catch (err) {
            console.error("get error: ", err);
            return { err: err.toString() };
        }
    } else if (!readOnly && req.method === "PUT") {
        for (const item of req.body) {
            await uploadData({ path: item.path, data: item.body });
        }
    } else if (!readOnly && req.method === "DELETE") {
        const { path } = headers;
        await deleteFile({ path: decodeURIComponent(path) });
    }
}
