import { NextResponse } from "next/server";
import { getWasabi } from "@util/wasabi";
import { getS3 } from "@util/aws";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
    try {
        const pathSegments = params.path || [];
        // Reconstruct the S3 object key safely by joining decoded path segments
        const path = pathSegments.map(decodeURIComponent).join("/");
        if (!path) {
            return new NextResponse("Not Found", { status: 404 });
        }

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
        
        // Preserve proper percent-encoding format in the redirected URL path
        let url;
        try {
            url = new URL(signedStr);
            url.pathname = url.pathname.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment))).join("/");
            signedStr = url.toString();
        } catch {
            // fallback
        }

        // 302 Redirect effectively hides the query string from over-strict podcast validators
        // and returns a clean URL ending in .m4a
        return NextResponse.redirect(signedStr, 302);
    } catch (err) {
        console.error("Media redirect error:", err);
        return new NextResponse("Error generating media URL", { status: 500 });
    }
}
