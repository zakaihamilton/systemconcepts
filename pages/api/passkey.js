import { getSafeError } from "@util-legacy/safeError";
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeyAuthOptions, verifyPasskeyAuth, getPasskeys, deletePasskey } from "@util-legacy/passkey";
import { login } from "@util-legacy/login";

export default async function PASSKEY_API(req, res) {
    // Determine RP ID and Origin from the request
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const protocol = host.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;
    const rpID = host.split(":")[0]; // Remove port if present

    if (req.method === "GET") {
        const { action, id, email, first_name, last_name } = req.query;
        try {
            if (action === "register-options") {
                // Check authentication but don't strictly require it (allow new users)
                let authenticated = false;
                const hash = req.headers.hash || req.cookies.hash;
                if (hash) {
                    try {
                        await login({ id, hash, api: "passkey-register-options" });
                        authenticated = true;
                    } catch {
                        // ignore error, treat as unauthenticated
                    }
                }

                const options = await getPasskeyRegistrationOptions({
                    id,
                    email,
                    firstName: first_name,
                    lastName: last_name,
                    rpID,
                    authenticated
                });
                res.status(200).json(options);
            } else if (action === "auth-options") {
                const options = await getPasskeyAuthOptions({ id, rpID });
                res.status(200).json(options);
            } else if (action === "list") {
                // Require authentication
                const hash = req.headers.hash || req.cookies.hash;
                if (!hash) {
                    return res.status(401).json({ error: "Unauthorized" });
                }
                await login({ id, hash, api: "passkey-list" });

                const passkeys = await getPasskeys({ id });
                res.status(200).json(passkeys);
            } else {
                res.status(400).json({ error: "Invalid action" });
            }
        } catch (err) {
            console.error("passkey error: ", err);
            res.status(500).json({ err: getSafeError(err) });
        }
    } else if (req.method === "DELETE") {
        const { id, credentialId } = req.query;
        try {
            // Require authentication
            const hash = req.headers.hash || req.cookies.hash;
            if (!hash) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            await login({ id, hash, api: "passkey-delete" });

            await deletePasskey({ id, credentialId });
            res.status(200).json({ success: true });
        } catch (err) {
            console.error("passkey error: ", err);
            res.status(500).json({ err: getSafeError(err) });
        }
    } else if (req.method === "POST") {
        const { action, id } = req.query;
        const response = req.body;

        try {
            if (action === "register-verify") {
                // Check authentication
                let authenticated = false;
                const hash = req.headers.hash || req.cookies.hash;
                if (hash) {
                    try {
                        await login({ id, hash, api: "passkey-register-verify" });
                        authenticated = true;
                    } catch {
                        // ignore
                    }
                }

                // response body contains the attestation and optionally a name
                const { name, ...attResp } = response;

                const result = await verifyPasskeyRegistration({ id, response: attResp, name, origin, rpID, authenticated });
                res.status(200).json(result);
            } else if (action === "auth-verify") {
                const user = await verifyPasskeyAuth({ id, response, origin, rpID });
                // Return the hash (session token) just like normal login
                res.status(200).json({ hash: user.hash });
            } else {
                res.status(400).json({ error: "Invalid action" });
            }
        } catch (err) {
            console.error("passkey error: ", err);
            res.status(500).json({ err: getSafeError(err) });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
