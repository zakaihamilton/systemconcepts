import { NextResponse } from "next/server";
import { login, register, changePassword, resetPassword, sendResetEmail } from "@util/login";
import { getSafeError } from "@util/safeError";
import { checkRateLimit } from "@util/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request) {
    let error = null;
    let params = {};
    try {
        const id = request.headers.get("id");
        const password = request.headers.get("password");
        const hash = request.headers.get("hash");

        if (password) {
            // Build req-like object for rate limiter
            const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
            await checkRateLimit({ headers: { "x-forwarded-for": ip } });
        }
        params = await login({
            id,
            password: password ? decodeURIComponent(password) : undefined,
            hash,
            api: "login"
        });
    } catch (err) {
        error = err;
    }

    if (error) {
        console.error("login error: ", error);
        return NextResponse.json({ err: getSafeError(error) });
    }

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

    return NextResponse.json(
        { ...(error && { err: getSafeError(error) }), ...safeParams },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        }
    );
}

export async function PUT(request) {
    const headers = request.headers;
    const reset = headers.get("reset");
    const newpassword = headers.get("newpassword");
    const code = headers.get("code");
    const oldpassword = headers.get("oldpassword");

    if (reset) {
        try {
            const id = headers.get("id");
            await sendResetEmail({ id });
            return NextResponse.json({});
        } catch (err) {
            console.error("login error: ", err);
            return NextResponse.json({ err: getSafeError(err) });
        }
    } else if (newpassword && code) {
        try {
            const id = headers.get("id");
            const hash = await resetPassword({
                id,
                code,
                newPassword: decodeURIComponent(newpassword),
                api: "login"
            });
            return NextResponse.json({ hash });
        } catch (err) {
            console.error("login error: ", err);
            return NextResponse.json({ err: getSafeError(err) });
        }
    } else if (oldpassword && newpassword) {
        try {
            const id = headers.get("id");
            const hash = await changePassword({
                id,
                oldPassword: decodeURIComponent(oldpassword),
                newPassword: decodeURIComponent(newpassword),
                api: "login"
            });
            return NextResponse.json({ hash });
        } catch (err) {
            console.error("login error: ", err);
            return NextResponse.json({ err: getSafeError(err) });
        }
    } else {
        try {
            const id = headers.get("id");
            const email = headers.get("email");
            const first_name = headers.get("first_name");
            const last_name = headers.get("last_name");
            const password = headers.get("password");
            const hash = await register({
                id,
                email,
                firstName: decodeURIComponent(first_name),
                lastName: decodeURIComponent(last_name),
                password: decodeURIComponent(password)
            });
            return NextResponse.json({ hash, role: "visitor" });
        } catch (err) {
            console.error("login error: ", err);
            return NextResponse.json({ err: getSafeError(err) });
        }
    }
}
