import { cdnUrl, metadataInfo, validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error, log } from "@util/logger";
import { getSafeError } from "@util/safeError";

const component = "player";

export default async function PLAYER_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie, path } = headers || {};
        if (!cookie) {
            error({ component, error: "Empty cookie provided" });
            throw "ACCESS_DENIED";
        }
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            error({ component, error: "No ID or hash provided in cookies" });
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "player" });
        if (!user) {
            error({ component, error: `Cannot authorize user: ${id} in system` });
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            error({ component, error: `User: ${id} does not match the student role. role is: ${user.role}` });
            throw "ACCESS_DENIED";
        }
        const decodedPath = decodeURIComponent(path);
        validatePathAccess(decodedPath);
        const sessionUrl = cdnUrl(decodedPath);
        let subtitles = null;
        const dotIndex = decodedPath.lastIndexOf(".");
        if (dotIndex !== -1) {
            const vttPath = decodedPath.substring(0, dotIndex) + ".vtt";
            const s3Key = vttPath.startsWith("/") ? vttPath.substring(1) : vttPath;
            const exists = await metadataInfo({ path: s3Key });
            if (exists) {
                subtitles = "/api/subtitle?path=" + encodeURIComponent(s3Key);
            }
        }
        log({ component, message: `User ${id} is playing session: ${decodeURIComponent(sessionUrl)}` });
        res.status(200).json({ path: sessionUrl, subtitles });
    }
    catch (err) {
        error({ component, error: "login error", err });
        res.status(403).json({ err: getSafeError(err) });
    }
}
