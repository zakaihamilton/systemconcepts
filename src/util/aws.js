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
    if (!endpoint) {
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

export function parseUrl(path) {
    if (path.startsWith("/")) {
        path = path.substring(1);
    }
    let tokens = path.split("/");
    let bucketName = tokens.shift();
    path = tokens.join("/");
    return [bucketName, path];
};

export async function uplodFile(from, to) {
    const [bucketName, path] = parseUrl(to);
    var params = {
        Bucket: bucketName,
        Key: path,
        Body: fs.createReadStream(from),
        ACL: "public-read"
    };
    var options = {
        partSize: bufferSize,
        queueSize: 10
    };
    const s3 = await getS3();
    return await s3.upload(params, options).promise();
};

export async function downloadFile(from, to) {
    const [bucketName, path] = parseUrl(from);
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const writeStream = fs.createWriteStream(to);
    const s3 = await getS3();
    return new Promise((resolve, reject) => {
        let readStream = s3.getObject(params).createReadStream({ bufferSize: bufferSize });
        readStream.on("error", reject);
        readStream.on("end", resolve);
        readStream.pipe(writeStream);
    });
};

export async function uploadData(url, data) {
    const [bucketName, path] = parseUrl(url);
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
    const s3 = await getS3();
    const data = await s3.upload(params, options).promise();
    return data;
};

export async function downloadData(url) {
    const [bucketName, path] = parseUrl(url);
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3();
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
    const s3 = await getS3();
    const data = await s3.copyObject(params).promise();
    return data;
};

export async function moveFile(from, to) {
    const [fromBucketName, fromPath] = parseUrl(from);
    const [toBucketName, toPath] = parseUrl(to);
    var params = {
        Bucket: toBucketName,
        CopySource: encodeURIComponent(fromBucketName + "/" + fromPath),
        Key: toPath
    };
    const s3 = await getS3();
    const data = await s3.copyObject(params).promise();
    await deleteFile(from);
    return data;
};

export async function deleteFile(url) {
    const [bucketName, path] = parseUrl(url);
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3();
    const data = await s3.deleteObject(params).promise();
    return data;
};

export async function metadata(url) {
    const [bucketName, path] = parseUrl(url);
    const name = core.path.fileName(url, true);
    if (!path) {
        return {
            type: "application/x-directory",
            name: bucketName
        };
    }
    var params = {
        Bucket: bucketName,
        Key: path
    };
    const s3 = await getS3();
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

export async function list(url) {
    const [bucketName, path] = parseUrl(url);
    const params = {
        Bucket: bucketName,
        Delimiter: "/",
        ...path && { Prefix: path + "/" }
    };
    const s3 = await getS3();
    if (!bucketName) {
        const result = await s3.listBuckets({}).promise();
        var buckets = [];
        result.Buckets.forEach(function (element) {
            buckets.push({
                name: element.Name,
                type: "bucket"
            });
        });
        return buckets;
    }
    const items = [];
    for (; ;) {
        const result = await s3.listObjects(params).promise();
        result.CommonPrefixes.forEach(prefix => {
            const name = core.path.fileName(prefix.Prefix.substring(0, prefix.Prefix.length - 1), true);
            items.push({
                type: "application/x-directory",
                name
            });
        });
        result.Contents.forEach(content => {
            const folder = core.path.folderPath(content.Key);
            if (path !== folder) {
                return;
            }
            const name = core.path.fileName(content.Key, true);
            if (!name) {
                return;
            }
            items.push({
                type: content.ContentType,
                name,
                size: content.ContentLength,
                date: content.LastModified.valueOf()
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

export function url(path) {
    let tokens = path.split("/");
    tokens.shift();
    let fileName = tokens.pop();
    path = tokens.join("/");
    var url = "https://" + process.env.AWS_CDN + "/" + path + "/" + encodeURIComponent(fileName);
    return url;
};
