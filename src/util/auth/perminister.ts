import "server-only";

import { findRecord, listCollection, replaceRecord } from "@util/storage/mongo";
import { exchangePerministerOidcCode } from "./perministerOidc";

const REQUEST_TIMEOUT_MS = 12_000;

export interface PerministerSession {
	account: {
		subjectId: string;
		email: string | null;
		username: string | null;
		legacyAccountId?: string | null;
		firstName?: string | null;
		lastName?: string | null;
	};
	session: { expiresAt?: string; createdAt?: string };
	organizations: Array<{
		organizationId: string;
		organizationName: string;
		organizationRole?: string;
		productId: string;
		platformAdmin: boolean;
		resourceRoles: Array<{
			scope: { kind: string; organizationId: string; productId: string };
			role: string | null;
			actions: string[];
		}>;
	}>;
}

export class PerministerUnavailableError extends Error {
	constructor() {
		super("Perminister authentication is temporarily unavailable.");
		this.name = "PerministerUnavailableError";
	}
}

function authConfig() {
	const rawBaseUrl = process.env.PERMINISTER_BASE_URL?.trim() ?? "";
	const clientId = process.env.PERMINISTER_APP_CLIENT_ID?.trim() ?? "";
	const clientSecret = process.env.PERMINISTER_APP_CLIENT_SECRET?.trim() ?? "";
	let baseUrl: URL;
	try {
		baseUrl = new URL(rawBaseUrl);
	} catch {
		throw new PerministerUnavailableError();
	}
	const localHttp =
		baseUrl.protocol === "http:" &&
		["localhost", "127.0.0.1"].includes(baseUrl.hostname);
	if (
		(!localHttp && baseUrl.protocol !== "https:") ||
		baseUrl.username ||
		baseUrl.password ||
		(baseUrl.pathname !== "/" && baseUrl.pathname !== "") ||
		baseUrl.search ||
		baseUrl.hash ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			clientId,
		) ||
		clientSecret.length < 16
	) {
		throw new PerministerUnavailableError();
	}
	return {
		baseUrl: baseUrl.origin,
		clientId: clientId.toLowerCase(),
		clientSecret,
	};
}

export function perministerAuthEnabled(): boolean {
	return process.env.PERMINISTER_AUTH_ENABLED === "true";
}

export function perministerClientSecretForSso(): string {
	return authConfig().clientSecret;
}

export function isPerministerSessionToken(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i.test(
		value,
	);
}

function appOrigin(requestOrigin?: string): string {
	if (requestOrigin) {
		try {
			const requestUrl = new URL(requestOrigin);
			if (
				requestUrl.protocol === "http:" &&
				["localhost", "127.0.0.1"].includes(requestUrl.hostname)
			) {
				return requestUrl.origin;
			}
		} catch {
			throw new PerministerUnavailableError();
		}
	}
	const configured = process.env.SITE_URL?.trim() ?? "";
	try {
		const url = new URL(configured);
		const localHttp =
			url.protocol === "http:" &&
			["localhost", "127.0.0.1"].includes(url.hostname);
		if (
			(!localHttp && url.protocol !== "https:") ||
			url.username ||
			url.password ||
			(url.pathname !== "/" && url.pathname !== "") ||
			url.search ||
			url.hash
		) {
			throw new Error("Invalid application origin");
		}
		return url.origin;
	} catch {
		throw new PerministerUnavailableError();
	}
}

export function perministerAuthorizationUrl(
	state: string,
	challenge: string,
	nonce: string,
	requestOrigin?: string,
	forceLogin = false,
): string {
	const config = authConfig();
	const redirectUri = new URL(
		"/auth/perminister/callback",
		appOrigin(requestOrigin),
	).toString();
	const url = new URL("/oauth/authorize", config.baseUrl);
	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "openid profile email perminister_api",
		state,
		nonce,
		code_challenge: challenge,
		code_challenge_method: "S256",
	});
	if (forceLogin) params.set("prompt", "login");
	url.search = params.toString();
	return url.toString();
}

export async function perministerExchangeAuthorizationCode(
	code: string,
	codeVerifier: string,
	nonce: string,
	redirectUri: string,
) {
	const config = authConfig();
	return exchangePerministerOidcCode({
		baseUrl: config.baseUrl,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		code,
		codeVerifier,
		redirectUri,
		nonce,
	});
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function configuredOrganizationId(): string | null {
	const organizationId =
		process.env.PERMINISTER_ORGANIZATION_ID?.trim().toLowerCase() ?? "";
	if (!organizationId) return null;
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			organizationId,
		)
	) {
		throw new PerministerUnavailableError();
	}
	return organizationId;
}

export async function perministerSession(
	token: string,
): Promise<PerministerSession | null> {
	const config = authConfig();
	const sessionUrl = new URL("/api/auth/consumer/session", config.baseUrl);
	const organizationId = configuredOrganizationId();
	if (organizationId) {
		sessionUrl.searchParams.set("organization_id", organizationId);
	} else {
		sessionUrl.searchParams.set("include_organizations", "false");
	}
	let response: Response;
	try {
		response = await fetch(sessionUrl, {
			headers: {
				Accept: "application/json",
				"X-Perminister-Client-Id": config.clientId,
				"X-Perminister-Client-Secret": config.clientSecret,
				Authorization: `Bearer ${token}`,
			},
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch {
		throw new PerministerUnavailableError();
	}
	if (response.status === 401) return null;
	if (!response.ok) throw new PerministerUnavailableError();
	const payload = asRecord(await response.json().catch(() => null));
	const account = asRecord(payload?.account);
	const session = asRecord(payload?.session);
	if (
		payload?.authenticated !== true ||
		!account ||
		!session ||
		typeof account.subjectId !== "string" ||
		(account.email !== null && typeof account.email !== "string") ||
		(account.username !== null && typeof account.username !== "string") ||
		(account.legacyAccountId !== undefined &&
			account.legacyAccountId !== null &&
			typeof account.legacyAccountId !== "string") ||
		(account.firstName !== undefined &&
			account.firstName !== null &&
			typeof account.firstName !== "string") ||
		(account.lastName !== undefined &&
			account.lastName !== null &&
			typeof account.lastName !== "string")
	) {
		return null;
	}
	const organizations = Array.isArray(payload?.organizations)
		? payload.organizations.flatMap((value) => {
				const organization = asRecord(value);
				if (
					!organization ||
					typeof organization.organizationId !== "string" ||
					typeof organization.productId !== "string"
				) {
					return [];
				}
				const resourceRoles = Array.isArray(organization.resourceRoles)
					? organization.resourceRoles.flatMap((roleValue) => {
							const role = asRecord(roleValue);
							const scope = asRecord(role?.scope);
							if (
								!role ||
								!scope ||
								typeof scope.kind !== "string" ||
								typeof scope.organizationId !== "string" ||
								typeof scope.productId !== "string" ||
								(role.role !== null && typeof role.role !== "string") ||
								!Array.isArray(role.actions) ||
								!role.actions.every((action) => typeof action === "string")
							) {
								return [];
							}
							return [
								{
									scope: {
										kind: scope.kind,
										organizationId: scope.organizationId,
										productId: scope.productId,
									},
									role: role.role as string | null,
									actions: role.actions as string[],
								},
							];
						})
					: [];
				return [
					{
						organizationId: organization.organizationId.toLowerCase(),
						organizationName:
							typeof organization.organizationName === "string"
								? organization.organizationName
								: "System Concepts workspace",
						...(typeof organization.organizationRole === "string"
							? { organizationRole: organization.organizationRole }
							: {}),
						productId: organization.productId.toLowerCase(),
						platformAdmin: organization.platformAdmin === true,
						resourceRoles,
					},
				];
			})
		: [];
	return {
		account: {
			subjectId: account.subjectId,
			email: account.email as string | null,
			username: account.username as string | null,
			legacyAccountId: account.legacyAccountId as string | null | undefined,
			firstName: account.firstName as string | null | undefined,
			lastName: account.lastName as string | null | undefined,
		},
		session: {
			expiresAt:
				typeof session.expiresAt === "string" ? session.expiresAt : undefined,
			createdAt:
				typeof session.createdAt === "string" ? session.createdAt : undefined,
		},
		organizations,
	};
}

export async function perministerLogout(token: string): Promise<void> {
	const config = authConfig();
	try {
		const response = await fetch(
			new URL("/api/auth/consumer/session", config.baseUrl),
			{
				method: "DELETE",
				headers: {
					Accept: "application/json",
					"X-Perminister-Client-Id": config.clientId,
					"X-Perminister-Client-Secret": config.clientSecret,
					Authorization: `Bearer ${token}`,
				},
				cache: "no-store",
				redirect: "error",
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			},
		);
		if (!response.ok) throw new PerministerUnavailableError();
	} catch {
		throw new PerministerUnavailableError();
	}
}

export async function localUserForPerministerSession(
	session: PerministerSession,
	options: { verifiedEmail?: string | null } = {},
): Promise<any> {
	const roleOrder = [
		"visitor",
		"student",
		"upper",
		"teacher",
		"admin",
	] as const;
	const organizationId = configuredOrganizationId();
	let assignedRole: (typeof roleOrder)[number] | undefined;
	if (organizationId) {
		const organization = session.organizations.find(
			(item) =>
				item.organizationId === organizationId &&
				item.productId === "systemconcepts",
		);
		if (!organization) {
			throw new Error(
				"This Perminister account does not have access to the System Concepts organization.",
			);
		}
		assignedRole = organization.resourceRoles
			.filter(
				(grant) =>
					grant.scope.kind === "product" &&
					grant.scope.organizationId.toLowerCase() === organizationId &&
					grant.scope.productId === "systemconcepts" &&
					typeof grant.role === "string" &&
					roleOrder.includes(grant.role as (typeof roleOrder)[number]) &&
					grant.actions.includes(`systemconcepts:access:${grant.role}`),
			)
			.map((grant) => grant.role as (typeof roleOrder)[number])
			.sort(
				(left, right) => roleOrder.indexOf(right) - roleOrder.indexOf(left),
			)[0];
	}
	const username = session.account.username?.trim().toLowerCase() ?? "";
	if (username && !/^[a-z0-9_-]{1,254}$/.test(username)) {
		throw new Error(
			"A System Concepts ID has not been assigned to this Perminister account.",
		);
	}

	const legacyAccountId =
		session.account.legacyAccountId?.trim().toLowerCase() ?? null;
	if (legacyAccountId && !/^[a-z0-9_-]{1,254}$/.test(legacyAccountId)) {
		throw new Error(
			"This Perminister account has an invalid System Concepts link.",
		);
	}
	const verifiedEmail = options.verifiedEmail?.trim().toLowerCase() ?? "";
	const emailPattern = verifiedEmail
		? new RegExp(
				`^${verifiedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
				"i",
			)
		: null;

	const collectionName = "users";
	const [boundUser, usernameUser, legacyUser, emailMatches] = await Promise.all([
		findRecord({
			collectionName,
			query: { perministerSubjectId: session.account.subjectId },
		}),
		username
			? findRecord({ collectionName, query: { id: username } })
			: Promise.resolve(null),
		legacyAccountId && legacyAccountId !== username
			? findRecord({ collectionName, query: { id: legacyAccountId } })
			: Promise.resolve(null),
		emailPattern
			? listCollection({
					collectionName,
					query: { email: emailPattern },
					fields: { _id: 0, id: 1, email: 1, perministerSubjectId: 1 },
					limit: 2,
				})
			: Promise.resolve(null),
	]);
	if (emailMatches && emailMatches.length > 1) {
		throw new Error(
			"This Perminister email conflicts with multiple System Concepts accounts.",
		);
	}
	const emailUser = emailMatches?.[0]
		? await findRecord({ collectionName, query: { id: emailMatches[0].id } })
		: null;

	const matchedUsers = [boundUser, usernameUser, legacyUser, emailUser].filter(
		(user) => user && typeof user.id === "string",
	);
	if (new Set(matchedUsers.map((user) => user.id)).size > 1) {
		throw new Error(
			"This Perminister account conflicts with an existing System Concepts ID.",
		);
	}

	let user = boundUser ?? legacyUser ?? usernameUser ?? emailUser;
	if (!user) {
		throw new Error("This System Concepts account has not been provisioned.");
	}
	if (
		user.perministerSubjectId &&
		user.perministerSubjectId !== session.account.subjectId
	) {
		throw new Error(
			"This System Concepts ID is linked to another Perminister account.",
		);
	}
	if (organizationId && !assignedRole) {
		throw new Error(
			"A System Concepts role has not been assigned in Perminister.",
		);
	}
	if (!user.perministerSubjectId) {
		const matchedBySystemConceptsId =
			(legacyAccountId && user.id === legacyAccountId) ||
			(username && user.id === username);
		const matchedByVerifiedEmail = emailUser && emailUser.id === user.id;
		if (!matchedBySystemConceptsId && !matchedByVerifiedEmail) {
			throw new Error(
				"This System Concepts account must be linked by the migration before sign-in.",
			);
		}
		const linked = { ...user, perministerSubjectId: session.account.subjectId };
		try {
			await replaceRecord({
				collectionName,
				query: { id: user.id },
				record: linked,
			});
		} catch {
			throw new PerministerUnavailableError();
		}
		user = linked;
	}
	const legacyRole = roleOrder.includes(user.role)
		? (user.role as (typeof roleOrder)[number])
		: "visitor";
	return { ...user, role: assignedRole ?? legacyRole };
}
