import { NextResponse } from "next/server";
import { getWasabi } from "@util/wasabi";
import { getS3 } from "@util/aws";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const dynamic = "force-dynamic";

async function handleRequest(request) {
    try {
        const { searchParams } = new URL(request.url);
        let base64str = searchParams.get("p") || "";
        if (!base64str) {
            return new NextResponse("Not Found", { status: 404 });
        }
        
        // Convert base64url characters back to standard base64 for Buffer.from
        base64str = base64str.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if necessary
        while (base64str.length % 4 !== 0) {
            base64str += '=';
        }
        
        let path;
        try {
            path = Buffer.from(base64str, 'base64').toString('utf8');
        } catch (e) {
            return new NextResponse("Invalid Path", { status: 400 });
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

        if (request.method === "HEAD") {
            try {
                const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: s3Key });
                const headData = await client.send(headCommand);
                
                // Determine the correct Content-Type, prioritizing the extension hint from 'e'
                const extHint = (searchParams.get("e") || "").toLowerCase();
                let contentType = headData.ContentType || "application/octet-stream";
                
                if (extHint.endsWith(".m4a")) {
                    contentType = "audio/x-m4a";
                } else if (extHint.endsWith(".mp4")) {
                    contentType = "video/mp4";
                } else if (extHint.endsWith(".mp3")) {
                    contentType = "audio/mpeg";
                } else if (extHint.endsWith(".vtt")) {
                    contentType = "text/vtt";
                } else if (extHint.endsWith(".txt")) {
                    contentType = "text/plain";
                }

                return new NextResponse(null, {
                    status: 200,
                    headers: {
                        "Content-Type": contentType,
                        "Content-Length": headData.ContentLength?.toString() || "0",
                        "Accept-Ranges": "bytes",
                        "Last-Modified": headData.LastModified?.toUTCString() || "",
                        "ETag": headData.ETag || "",
                    }
                });
            } catch (err) {
                console.warn("[RSS S Proxy] HEAD failed:", s3Key, err.message);
            }
        }

        const getCommand = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
        const signedStr = await getSignedUrl(client, getCommand, { expiresIn: 86400 });

        return NextResponse.redirect(signedStr, 302);
    } catch (err) {
        console.error("[RSS S Proxy] Unexpected error:", err);
        return new NextResponse("Error generating media URL", { status: 500 });
    }
}

export async function GET(request) {
    return handleRequest(request);
}

export async function HEAD(request) {
    return handleRequest(request);
}
