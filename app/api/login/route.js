import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import {
	changePassword,
	login,
	register,
	resetPassword,
	sendResetEmail,
} from "@util/auth/login";
import { checkRateLimit } from "@util/auth/rateLimit";
import {
	clearSessionCookies,
	createSession,
	getAuthErrorStatus,
	getSessionUser,
	revokeSession,
	setSessionCookies,
} from "@util/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
	let error = null;
	let params = {};
	try {
		const id = request.headers.get("id");
		const password = request.headers.get("password");
		const remember = request.headers.get("remember") !== "false";

		if (password) {
			// Build req-like object for rate limiter
			const ip =
				request.headers.get("x-forwarded-for") ||
				request.headers.get("x-real-ip") ||
				"";
			await checkRateLimit({ headers: { "x-forwarded-for": ip } });
			params = await login({
				id,
				password: decodeURIComponent(password),
				api: "login",
			});
			params.session = await createSession(params.id, remember);
		} else {
			params = await getSessionUser(request);
		}
	} catch (err) {
		error = err;
	}

	if (error) {
		structuredLogger.error("login error: ", error);
		return NextResponse.json(
			{ err: getSafeError(error) },
			{ status: getAuthErrorStatus(error, 200) },
		);
	}

	if (params && !params.role) {
		params.role = "visitor";
	}

	const safeParams = {};
	if (params && params.id) {
		safeParams.id = params.id;
		safeParams.role = params.role;
		safeParams.firstName = params.firstName;
		safeParams.lastName = params.lastName;
		safeParams.email = params.email;
	}

	const response = NextResponse.json(
		{ ...(error && { err: getSafeError(error) }), ...safeParams },
		{
			status: 200,
			headers: {
				"Cache-Control":
					"no-store, no-cache, must-revalidate, proxy-revalidate",
				Pragma: "no-cache",
				Expires: "0",
			},
		},
	);
	if (params.session) setSessionCookies(response, params.session, params);
	return response;
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
			const ip =
				request.headers.get("x-forwarded-for") ||
				request.headers.get("x-real-ip") ||
				"unknown";
			await checkRateLimit(
				{ headers: { "x-forwarded-for": ip } },
				{ limit: 3, windowMs: 15 * 60 * 1000, key: `reset-ip:${ip}` },
			);
			await checkRateLimit(
				{},
				{ limit: 3, windowMs: 60 * 60 * 1000, key: `reset-user:${id}` },
			);
			await sendResetEmail({ id });
			return NextResponse.json({ message: "RESET_REQUEST_ACCEPTED" });
		} catch (err) {
			structuredLogger.error("login error: ", err);
			if (err === "RATE_LIMIT_EXCEEDED") {
				return NextResponse.json({ err: getSafeError(err) }, { status: 429 });
			}
			return NextResponse.json({ message: "RESET_REQUEST_ACCEPTED" });
		}
	} else if (newpassword && code) {
		try {
			const id = headers.get("id");
			await resetPassword({
				id,
				code,
				newPassword: decodeURIComponent(newpassword),
				api: "login",
			});
			const user = await login({
				id,
				password: decodeURIComponent(newpassword),
				api: "password-reset",
			});
			const session = await createSession(user.id);
			const response = NextResponse.json({ role: user.role || "visitor" });
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json({ err: getSafeError(err) });
		}
	} else if (oldpassword && newpassword) {
		try {
			const id = headers.get("id");
			await changePassword({
				id,
				oldPassword: decodeURIComponent(oldpassword),
				newPassword: decodeURIComponent(newpassword),
				api: "login",
			});
			const user = await login({
				id,
				password: decodeURIComponent(newpassword),
				api: "password-change",
			});
			const session = await createSession(user.id);
			const response = NextResponse.json({ role: user.role || "visitor" });
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json({ err: getSafeError(err) });
		}
	} else {
		try {
			const id = headers.get("id");
			const email = headers.get("email");
			const first_name = headers.get("first_name");
			const last_name = headers.get("last_name");
			const password = headers.get("password");
			await register({
				id,
				email,
				firstName: decodeURIComponent(first_name),
				lastName: decodeURIComponent(last_name),
				password: decodeURIComponent(password),
			});
			const user = await login({
				id,
				password: decodeURIComponent(password),
				api: "register",
			});
			const session = await createSession(user.id);
			const response = NextResponse.json({ role: "visitor" });
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json({ err: getSafeError(err) });
		}
	}
}

export async function DELETE(request) {
	await revokeSession(request);
	const response = NextResponse.json({});
	clearSessionCookies(response);
	return response;
}
