import { Buffer } from "node:buffer";

export function isValidNewPassword(password) {
	return (
		typeof password === "string" &&
		password.length >= 8 &&
		Buffer.byteLength(password, "utf8") <= 72
	);
}
