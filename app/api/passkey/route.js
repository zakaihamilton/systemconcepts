import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import {
	deletePasskey,
	getPasskeyAuthOptions,
	getPasskeyRegistrationOptions,
	getPasskeys,
	verifyPasskeyAuth,
	verifyPasskeyRegistration,
} from "@util/auth/passkey";
import { checkRateLimit } from "@util/auth/rateLimit";
import {
	assertSameOrigin,
	getTrustedClientIp,
} from "@util/auth/requestSecurity";
import {
	createSession,
	getAuthErrorStatus,
	getSessionUser,
	setSessionCookies,
} from "@util/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function limitPasskey(request, action, id) {
	const ip = getTrustedClientIp(request);
	await checkRateLimit(request, {
		limit: 10,
		windowMs: 15 * 60 * 1000,
		key: `passkey:${action}:ip:${ip}`,
	});
	if (id)
		await checkRateLimit(request, {
			limit: 20,
			windowMs: 15 * 60 * 1000,
			key: `passkey:${action}:account:${id.toLowerCase()}`,
		});
}

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
		await limitPasskey(request, action || "unknown", id);
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
		structuredLogger.error("passkey error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err, 500) },
		);
	}
}

export async function DELETE(request) {
	const url = new URL(request.url);
	const id = url.searchParams.get("id");
	const credentialId = url.searchParams.get("credentialId");

	try {
		assertSameOrigin(request);
		await limitPasskey(request, "delete", id);
		const user = await getSessionUser(request);
		if (user.id !== id?.toLowerCase())
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		await deletePasskey({ id, credentialId });
		return NextResponse.json({ success: true });
	} catch (err) {
		structuredLogger.error("passkey error: ", err);
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err, 500) },
		);
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
	try {
		assertSameOrigin(request);
		await limitPasskey(request, action || "unknown", id);
		const response = await request.json();
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
		structuredLogger.error("passkey error: ", err);
		return NextResponse.json({ err: getSafeError(err) }, { status: 500 });
	}
}
