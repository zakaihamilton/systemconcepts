"use server";
import { cdnUrl, metadataInfo, validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error as logError, log } from "@util/logger";
import { getSafeError } from "@util/safeError";
import { headers } from "next/headers";

const component = "player";

export async function getPlayerMetadata({ path }) {
    try {
        const h = await headers();
        const cookie = h.get("cookie");
        if (!cookie) {
            logError({ component, error: "Empty cookie provided", throwError: false });
            throw "ACCESS_DENIED";
        }
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            logError({ component, error: "No ID or hash provided in cookies", throwError: false });
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "player" });
        if (!user) {
            logError({ component, error: `Cannot authorize user: ${id} in system`, throwError: false });
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            logError({ component, error: `User: ${id} does not match the student role. role is: ${user.role}`, throwError: false });
            throw "ACCESS_DENIED";
        }

        validatePathAccess(path);
        const sessionUrl = cdnUrl(path);
        let subtitles = null;
        const dotIndex = path.lastIndexOf(".");
        if (dotIndex !== -1) {
            const vttPath = path.substring(0, dotIndex) + ".vtt";
            const s3Key = vttPath.startsWith("/") ? vttPath.substring(1) : vttPath;
            const exists = await metadataInfo({ path: s3Key });
            if (exists) {
                subtitles = "/api/subtitle?path=" + encodeURIComponent(s3Key);
            }
        }
        log({ component, message: `User ${id} is playing session: ${sessionUrl}` });
        return { path: sessionUrl, subtitles };
    }
    catch (err) {
        logError({ component, error: "login error", err, throwError: false });
        return { err: getSafeError(err) };
    }
}
