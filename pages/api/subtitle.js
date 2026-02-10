import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error } from "@util/logger";

const component = "subtitle";

// 1. Initialize S3 Client from WASABI_URL
const wasabiUri = new URL(process.env.WASABI_URL);
const s3Client = new S3Client({
    endpoint: `https://${wasabiUri.host}`,
    region: wasabiUri.searchParams.get("region") || "us-east-1",
    credentials: {
        accessKeyId: decodeURIComponent(wasabiUri.username),
        secretAccessKey: decodeURIComponent(wasabiUri.password),
    },
});
const BUCKET_NAME = wasabiUri.pathname.replace("/", "");

export default async function SUBTITLE_API(req, res) {
    try {
        const { query, headers } = req;
        const { path } = query;
        const { cookie } = headers || {};

        // 2. Auth Gate
        if (!cookie) throw "ACCESS_DENIED";
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        const user = await login({ id, hash, api: "subtitle" });
        if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        // 3. Path Cleaning (Option 2: Strip 'sessions/')
        let decodedPath = decodeURIComponent(path);
        let s3Key = decodedPath.startsWith("/") ? decodedPath.substring(1) : decodedPath;

        const prefix = "sessions/";
        if (s3Key.startsWith(prefix)) {
            s3Key = s3Key.substring(prefix.length);
        }

        validatePathAccess(s3Key);

        // 4. Fetch and Stream Data from Wasabi
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        });

        const response = await s3Client.send(command);

        // Set the correct header for subtitles
        res.setHeader("Content-Type", "text/vtt");

        // Pipe the body stream directly to the response
        // In Node.js SDK v3, response.Body is a Readable stream
        return response.Body.pipe(res);

    } catch (err) {
        error({ component, error: "Subtitle fetch error", err });
        // Return 404 if file doesn't exist or access is denied
        res.status(404).end();
    }
}