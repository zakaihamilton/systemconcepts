const AWS = require("aws-sdk");
const { lockMutex } = require("./mutex");
const fs = require("fs");

let s3Object = null;

const bufferSize = 10 * 1024 * 1024;

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
    if (!s3Object) {
        const endpoint = new AWS.Endpoint(endpointUrl);
        s3Object = new AWS.S3({
            endpoint,
            accessKeyId,
            secretAccessKey
        });
    }
    unlock();
    return s3Object;
}

export async function uplodFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        Key: to,
        Body: fs.createReadStream(from),
        ACL: "public-read"
    };
    var options = {
        partSize: bufferSize,
        queueSize: 10
    };
    const s3 = await getS3({});
    return await s3.upload(params, options).promise();
};

export async function downloadFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        Key: from
    };
    const writeStream = fs.createWriteStream(to);
    const s3 = await getS3({});
    return new Promise((resolve, reject) => {
        let readStream = s3.getObject(params).createReadStream({ bufferSize: bufferSize });
        readStream.on("error", reject);
        readStream.on("end", resolve);
        readStream.pipe(writeStream);
    });
};

export async function uploadData({ path, data, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        Key: path,
        Body: data,
        ACL: "public-read"
    };
    var options = {
        partSize: bufferSize,
        queueSize: 10
    };
    const s3 = await getS3({});
    const result = await s3.upload(params, options).promise();
    return result;
};

export async function downloadData({ path, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3({});
    const data = await s3.getObject(params).promise();
    return data.Body.toString();
};

export async function copyFile(from, to) {
    const [fromBucketName, fromPath] = parseUrl(from);
    const [toBucketName, toPath] = parseUrl(to);
    var params = {
        Bucket: toBucketName,
        CopySource: fromBucketName + "/" + fromPath,
        Key: toPath
    };
    const s3 = await getS3({});
    const data = await s3.copyObject(params).promise();
    return data;
};

export async function moveFile({ from, to, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        CopySource: encodeURIComponent(bucketName + "/" + from),
        Key: to
    };
    const s3 = await getS3({});
    const data = await s3.copyObject(params).promise();
    await deleteFile(from);
    return data;
};

export async function deleteFile({ path, bucketName = process.env.AWS_BUCKET }) {
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3({});
    const data = await s3.deleteObject(params).promise();
    return data;
};

export async function metadataInfo({ path, bucketName = process.env.AWS_BUCKET }) {
    const name = path.split("/").pop();
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3({});
    try {
        const data = await s3.headObject(params).promise();
        return {
            type: data.ContentType,
            name,
            size: data.ContentLength,
            date: data.LastModified.valueOf()
        };
    }
    catch (err) {
        const params = {
            Bucket: bucketName,
            Delimiter: "/",
            ...path && { Prefix: path + "/" }
        };
        const result = await s3.listObjects(params).promise();
        if (result.Contents.length > 0 || result.CommonPrefixes.length > 0) {
            return {
                type: "application/x-directory",
                name
            };
        }
    }
    return null;
};

export async function list({ path, bucketName = process.env.AWS_BUCKET }) {
    const params = {
        Bucket: bucketName,
        Delimiter: "/",
        ...path && { Prefix: path + "/" }
    };
    const s3 = await getS3({});
    const items = [];
    for (; ;) {
        const result = await s3.listObjects(params).promise();
        result.CommonPrefixes.forEach(prefix => {
            const name = prefix.Prefix.substring(0, prefix.Prefix.length - 1).split("/").pop();
            items.push({
                type: "dir",
                name
            });
        });
        result.Contents.forEach(content => {
            const name = content.Key.split("/").pop();
            if (!name) {
                return;
            }
            const type = content.ContentType === "application/x-directory" ? "dir" : "file";
            const stat = {
                type,
                size: content.ContentLength,
                mtimeMs: item.date && new Date(content.LastModified.valueOf()).getTime()
            };
            items.push({
                name: item.name,
                stat
            });
        });
        if (result.IsTruncated && result.NextMarker) {
            params.Marker = result.NextMarker;
        }
        else {
            break;
        }
    }
    return items;
};

export function cdnUrl(path) {
    let tokens = path.split("/");
    tokens.shift();
    let fileName = tokens.pop();
    path = tokens.join("/");
    var url = "https://" + process.env.AWS_CDN + "/" + path + "/" + encodeURIComponent(fileName);
    return url;
};

export async function handleRequest({ readOnly, req }) {
    const headers = req.headers || {};
    if (req.method === "HEAD") {
        const { path } = headers;
        const metadata = await metadataInfo({ path });
        if (metadata) {
            const type = metadata.type === "application/x-directory" ? "dir" : "file";
            return {
                ...metadata,
                type
            };
        }
        return {};
    } else if (req.method === "GET") {
        try {
            let { path } = headers;
            path = decodeURIComponent(path);
            const metadata = await metadataInfo({ path });
            if (metadata) {
                const type = metadata.type === "application/x-directory" ? "dir" : "file";
                if (type === "dir") {
                    const items = await list({ path, useCount: true });
                    return items;
                }
                else {
                    return await downloadData({ path });
                }
            }
            else {
                return "";
            }
        }
        catch (err) {
            console.error("get error: ", err);
            return { err: err.toString() };
        }
    } else if (!readOnly && req.method === "PUT") {
        await uploadData({ path, data: req.body });
    } else if (!readOnly && req.method === "DELETE") {
        const { path } = headers;
        await deleteFile({ path: decodeURIComponent(path) });
    }
}
