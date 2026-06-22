import { getSafeError } from "@util/api/safeError";
import {
	deletePasskey,
	getPasskeyAuthOptions,
	getPasskeyRegistrationOptions,
	getPasskeys,
	verifyPasskeyAuth,
	verifyPasskeyRegistration,
} from "@util/auth/passkey";
import {
	createSession,
	getSessionUser,
	setSessionCookies,
} from "@util/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
	const host =
		request.headers.get("x-forwarded-host") || request.headers.get("host");
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
			try {
				const user = await getSessionUser(request);
				authenticated = user.id === id?.toLowerCase();
			} catch {}
			const options = await getPasskeyRegistrationOptions({
				id,
				email,
				firstName: first_name,
				lastName: last_name,
				rpID,
				authenticated,
			});
			return NextResponse.json(options);
		} else if (action === "auth-options") {
			const options = await getPasskeyAuthOptions({ id, rpID });
			return NextResponse.json(options);
		} else if (action === "list") {
			const user = await getSessionUser(request);
			if (user.id !== id?.toLowerCase())
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
		const user = await getSessionUser(request);
		if (user.id !== id?.toLowerCase())
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		await deletePasskey({ id, credentialId });
		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("passkey error: ", err);
		return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
	}
}

export async function POST(request) {
	const host =
		request.headers.get("x-forwarded-host") || request.headers.get("host");
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
			try {
				const user = await getSessionUser(request);
				authenticated = user.id === id?.toLowerCase();
			} catch {}
			const { name, ...attResp } = response;
			const result = await verifyPasskeyRegistration({
				id,
				response: attResp,
				name,
				origin,
				rpID,
				authenticated,
			});
			return NextResponse.json(result);
		} else if (action === "auth-verify") {
			const user = await verifyPasskeyAuth({ id, response, origin, rpID });
			const session = await createSession(user.id);
			const result = NextResponse.json({ role: user.role || "visitor" });
			setSessionCookies(result, session, user);
			return result;
		} else {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}
	} catch (err) {
		console.error("passkey error: ", err);
		return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
	}
}
