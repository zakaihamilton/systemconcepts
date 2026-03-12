import { NextResponse } from "next/server";
import { getSafeError } from "@util/safeError";
import { getApiKeys, createApiKey, deleteApiKey } from "@util/apikey";
import { login } from "@util/login";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    try {
        if (action === "list") {
            const hash = req.headers.get("hash") || req.cookies.get("hash")?.value;
            if (!hash) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            await login({ id, hash, api: "apikey-list" });

            const keys = await getApiKeys({ id });
            return NextResponse.json(keys);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        console.error("apikey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}

export async function POST(req) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    try {
        if (action === "create") {
            const hash = req.headers.get("hash") || req.cookies.get("hash")?.value;
            if (!hash) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            await login({ id, hash, api: "apikey-create" });

            const body = await req.json().catch(() => ({}));
            const name = body.name;

            const newKey = await createApiKey({ id, name });
            return NextResponse.json(newKey);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        console.error("apikey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}

export async function DELETE(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const keyId = searchParams.get("keyId");

    try {
        const hash = req.headers.get("hash") || req.cookies.get("hash")?.value;
        if (!hash) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await login({ id, hash, api: "apikey-delete" });

        await deleteApiKey({ id, keyId });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("apikey error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
    }
}
