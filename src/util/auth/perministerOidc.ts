import "server-only";

import { createPublicKey, verify as verifySignature } from "node:crypto";

const expectedScope = "openid profile email perminister_api";

type JsonMap = Record<string, unknown>;
type OidcConfig = {
	baseUrl: string;
	clientId: string;
	clientSecret: string;
	code: string;
	codeVerifier: string;
	redirectUri: string;
	nonce: string;
};

function asObject(value: unknown): JsonMap | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonMap)
		: null;
}

async function readJson(response: Response): Promise<JsonMap> {
	if (!response.ok) throw new Error("Perminister OIDC request failed.");
	const parsed = asObject(await response.json().catch(() => null));
	if (!parsed)
		throw new Error("Perminister returned an invalid OIDC response.");
	return parsed;
}

function decodeJsonSegment(segment: string): JsonMap {
	const parsed = asObject(
		JSON.parse(Buffer.from(segment, "base64url").toString("utf8")),
	);
	if (!parsed) throw new Error("Perminister returned an invalid ID token.");
	return parsed;
}

function formEncode(value: string): string {
	return new URLSearchParams([["value", value]])
		.toString()
		.slice("value=".length);
}

async function providerMetadata(baseUrl: string): Promise<{
	issuer: string;
	tokenEndpoint: string;
	jwksUri: string;
}> {
	const origin = new URL(baseUrl).origin;
	const metadataResponse = await fetch(
		new URL("/.well-known/openid-configuration", origin),
		{
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(8_000),
		},
	);
	const metadata = await readJson(metadataResponse);
	const issuer = new URL(origin).origin;
	const tokenEndpoint = new URL("/oauth/token", origin).toString();
	const jwksUri = new URL("/.well-known/jwks.json", origin).toString();
	const scopes = metadata.scopes_supported;
	if (
		metadata.issuer !== issuer ||
		metadata.authorization_endpoint !==
			new URL("/oauth/authorize", origin).toString() ||
		metadata.token_endpoint !== tokenEndpoint ||
		metadata.jwks_uri !== jwksUri ||
		!Array.isArray(metadata.response_types_supported) ||
		!metadata.response_types_supported.includes("code") ||
		!Array.isArray(metadata.id_token_signing_alg_values_supported) ||
		!metadata.id_token_signing_alg_values_supported.includes("RS256") ||
		!Array.isArray(metadata.code_challenge_methods_supported) ||
		!metadata.code_challenge_methods_supported.includes("S256") ||
		!Array.isArray(metadata.token_endpoint_auth_methods_supported) ||
		!metadata.token_endpoint_auth_methods_supported.includes(
			"client_secret_basic",
		) ||
		!Array.isArray(scopes) ||
		!expectedScope.split(" ").every((scope) => scopes.includes(scope))
	) {
		throw new Error("Perminister returned invalid OpenID Provider metadata.");
	}
	return { issuer, tokenEndpoint, jwksUri };
}

async function verifyIdToken(
	idToken: string,
	config: OidcConfig,
	metadata: { issuer: string; jwksUri: string },
): Promise<string> {
	if (idToken.length > 16_384)
		throw new Error("Perminister returned an invalid ID token.");
	const parts = idToken.split(".");
	if (parts.length !== 3 || parts.some((part) => !part)) {
		throw new Error("Perminister returned an invalid ID token.");
	}
	const [encodedHeader, encodedPayload, encodedSignature] = parts as [
		string,
		string,
		string,
	];
	const header = decodeJsonSegment(encodedHeader);
	const payload = decodeJsonSegment(encodedPayload);
	if (
		header.alg !== "RS256" ||
		header.typ !== "JWT" ||
		typeof header.kid !== "string" ||
		!/^[A-Za-z0-9._-]{1,128}$/.test(header.kid) ||
		"jku" in header ||
		"x5u" in header ||
		"crit" in header
	) {
		throw new Error("Perminister returned an invalid ID token.");
	}

	const jwksResponse = await fetch(metadata.jwksUri, {
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.timeout(8_000),
	});
	const jwks = await readJson(jwksResponse);
	if (!Array.isArray(jwks.keys))
		throw new Error("Perminister returned an invalid JWKS.");
	const key = jwks.keys
		.map(asObject)
		.find(
			(candidate) =>
				candidate !== null &&
				candidate.kid === header.kid &&
				candidate.kty === "RSA" &&
				candidate.alg === "RS256" &&
				candidate.use === "sig" &&
				typeof candidate.n === "string" &&
				typeof candidate.e === "string",
		);
	if (!key) throw new Error("Perminister signing key was not found.");

	let publicKey;
	try {
		publicKey = createPublicKey({ key: key as never, format: "jwk" });
	} catch {
		throw new Error("Perminister returned an invalid signing key.");
	}
	const signature = Buffer.from(encodedSignature, "base64url");
	if (
		!verifySignature(
			"RSA-SHA256",
			Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
			publicKey,
			signature,
		)
	) {
		throw new Error("Perminister returned an invalid ID token signature.");
	}

	const now = Math.floor(Date.now() / 1000);
	const audiences =
		typeof payload.aud === "string"
			? [payload.aud]
			: Array.isArray(payload.aud) &&
					payload.aud.every((value) => typeof value === "string")
				? (payload.aud as string[])
				: [];
	if (
		payload.iss !== metadata.issuer ||
		!audiences.includes(config.clientId) ||
		(audiences.length > 1 && payload.azp !== config.clientId) ||
		typeof payload.sub !== "string" ||
		payload.sub.length === 0 ||
		typeof payload.exp !== "number" ||
		payload.exp <= now ||
		typeof payload.iat !== "number" ||
		payload.iat > now + 60 ||
		payload.exp <= payload.iat ||
		payload.nonce !== config.nonce
	) {
		throw new Error("Perminister ID token validation failed.");
	}
	return payload.sub;
}

export async function exchangePerministerOidcCode(config: OidcConfig): Promise<{
	accessToken: string;
	expiresAt: string;
	subjectId: string;
}> {
	const baseUrl = new URL(config.baseUrl).origin;
	const metadata = await providerMetadata(baseUrl);
	const basicCredentials = `${formEncode(config.clientId)}:${formEncode(config.clientSecret)}`;
	const tokenResponse = await fetch(metadata.tokenEndpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: `Basic ${Buffer.from(basicCredentials, "utf8").toString("base64")}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code: config.code,
			redirect_uri: config.redirectUri,
			code_verifier: config.codeVerifier,
		}),
		cache: "no-store",
		redirect: "error",
		signal: AbortSignal.timeout(8_000),
	});
	const token = await readJson(tokenResponse);
	if (
		typeof token.access_token !== "string" ||
		token.access_token.length === 0 ||
		token.access_token.length > 4096 ||
		token.token_type !== "Bearer" ||
		typeof token.expires_in !== "number" ||
		!Number.isSafeInteger(token.expires_in) ||
		token.expires_in <= 0 ||
		token.scope !== expectedScope ||
		typeof token.id_token !== "string"
	) {
		throw new Error("Perminister returned an invalid token response.");
	}
	const subjectId = await verifyIdToken(token.id_token, config, metadata);
	return {
		accessToken: token.access_token,
		expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
		subjectId,
	};
}
