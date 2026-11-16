import "server-only";

import {
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

const COOKIE_PREFIX =
	process.env.NODE_ENV === "production"
		? "__Host-systemconcepts-sso-"
		: "systemconcepts-sso-";

export type PerministerSsoTransaction = {
	state: string;
	verifier: string;
	nonce: string;
	redirectUri: string;
	returnTo: string;
};

export function perministerSsoCookieName(state: string): string | null {
	if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return null;
	return COOKIE_PREFIX + state;
}

export function safeSystemConceptsReturnTo(
	value: string | null | undefined,
): string {
	if (
		!value ||
		value.length > 2048 ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\")
	) {
		return "/";
	}
	try {
		const url = new URL(value, "https://systemconcepts.invalid");
		if (
			url.origin !== "https://systemconcepts.invalid" ||
			url.pathname !== "/" ||
			url.hash.length > 1536
		) {
			return "/";
		}
		return `/${url.search}${url.hash}`;
	} catch {
		return "/";
	}
}

export function createPerministerSsoTransaction() {
	const state = randomBytes(32).toString("base64url");
	const verifier = randomBytes(32).toString("base64url");
	const nonce = randomBytes(32).toString("base64url");
	return {
		state,
		verifier,
		nonce,
		challenge: createHash("sha256").update(verifier).digest("base64url"),
	};
}

export function sealPerministerSsoTransaction(
	transaction: PerministerSsoTransaction,
	clientSecret: string,
): string {
	const payload = Buffer.from(JSON.stringify(transaction), "utf8").toString(
		"base64url",
	);
	const signature = createHmac("sha256", clientSecret)
		.update(payload)
		.digest("base64url");
	return `${payload}.${signature}`;
}

export function readPerministerSsoTransaction(
	value: string | undefined,
	clientSecret: string,
): PerministerSsoTransaction | null {
	if (!value || value.length > 4096) return null;
	const [payload, signature, ...extra] = value.split(".");
	if (!payload || !signature || extra.length) return null;
	const expected = createHmac("sha256", clientSecret).update(payload).digest();
	const actual = Buffer.from(signature, "base64url");
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
		return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as {
			state?: unknown;
			verifier?: unknown;
			nonce?: unknown;
			redirectUri?: unknown;
			returnTo?: unknown;
		};
		const returnTo =
			typeof parsed.returnTo === "string"
				? safeSystemConceptsReturnTo(parsed.returnTo)
				: null;
		if (
			typeof parsed.state !== "string" ||
			!/^[A-Za-z0-9_-]{43}$/.test(parsed.state) ||
			typeof parsed.verifier !== "string" ||
			!/^[A-Za-z0-9_-]{43,128}$/.test(parsed.verifier) ||
			typeof parsed.nonce !== "string" ||
			!/^[A-Za-z0-9_-]{43}$/.test(parsed.nonce) ||
			typeof parsed.redirectUri !== "string" ||
			parsed.redirectUri.length > 2048 ||
			typeof parsed.returnTo !== "string" ||
			returnTo !== parsed.returnTo
		) {
			return null;
		}
		return {
			state: parsed.state,
			verifier: parsed.verifier,
			nonce: parsed.nonce,
			redirectUri: parsed.redirectUri,
			returnTo,
		};
	} catch {
		return null;
	}
}

export function matchesPerministerSsoState(
	expected: string,
	actual: string,
): boolean {
	if (!/^[A-Za-z0-9_-]{43}$/.test(actual)) return false;
	const expectedBytes = Buffer.from(expected, "utf8");
	const actualBytes = Buffer.from(actual, "utf8");
	return (
		expectedBytes.length === actualBytes.length &&
		timingSafeEqual(expectedBytes, actualBytes)
	);
}
