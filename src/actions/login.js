"use server";
import { login as loginUtil, register as registerUtil, changePassword as changePasswordUtil, resetPassword as resetPasswordUtil, sendResetEmail as sendResetEmailUtil } from "@util/login";
import { getSafeError } from "@util/safeError";
import { checkRateLimit } from "@util/rateLimit";
import { getIP } from "@util/network";

export async function login({ id, password, hash }) {
    try {
        if (password) {
            const ip = await getIP();
            await checkRateLimit(ip);
        }
        const params = await loginUtil({
            id,
            password,
            hash,
            api: "login"
        });

        if (params && !params.role) {
            params.role = "visitor";
        }

        const safeParams = {};
        if (params && params.id) {
            safeParams.id = params.id;
            safeParams.hash = params.hash;
            safeParams.role = params.role;
            safeParams.firstName = params.firstName;
            safeParams.lastName = params.lastName;
            safeParams.email = params.email;
        }
        return safeParams;

    } catch (err) {
        console.error("login error: ", err);
        return { err: getSafeError(err) };
    }
}

export async function register({ id, email, firstName, lastName, password }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);
        const hash = await registerUtil({
            id,
            email,
            firstName,
            lastName,
            password
        });
        return { hash, role: "visitor" };
    } catch (err) {
        console.error("register error: ", err);
        return { err: getSafeError(err) };
    }
}

export async function resetPassword({ id, code, newPassword }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);
        const hash = await resetPasswordUtil({
            id,
            code,
            newPassword,
            api: "login"
        });
        return { hash };
    } catch (err) {
        console.error("reset password error: ", err);
        return { err: getSafeError(err) };
    }
}

export async function changePassword({ id, oldPassword, newPassword }) {
    try {
         const hash = await changePasswordUtil({
            id,
            oldPassword,
            newPassword,
            api: "login"
        });
        return { hash };
    } catch (err) {
        console.error("change password error: ", err);
        return { err: getSafeError(err) };
    }
}

export async function sendResetEmail({ id }) {
    try {
        const ip = await getIP();
        await checkRateLimit(ip);
        await sendResetEmailUtil({ id });
        return {};
    } catch (err) {
        console.error("send reset email error: ", err);
        return { err: getSafeError(err) };
    }
}
