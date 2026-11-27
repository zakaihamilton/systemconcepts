import {
	isPerministerSessionToken,
	localUserForPerministerSession,
	perministerAuthEnabled,
	perministerExchangeAuthorizationCode,
	perministerLogout,
	perministerSession,
} from "@util/auth/perminister";
import { clearSessionCookies } from "@util/auth/session";
import { logger as structuredLogger } from "@util/api/logger";
import {
	matchesPerministerSsoState,
	perministerSsoCookieName,
	readPerministerSsoTransaction,
} from "@util/auth/perministerSso";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToAccount(request: Request, state: string) {
	const response = NextResponse.redirect(
		new URL("/#/account?auth=perminister-error", request.url),
		303,
	);
	const cookieName = perministerSsoCookieName(state);
	if (cookieName) {
		response.cookies.set(cookieName, "", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});
	}
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("Referrer-Policy", "no-referrer");
	clearSessionCookies(response);
	return response;
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const state = url.searchParams.get("state") ?? "";
	if (
		!perministerAuthEnabled() ||
		url.searchParams.getAll("state").length !== 1
	) {
		return redirectToAccount(request, state);
	}
	const cookieName = perministerSsoCookieName(state);
	if (!cookieName) return redirectToAccount(request, state);

	let returnTo: string | undefined;
	let exchangedToken: string | undefined;
	try {
		const cookieValue = (await cookies()).get(cookieName)?.value;
		const transaction = readPerministerSsoTransaction(
			cookieValue,
			process.env.PERMINISTER_APP_CLIENT_SECRET ?? "",
		);
		if (!transaction || !matchesPerministerSsoState(transaction.state, state)) {
			return redirectToAccount(request, state);
		}
		returnTo = transaction.returnTo;
		const codes = url.searchParams.getAll("code");
		if (
			url.searchParams.has("error") ||
			url.searchParams.getAll("error").length > 1 ||
			codes.length !== 1 ||
			!codes[0] ||
			codes[0].length > 2048
		) {
			return redirectToAccount(request, state);
		}

		const exchanged = await perministerExchangeAuthorizationCode(
			codes[0],
			transaction.verifier,
			transaction.nonce,
			transaction.redirectUri,
		);
		exchangedToken = exchanged.accessToken;
		if (!isPerministerSessionToken(exchanged.accessToken)) {
			throw new Error(
				"Perminister returned an invalid consumer session token.",
			);
		}
		const session = await perministerSession(exchanged.accessToken);
		if (!session || session.account.subjectId !== exchanged.subjectId) {
			throw new Error(
				"Perminister session identity did not match the OIDC response.",
			);
		}
		const sessionEmail = session.account.email?.trim().toLowerCase() ?? null;
		const verifiedEmail =
			exchanged.verifiedEmail && exchanged.verifiedEmail === sessionEmail
				? exchanged.verifiedEmail
				: null;
		const user = await localUserForPerministerSession(session, {
			verifiedEmail,
		});
		const expiry = Date.parse(session.session.expiresAt ?? exchanged.expiresAt);
		const maxAge = Math.min(
			30 * 24 * 60 * 60,
			Math.floor((expiry - Date.now()) / 1000),
		);
		if (!Number.isSafeInteger(maxAge) || maxAge <= 0) {
			throw new Error("Perminister session expired before callback completed.");
		}

		const response = NextResponse.redirect(
			new URL(returnTo ?? "/", request.url),
			303,
		);
		const cookieOptions = {
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax" as const,
			path: "/",
			maxAge,
		};
		response.cookies.set("session", exchanged.accessToken, {
			...cookieOptions,
			httpOnly: true,
		});
		response.cookies.set("id", user.id, cookieOptions);
		response.cookies.set("hash", "signed-in", cookieOptions);
		response.cookies.set("role", user.role || "visitor", cookieOptions);
		response.cookies.set(cookieName, "", {
			...cookieOptions,
			maxAge: 0,
			httpOnly: true,
		});
		response.headers.set("Cache-Control", "no-store");
		response.headers.set("Referrer-Policy", "no-referrer");
		return response;
	} catch (error) {
		structuredLogger.error("Perminister sign-in failed", error);
		if (exchangedToken)
			await perministerLogout(exchangedToken).catch(() => undefined);
		return redirectToAccount(request, state);
	}
}
