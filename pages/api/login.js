import { login, register, changePassword, resetPassword, sendResetEmail } from "@util/login";
import { getSafeError } from "@util/safeError";
import { checkRateLimit } from "@util/rateLimit";

export default async function LOGIN_API(req, res) {
    if (req.method === "GET") {
        let error = null;
        let params = {};
        try {
            const { id, password, hash } = req.headers || {};
            // Sentinel: Rate limit login attempts to prevent brute force
            if (password) {
                await checkRateLimit(req);
            }
            params = await login({
                id,
                password: password ? decodeURIComponent(password) : undefined,
                hash,
                api: "login"
            });
        }
        catch (err) {
            error = err;
        }
        if (error) {
            console.error("login error: ", error);
            res.status(200).json({ err: getSafeError(error) });
        }
        else {
            // Log only ID to avoid leaking sensitive data (hash, PII)
            if (params && !params.role) {
                params.role = "visitor";
            }
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");

            // SENTINEL: Whitelist fields to prevent leaking sensitive data like reset tokens or internal IDs
            const safeParams = {};
            if (params && params.id) {
                safeParams.id = params.id;
                // Note: The 'hash' is required for the legacy session system which uses the password hash as a session token.
                // Refactoring this is a larger task (Issue: #LegacyAuth). For now, we must return it.
                safeParams.hash = params.hash;
                safeParams.role = params.role;
                safeParams.firstName = params.firstName;
                safeParams.lastName = params.lastName;
                safeParams.email = params.email;
            }

            res.status(200).json({ ...(error && { err: getSafeError(error) }), ...safeParams });
        }
    }
    else if (req.method === "PUT") {
        const headers = req.headers || {};
        if (headers.reset) {
            try {
                const { id } = headers;
                await sendResetEmail({ id });
                res.status(200).json({});
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: getSafeError(err) });
            }
        }
        else if (headers.newpassword && headers.code) {
            try {
                const { id, code, newpassword } = headers;
                const hash = await resetPassword({
                    id,
                    code,
                    newPassword: decodeURIComponent(newpassword),
                    api: "login"
                });
                res.status(200).json({ hash });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: getSafeError(err) });
            }
        }
        else if (headers.oldpassword && headers.newpassword) {
            try {
                const { id, oldpassword, newpassword } = headers;
                const hash = await changePassword({
                    id,
                    oldPassword: decodeURIComponent(oldpassword),
                    newPassword: decodeURIComponent(newpassword),
                    api: "login"
                });
                res.status(200).json({ hash });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: getSafeError(err) });
            }
        }
        else {
            try {
                const { id, email, first_name, last_name, password } = headers;
                const hash = await register({
                    id,
                    email,
                    firstName: decodeURIComponent(first_name),
                    lastName: decodeURIComponent(last_name),
                    password: decodeURIComponent(password)
                });
                res.status(200).json({ hash, role: "visitor" });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: getSafeError(err) });
            }
        }
    }
};
