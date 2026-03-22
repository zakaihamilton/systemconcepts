import { NextResponse } from "next/server";
import { getSafeError } from "@util/safeError";
import { getPasskeyRegistrationOptions, verifyPasskeyRegistration, getPasskeyAuthOptions, verifyPasskeyAuth, getPasskeys, deletePasskey } from "@util/passkey";
import { login } from "@util/login";

export const dynamic = "force-dynamic";

export async function GET(request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const rpID = host.split(":")[0];

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id");
    const email = url.searchParams.get("email");
    const first_name = url.searchParams.get("first_name");
    const last_name = url.searchParams.get("last_name");

    try {
        if (action === "register-options") {
            let authenticated = false;
            const hash = request.headers.get("hash") || request.cookies.get("hash")?.value;
            if (hash) {
                try {
                    await login({ id, hash, api: "passkey-register-options" });
                    authenticated = true;
                } catch {
                    // ignore
                }
            }
            const options = await getPasskeyRegistrationOptions({ id, email, firstName: first_name, lastName: last_name, rpID, authenticated });
            return NextResponse.json(options);
        } else if (action === "auth-options") {
            const options = await getPasskeyAuthOptions({ id, rpID });
            return NextResponse.json(options);
        } else if (action === "list") {
            const hash = request.headers.get("hash") || request.cookies.get("hash")?.value;
            if (!hash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            await login({ id, hash, api: "passkey-list" });
            const passkeys = await getPasskeys({ id });
            return NextResponse.json(passkeys);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        console.error("passkey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}

export async function DELETE(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const credentialId = url.searchParams.get("credentialId");

    try {
        const hash = request.headers.get("hash") || request.cookies.get("hash")?.value;
        if (!hash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await login({ id, hash, api: "passkey-delete" });
        await deletePasskey({ id, credentialId });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("passkey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}

export async function POST(request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protocol = host.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;
    const rpID = host.split(":")[0];

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id");
    const response = await request.json();

    try {
        if (action === "register-verify") {
            let authenticated = false;
            const hash = request.headers.get("hash") || request.cookies.get("hash")?.value;
            if (hash) {
                try {
                    await login({ id, hash, api: "passkey-register-verify" });
                    authenticated = true;
                } catch {
                    // ignore
                }
            }
            const { name, ...attResp } = response;
            const result = await verifyPasskeyRegistration({ id, response: attResp, name, origin, rpID, authenticated });
            return NextResponse.json(result);
        } else if (action === "auth-verify") {
            const user = await verifyPasskeyAuth({ id, response, origin, rpID });
            return NextResponse.json({ hash: user.hash });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        console.error("passkey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}
