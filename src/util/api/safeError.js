export function getErrorCode(err) {
	if (typeof err === "string") return err;
	if (err && typeof err === "object") {
		return err.code || err.err || err.message || "INTERNAL_ERROR";
	}
	return "INTERNAL_ERROR";
}

export function getSafeError(err) {
	const mapping = {
		RATE_LIMIT_EXCEEDED: "Too many attempts, please try again later",
		TOO_MANY_RECORDS: "Too many records in one request",
		AUTHENTICATION_REQUIRED: "Please sign in again",
	};
	const code = getErrorCode(err);
	if (mapping[code]) {
		return mapping[code];
	}
	if (typeof code === "string") {
		return code;
	}
	return "INTERNAL_ERROR";
}
