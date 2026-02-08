import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3, validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";
import { NextResponse } from "next/server";

export async function GET(req) {
    try {
        const headers = req.headers;
        const cookie = headers.get("cookie");
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};

        if (!id || !hash) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }

        const path = req.nextUrl.searchParams.get("path") || "";

        if (!path) {
            console.log(`[AWS UPLOAD API] INVALID_PATH: No path provided`);
            throw "INVALID_PATH";
        }

        const user = await login({ id, hash, api: "aws_upload", path });
        if (!user) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }

        const isAdmin = roleAuth(user.role, "admin");
        const isStudent = roleAuth(user.role, "student");
        let allowed = false;

        const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

        if (isAdmin) {
            allowed = true;
        } else if (isStudent) {
            const isPersonalPath = checkPath.startsWith(`personal/${user.id}/`) || checkPath === `personal/${user.id}`;
             if (isPersonalPath) {
                allowed = true;
             }
        }

        if (!allowed) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: User ${user.id} cannot write to path: ${path}`);
            throw "ACCESS_DENIED: " + user.id + " cannot write to this path: " + path;
        }

        validatePathAccess(path);

        const s3 = await getS3({});
        const key = path.startsWith('/') ? path.substring(1) : path;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: key,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return NextResponse.json({ url });
    } catch (err) {
        console.error("aws_upload error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}
