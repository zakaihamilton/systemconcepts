import {
	perministerAuthEnabled,
	perministerAuthorizationUrl,
	perministerClientSecretForSso,
} from "@util/auth/perminister";
import {
	createPerministerSsoTransaction,
	perministerSsoCookieName,
	safeSystemConceptsReturnTo,
	sealPerministerSsoTransaction,
} from "@util/auth/perministerSso";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorRedirect(request: Request) {
	const response = NextResponse.redirect(
		new URL("/#/account?auth=perminister-error", request.url),
		303,
	);
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("Referrer-Policy", "no-referrer");
	return response;
}

export async function GET(request: Request) {
	try {
		if (!perministerAuthEnabled()) return errorRedirect(request);
		const url = new URL(request.url);
		const generated = createPerministerSsoTransaction();
		const destination = perministerAuthorizationUrl(
			generated.state,
			generated.challenge,
			generated.nonce,
			url.origin,
		);
		const redirectUri =
			new URL(destination).searchParams.get("redirect_uri") ?? "";
		const transaction = {
			state: generated.state,
			verifier: generated.verifier,
			nonce: generated.nonce,
			redirectUri,
			returnTo: safeSystemConceptsReturnTo(url.searchParams.get("next")),
		};
		const cookieName = perministerSsoCookieName(transaction.state);
		if (!cookieName || !redirectUri) return errorRedirect(request);
		const response = NextResponse.redirect(destination, 302);
		response.cookies.set(
			cookieName,
			sealPerministerSsoTransaction(
				transaction,
				perministerClientSecretForSso(),
			),
			{
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: 10 * 60,
			},
		);
		response.headers.set("Cache-Control", "no-store");
		response.headers.set("Referrer-Policy", "no-referrer");
		return response;
	} catch {
		return errorRedirect(request);
	}
}
