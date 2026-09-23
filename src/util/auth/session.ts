import {
	deleteRecord,
	findRecord,
	getCollection,
	insertRecord,
} from "@util/storage/mongo";
import crypto from "crypto";

export const SESSION_COOKIE = "session";
export const SESSION_MARKER_COOKIE = "hash";
export const AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED";
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function digest(token: any) {
	return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: any, remember = true) {
	const token = crypto.randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await insertRecord({
		collectionName: "auth_sessions",
		record: {
			id: digest(token),
			userId: userId.toLowerCase(),
			createdAt: new Date(),
			expiresAt,
		},
	});
	return { token, expiresAt, remember };
}

export async function getSessionUser(request: any) {
	const token = request.cookies.get(SESSION_COOKIE)?.value;
	if (!token) throw AUTHENTICATION_REQUIRED;
	const session = await findRecord({
		collectionName: "auth_sessions",
		query: { id: digest(token) },
	});
	if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
		throw AUTHENTICATION_REQUIRED;
	}
	const user = await findRecord({
		collectionName: "users",
		query: { id: session.userId },
	});
	if (!user) throw AUTHENTICATION_REQUIRED;
	return user;
}

export function getAuthErrorStatus(err: any, fallback = 403) {
	return err === AUTHENTICATION_REQUIRED ? 401 : fallback;
}

export async function revokeSession(request: any) {
	const token = request.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return;
	await deleteRecord({
		collectionName: "auth_sessions",
		query: { id: digest(token) },
	});
}

export async function revokeAllSessions(userId: any) {
	if (!userId) return;
	const collection = await getCollection({ collectionName: "auth_sessions" });
	await collection.deleteMany({ userId: userId.toLowerCase() });
}

export function setSessionCookies(response: any, session: any, user: any) {
	const shared = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		...(session.remember && { expires: session.expiresAt }),
	};
	response.cookies.set(SESSION_COOKIE, session.token, shared);
	response.cookies.set("id", user.id, {
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		...(session.remember && { expires: session.expiresAt }),
	});
	response.cookies.set(SESSION_MARKER_COOKIE, "signed-in", {
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		...(session.remember && { expires: session.expiresAt }),
	});
}

export function clearSessionCookies(response: any) {
	for (const name of [SESSION_COOKIE, "id", SESSION_MARKER_COOKIE, "role"]) {
		response.cookies.set(name, "", {
			httpOnly: name === SESSION_COOKIE,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		});
	}
}
