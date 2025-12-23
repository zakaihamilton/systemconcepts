import { getSafeError } from "@util/safeError";
import { 
    getPasskeyRegistrationOptions, 
    verifyPasskeyRegistration, 
    getPasskeyAuthOptions, 
    verifyPasskeyAuth 
} from "@util/passkey";
import { login } from "@util/login";

/**
 * Dynamically determines the RP_ID and Origin based on the request.
 * This ensures Vercel Preview URLs and Localhost work without changing Env Vars.
 */
const getWebAuthnConfig = (req) => {
    // Get host from Vercel headers or standard host header
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    return {
        origin: `${protocol}://${host}`,
        rpID: host.split(':')[0] // Removes port if present (e.g., localhost:3000 -> localhost)
    };
};

export default async function PASSKEY_API(req, res) {
    // 1. Extract dynamic configuration
    const { origin, rpID } = getWebAuthnConfig(req);

    if (req.method === "GET") {
        const { action, id, email } = req.query;
        try {
            if (action === "register-options") {
                const { hash } = req.headers || req.cookies;
                if (!hash) return res.status(401).json({ error: "Unauthorized" });
                
                await login({ id, hash, api: "passkey-register-options" });

                // 2. Pass rpID to options generator
                const options = await getPasskeyRegistrationOptions({ id, email, rpID });
                res.status(200).json(options);

            } else if (action === "auth-options") {
                // 3. Pass rpID to auth generator
                const options = await getPasskeyAuthOptions({ id, rpID });
                res.status(200).json(options);

            } else {
                res.status(400).json({ error: "Invalid action" });
            }
        } catch (err) {
            console.error("passkey error: ", err);
            res.status(500).json({ err: getSafeError(err) });
        }
    } else if (req.method === "POST") {
        const { action, id } = req.query;
        const response = req.body;

        try {
            if (action === "register-verify") {
                const { hash } = req.headers || req.cookies;
                if (!hash) return res.status(401).json({ error: "Unauthorized" });
                
                await login({ id, hash, api: "passkey-register-verify" });

                // 4. Pass origin and rpID to verification
                const result = await verifyPasskeyRegistration({ id, response, origin, rpID });
                res.status(200).json(result);

            } else if (action === "auth-verify") {
                // 5. Pass origin and rpID to auth verification
                const user = await verifyPasskeyAuth({ id, response, origin, rpID });
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
