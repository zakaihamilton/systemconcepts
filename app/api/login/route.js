import { logger as structuredLogger } from "@util/api/logger";
import { getSafeError } from "@util/api/safeError";
import { loginRequestSchema, parseBody } from "@util/api/schemas";
import {
	changePassword,
	login,
	register,
	resetPassword,
	sendResetEmail,
} from "@util/auth/login";
import { checkRateLimit } from "@util/auth/rateLimit";
import {
	assertSameOrigin,
	getTrustedClientIp,
} from "@util/auth/requestSecurity";
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
		params = await getSessionUser(request);
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

async function limit(
	request,
	action,
	id,
	limit = 5,
	windowMs = 15 * 60 * 1000,
) {
	const ip = getTrustedClientIp(request);
	await checkRateLimit(request, { limit, windowMs, key: `${action}:ip:${ip}` });
	if (id)
		await checkRateLimit(request, {
			limit: limit * 2,
			windowMs,
			key: `${action}:account:${String(id).toLowerCase()}`,
		});
}

export async function POST(request) {
	let body;
	try {
		assertSameOrigin(request);
		body = await request.json();
	} catch (err) {
		return NextResponse.json({ err: getSafeError(err) }, { status: 400 });
	}
	const validated = parseBody(loginRequestSchema, body);
	if (!validated)
		return NextResponse.json({ err: "INVALID_REQUEST" }, { status: 400 });
	const {
		action,
		id,
		password,
		newPassword,
		oldPassword,
		code,
		email,
		firstName,
		lastName,
		remember = true,
	} = validated;
	if (action === "reset-request") {
		try {
			await limit(request, "reset-request", id, 3);
			await sendResetEmail({ id });
			return NextResponse.json({ message: "RESET_REQUEST_ACCEPTED" });
		} catch (err) {
			structuredLogger.error("login error: ", err);
			if (err === "RATE_LIMIT_EXCEEDED") {
				return NextResponse.json({ err: getSafeError(err) }, { status: 429 });
			}
			return NextResponse.json({ message: "RESET_REQUEST_ACCEPTED" });
		}
	} else if (action === "reset-confirm") {
		try {
			await limit(request, "reset-confirm", id, 5);
			await resetPassword({
				id,
				code,
				newPassword,
				api: "login",
			});
			const user = await login({
				id,
				password: newPassword,
				api: "password-reset",
			});
			const session = await createSession(user.id);
			const response = NextResponse.json({ role: user.role || "visitor" });
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json(
				{ err: getSafeError(err) },
				{ status: err === "RATE_LIMIT_EXCEEDED" ? 429 : 400 },
			);
		}
	} else if (action === "password-change") {
		try {
			const user = await getSessionUser(request);
			await limit(request, "password-change", user.id, 5);
			await changePassword({
				id: user.id,
				oldPassword,
				newPassword,
				api: "login",
			});
			const updatedUser = await login({
				id: user.id,
				password: newPassword,
				api: "password-change",
			});
			const session = await createSession(updatedUser.id);
			const response = NextResponse.json({
				role: updatedUser.role || "visitor",
			});
			setSessionCookies(response, session, updatedUser);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json(
				{ err: getSafeError(err) },
				{
					status:
						err === "RATE_LIMIT_EXCEEDED" ? 429 : getAuthErrorStatus(err, 400),
				},
			);
		}
	} else if (action === "register") {
		try {
			await limit(request, "register", id, 3);
			await register({
				id,
				email,
				firstName,
				lastName,
				password,
			});
			const user = await login({
				id,
				password,
				api: "register",
			});
			const session = await createSession(user.id);
			const response = NextResponse.json({ role: "visitor" });
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json(
				{ err: getSafeError(err) },
				{ status: err === "RATE_LIMIT_EXCEEDED" ? 429 : 400 },
			);
		}
	} else if (action === "login") {
		try {
			await limit(request, "login", id, 5, 60 * 1000);
			const user = await login({ id, password, api: "login" });
			const session = await createSession(user.id, remember !== false);
			const response = NextResponse.json({
				id: user.id,
				role: user.role || "visitor",
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
			});
			setSessionCookies(response, session, user);
			return response;
		} catch (err) {
			structuredLogger.error("login error: ", err);
			return NextResponse.json(
				{ err: getSafeError(err) },
				{ status: err === "RATE_LIMIT_EXCEEDED" ? 429 : 401 },
			);
		}
	}
	return NextResponse.json({ err: "INVALID_ACTION" }, { status: 400 });
}

export async function DELETE(request) {
	try {
		assertSameOrigin(request);
	} catch (err) {
		return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
	}
	await revokeSession(request);
	const response = NextResponse.json({});
	clearSessionCookies(response);
	return response;
}
