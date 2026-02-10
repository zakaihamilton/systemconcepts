import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3, validatePathAccess } from "@util-legacy/aws";
import { login } from "@util-legacy/login";
import parseCookie from "@util-legacy/cookie";
import { roleAuth } from "@util-legacy/roles";
import { getSafeError } from "@util-legacy/safeError";

export default async function AWS_UPLOAD_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }

        let path = req.query.path || "";

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

        // Validate path traversal
        validatePathAccess(path);

        const s3 = await getS3({});
        // Key should be relative to bucket root.
        const key = path.startsWith('/') ? path.substring(1) : path;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: key,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        res.status(200).json({ url });
    } catch (err) {
        console.error("aws_upload error: ", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}
