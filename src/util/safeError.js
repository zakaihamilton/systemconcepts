export function getSafeError(err) {
	const mapping = {
		RATE_LIMIT_EXCEEDED: "Too many attempts, please try again later",
		TOO_MANY_RECORDS: "Too many records in one request",
	};
	if (mapping[err]) {
		return mapping[err];
	}
	if (typeof err === "string") {
		return err;
	}
	return "INTERNAL_ERROR";
}
