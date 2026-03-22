import { getS3 } from "./src/util/aws.js";
import { getWasabi } from "./src/util/wasabi.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import 'dotenv/config';

async function testEnclosure() {
    const session = {
        audio: {
            path: "/wasabi/ana/2026/2026-03-20 Guilt.m4a",
            size: 123456
        }
    };

    const media = session.audio || session.video;
    if (media && media.path) {
        const s3Key = media.path.startsWith("/") ? media.path.substring(1) : media.path;
        let client, bucket;
        if (s3Key.startsWith("wasabi/")) {
            const wasabi = await getWasabi();
            client = wasabi.client;
            bucket = wasabi.bucket;
        } else {
            client = await getS3({});
            bucket = process.env.AWS_BUCKET;
        }
        const key = s3Key.replace(/^wasabi\//, "");
        console.log("Key:", key);
        console.log("Bucket:", bucket);
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const signedUrl = await getSignedUrl(client, command, { expiresIn: 86400 });
        console.log("Signed URL generated successfully.");
        console.log("URL prefix:", signedUrl.substring(0, 100) + "...");
    }
}

testEnclosure().catch(console.error);
