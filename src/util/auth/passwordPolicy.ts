import { Buffer } from "node:buffer";

export function isValidNewPassword(password: any) {
	return (
		typeof password === "string" &&
		password.length >= 8 &&
		Buffer.byteLength(password, "utf8") <= 72
	);
}
