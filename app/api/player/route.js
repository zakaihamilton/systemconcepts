import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { metadataInfo as awsMetadataInfo, validatePathAccess } from "@util/aws";
import { getWasabi } from "@util/wasabi";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error, log } from "@util/logger";
import { getSafeError } from "@util/safeError";

export const dynamic = "force-dynamic";

const component = "player";

export async function GET(request) {
    try {
        const { client: wasabiClient, bucket: BUCKET_NAME } = await getWasabi();
        const cookieHeader = request.headers.get("cookie") || "";
        const path = request.headers.get("path") || "";

        if (!cookieHeader) throw "ACCESS_DENIED";
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};
        const user = await login({ id, hash, api: "player" });
        if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        let decodedPath = decodeURIComponent(path);
        validatePathAccess(decodedPath);
        let s3Key = decodedPath.startsWith("/") ? decodedPath.substring(1) : decodedPath;

        const prefix = "sessions/";
        if (s3Key.startsWith(prefix)) {
            s3Key = s3Key.substring(prefix.length);
        } else if (s3Key.startsWith("wasabi/")) {
            s3Key = s3Key.substring("wasabi/".length);
        }

        const fileName = s3Key.split("/").pop();

        const playerCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ResponseContentDisposition: "inline"
        });
        const playerUrl = await getSignedUrl(wasabiClient, playerCommand, { expiresIn: 10800 });

        const downloadCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ResponseContentDisposition: `attachment; filename="${fileName}"`
        });
        const downloadUrl = await getSignedUrl(wasabiClient, downloadCommand, { expiresIn: 10800 });

        let subtitles = null;
        let transcriptionUrl = null;
        const dotIndex = s3Key.lastIndexOf(".");
        if (dotIndex !== -1) {
            const vttPath = s3Key.substring(0, dotIndex) + ".vtt";
            const exists = await awsMetadataInfo({ path: "sessions/" + vttPath });
            if (exists) {
                subtitles = "/api/subtitle?path=" + encodeURIComponent("sessions/" + vttPath);
            }
            const txtPath = s3Key.substring(0, dotIndex) + ".txt";
            const txtCommand = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: txtPath,
                ResponseContentDisposition: `attachment; filename="${fileName.substring(0, fileName.lastIndexOf("."))}.txt"`
            });
            transcriptionUrl = await getSignedUrl(wasabiClient, txtCommand, { expiresIn: 10800 });
        }

        log({ component, message: `User ${id} generated player & download URLs for: ${s3Key}` });

        return NextResponse.json({ path: playerUrl, downloadUrl, subtitles, transcriptionUrl });
    } catch (err) {
        error({ component, error: "Access Error", err });
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}
