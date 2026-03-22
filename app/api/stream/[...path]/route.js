import { NextResponse } from "next/server";
import { getWasabi } from "@util/wasabi";
import { getS3 } from "@util/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
    try {
        const fullPath = (params.path || []).join("/");
        // Extract the base64url portion safely (before the file extension)
        const lastDot = fullPath.lastIndexOf(".");
        let base64str = lastDot > 0 ? fullPath.substring(0, lastDot) : fullPath;
        if (!base64str) {
            return new NextResponse("Not Found", { status: 404 });
        }
        
        // Reverse base64url
        base64str = base64str.replace(/-/g, '+').replace(/_/g, '/');
        const path = Buffer.from(base64str, 'base64').toString('utf8');

        let s3Key = path;
        let client, bucket;
        if (s3Key.startsWith("wasabi/")) {
            const wasabi = await getWasabi();
            client = wasabi.client;
            bucket = wasabi.bucket;
            s3Key = s3Key.replace(/^wasabi\//, "");
        } else {
            client = await getS3({});
            bucket = process.env.AWS_BUCKET;
        }

        const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
        // Generate a fresh presigned URL valid for 24 hours
        let signedStr = await getSignedUrl(client, command, { expiresIn: 86400 });

        // 302 Redirect effectively hides the query string from over-strict podcast validators
        // and returns a clean URL ending in .m4a
        return NextResponse.redirect(signedStr, 302);
    } catch (err) {
        console.error("Stream redirect error:", err);
        return new NextResponse("Error generating media URL", { status: 500 });
    }
}
