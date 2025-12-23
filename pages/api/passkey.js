import { getSafeError } from "@util/safeError";
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeyAuthOptions, verifyPasskeyAuth, getPasskeys, deletePasskey } from "@util/passkey";
import { login } from "@util/login";

export default async function PASSKEY_API(req, res) {
    if (req.method === "GET") {
        const { action, id, email } = req.query;
        try {
            if (action === "register-options") {
                // Require authentication
                const hash = req.headers.hash || req.cookies.hash;
                if (!hash) {
                    return res.status(401).json({ error: "Unauthorized" });
                }
                await login({ id, hash, api: "passkey-register-options" });

                const options = await getPasskeyRegistrationOptions({ id, email });
                res.status(200).json(options);
            } else if (action === "auth-options") {
                const options = await getPasskeyAuthOptions({ id });
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
                // Require authentication
                const hash = req.headers.hash || req.cookies.hash;
                 if (!hash) {
                    return res.status(401).json({ error: "Unauthorized" });
                }
                await login({ id, hash, api: "passkey-register-verify" });

                // response body contains the attestation and optionally a name
                const { name, ...attResp } = response;

                const result = await verifyPasskeyRegistration({ id, response: attResp, name });
                res.status(200).json(result);
            } else if (action === "auth-verify") {
                const user = await verifyPasskeyAuth({ id, response });
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
