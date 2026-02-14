import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { metadataInfo as awsMetadataInfo } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error, log } from "@util/logger";
import { getSafeError } from "@util/safeError";

const component = "player";

// Wasabi client for signed URLs (Read-only)
const wasabiUri = new URL(process.env.WASABI_URL);
const wasabiClient = new S3Client({
    endpoint: `https://${wasabiUri.host}`,
    region: wasabiUri.searchParams.get("region") || "us-east-1",
    credentials: {
        accessKeyId: decodeURIComponent(wasabiUri.username),
        secretAccessKey: decodeURIComponent(wasabiUri.password),
    },
});
const BUCKET_NAME = wasabiUri.pathname.replace("/", "");

export default async function PLAYER_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie, path } = headers || {};

        if (!cookie) throw "ACCESS_DENIED";
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        const user = await login({ id, hash, api: "player" });
        if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        let decodedPath = decodeURIComponent(path);
        let s3Key = decodedPath.startsWith("/") ? decodedPath.substring(1) : decodedPath;

        const prefix = "sessions/";
        if (s3Key.startsWith(prefix)) {
            s3Key = s3Key.substring(prefix.length);
        }

        const fileName = s3Key.split('/').pop();

        // 1. Generate Player URL (Inline) from Wasabi
        const playerCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ResponseContentDisposition: 'inline'
        });
        const playerUrl = await getSignedUrl(wasabiClient, playerCommand, { expiresIn: 10800 });

        // 2. Generate Download URL (Attachment) from Wasabi
        const downloadCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ResponseContentDisposition: `attachment; filename="${fileName}"`
        });
        const downloadUrl = await getSignedUrl(wasabiClient, downloadCommand, { expiresIn: 10800 });

        // 3. Subtitles Logic (DigitalOcean)
        let subtitles = null;
        const dotIndex = s3Key.lastIndexOf(".");
        if (dotIndex !== -1) {
            const vttPath = s3Key.substring(0, dotIndex) + ".vtt";
            // Check existence on DigitalOcean
            const exists = await awsMetadataInfo({ path: "sessions/" + vttPath });
            if (exists) {
                subtitles = "/api/subtitle?path=" + encodeURIComponent("sessions/" + vttPath);
            }
        }

        log({ component, message: `User ${id} generated player & download URLs for: ${s3Key}` });

        res.status(200).json({
            path: playerUrl,
            downloadUrl: downloadUrl,
            subtitles
        });

    } catch (err) {
        error({ component, error: "Access Error", err });
        res.status(403).json({ err: getSafeError(err) });
    }
}