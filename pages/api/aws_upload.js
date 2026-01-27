import { streamUpload } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export default async function AWS_UPLOAD_API(req, res) {
    try {
        if (req.method !== "PUT") {
            res.setHeader("Allow", "PUT");
            res.status(405).end("Method Not Allowed");
            return;
        }

        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }

        let path = req.query?.path || "";
        if (path) {
            path = decodeURIComponent(path);
        }

        const user = await login({ id, hash, api: "aws_upload", path });
        if (!user) {
            console.log(`[AWS UPLOAD API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }

        console.log(`[AWS UPLOAD API] User: ${user.id}, Role: ${user.role}, Path: ${path}`);

        const isAdmin = roleAuth(user.role, "admin");
        const isStudent = roleAuth(user.role, "student");
        let readOnly = true;
        const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

        if (isAdmin) {
            readOnly = false;
        } else if (isStudent) {
            const isPersonalPath = checkPath.startsWith(`personal/${user.id}/`) || checkPath === `personal/${user.id}`;
            // Only allow writes to personal path for students
             if (isPersonalPath) {
                readOnly = false;
            } else {
                console.log(`[AWS UPLOAD API] ACCESS DENIED: User ${user.id} cannot write to path: ${path}`);
                throw new Error(`ACCESS_DENIED: ${user.id} cannot write to this path: ${path}`);
            }
        } else {
            throw "ACCESS_DENIED: " + user.id + " is not authorized";
        }

        if (readOnly) {
            throw { message: "READ_ONLY_ACCESS", status: 403 };
        }

        await streamUpload({ req, path });

        res.status(200).json({ success: true });

    } catch (err) {
        console.error("aws upload error: ", err);
        res.status(err.status || 403).json({ err: getSafeError(err.message || err) });
    }
}

export const config = {
    api: {
        bodyParser: false,
    }
};
