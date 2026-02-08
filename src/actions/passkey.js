"use server";
import { getSafeError } from "@util/safeError";
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeyAuthOptions, verifyPasskeyAuth, getPasskeys, deletePasskey as deletePasskeyUtil } from "@util/passkey";
import { login } from "@util/login";
import { headers } from "next/headers";
import parseCookie from "@util/cookie";
import { getIP } from "@util/network";
import { checkRateLimit } from "@util/rateLimit";

export async function registerOptions({ id, email, firstName, lastName }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);

        const h = await headers();
        const host = h.get("x-forwarded-host") || h.get("host");
        const rpID = host.split(":")[0];

        let authenticated = false;
        const cookie = h.get("cookie");
        const cookies = parseCookie(cookie);
        const hash = h.get("hash") || cookies.hash;

        if (hash) {
             try {
                 await login({ id, hash, api: "passkey-register-options" });
                 authenticated = true;
             } catch {}
        }

        const options = await getPasskeyRegistrationOptions({
            id,
            email,
            firstName,
            lastName,
            rpID,
            authenticated
        });
        return options;
    } catch (err) {
        return { err: getSafeError(err) };
    }
}

export async function registerVerify({ id, response, name }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);

        const h = await headers();
        const host = h.get("x-forwarded-host") || h.get("host");
        const protocol = host.includes("localhost") ? "http" : "https";
        const origin = `${protocol}://${host}`;
        const rpID = host.split(":")[0];

        let authenticated = false;
        const cookie = h.get("cookie");
        const cookies = parseCookie(cookie);
        const hash = h.get("hash") || cookies.hash;

        if (hash) {
             try {
                 await login({ id, hash, api: "passkey-register-verify" });
                 authenticated = true;
             } catch {}
        }

        const result = await verifyPasskeyRegistration({ id, response, name, origin, rpID, authenticated });
        return result;
    } catch (err) {
        return { err: getSafeError(err) };
    }
}

export async function authOptions({ id }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);

        const h = await headers();
        const host = h.get("x-forwarded-host") || h.get("host");
        const rpID = host.split(":")[0];

        const options = await getPasskeyAuthOptions({ id, rpID });
        return options;
    } catch (err) {
        return { err: getSafeError(err) };
    }
}

export async function authVerify({ id, response }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);

        const h = await headers();
        const host = h.get("x-forwarded-host") || h.get("host");
        const protocol = host.includes("localhost") ? "http" : "https";
        const origin = `${protocol}://${host}`;
        const rpID = host.split(":")[0];

        const user = await verifyPasskeyAuth({ id, response, origin, rpID });
        return { hash: user.hash, role: user.role };
    } catch (err) {
        return { err: getSafeError(err) };
    }
}

export async function listPasskeys({ id }) {
    try {
        const h = await headers();
        const cookie = h.get("cookie");
        const cookies = parseCookie(cookie);
        const hash = h.get("hash") || cookies.hash;

        if (!hash) {
             throw "Unauthorized";
        }
        await login({ id, hash, api: "passkey-list" });
        const passkeys = await getPasskeys({ id });
        return passkeys;
    } catch (err) {
        return { err: getSafeError(err) };
    }
}

export async function deletePasskey({ id, credentialId }) {
    try {
        const h = await headers();
        const cookie = h.get("cookie");
        const cookies = parseCookie(cookie);
        const hash = h.get("hash") || cookies.hash;

        if (!hash) {
             throw "Unauthorized";
        }
        await login({ id, hash, api: "passkey-delete" });
        await deletePasskeyUtil({ id, credentialId });
        return { success: true };
    } catch (err) {
        return { err: getSafeError(err) };
    }
}
