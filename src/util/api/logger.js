const LEVELS = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	silent: Number.POSITIVE_INFINITY,
};

const SENSITIVE_KEY =
	/(authorization|cookie|credential|hash|password|secret|token|api[-_]?key|access[-_]?key)/i;
const REDACTED = "[REDACTED]";

function configuredLevel() {
	const configured =
		typeof window === "undefined"
			? process.env.LOG_LEVEL
			: process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL;
	if (configured && configured in LEVELS) return configured;
	return process.env.NODE_ENV === "production" ? "warn" : "debug";
}

function serialize(value, seen = new WeakSet()) {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
			...(value.cause ? { cause: serialize(value.cause, seen) } : {}),
		};
	}
	if (Array.isArray(value)) return value.map((item) => serialize(item, seen));
	if (!value || typeof value !== "object") return value;
	if (seen.has(value)) return "[Circular]";
	seen.add(value);
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			SENSITIVE_KEY.test(key) ? REDACTED : serialize(item, seen),
		]),
	);
}

export function redact(context = {}) {
	return serialize(context);
}

export function shouldLog(level) {
	return LEVELS[level] >= LEVELS[configuredLevel()];
}

function write(level, message, context, ...extra) {
	if (!shouldLog(level)) return;
	const normalizedMessage =
		typeof message === "string" ? message : "Application diagnostic";
	const normalizedContext =
		typeof message === "string"
			? context
			: { value: message, ...(context !== undefined ? { context } : {}) };
	const payload = {
		timestamp: new Date().toISOString(),
		level,
		message: normalizedMessage,
		...(normalizedContext !== undefined || extra.length
			? {
					context: redact(
						extra.length
							? { value: normalizedContext, extra }
							: normalizedContext,
					),
				}
			: {}),
	};
	const method = level === "debug" ? "debug" : level;
	console[method](payload);
}

export function debug(message, context, ...extra) {
	write("debug", message, context, ...extra);
}

export function info(message, context, ...extra) {
	write("info", message, context, ...extra);
}

export function warn(message, context, ...extra) {
	write("warn", message, context, ...extra);
}

export function errorLog(message, context, ...extra) {
	write("error", message, context, ...extra);
}

export const logger = { debug, info, warn, error: errorLog };

// Compatibility with the original logger API.
export function format({ date, utc, component, type, ...props }) {
	const timestamp = date || new Date().toString();
	return [
		utc || Date.now(),
		" - ",
		timestamp,
		"Component: ",
		component,
		" - ",
		"Type: ",
		type,
		...Object.entries(redact(props)).flat(1),
	];
}

export function log(props = {}) {
	info(props.component || "application", props);
}

export function error({ throwError = true, ...props } = {}) {
	errorLog(props.component || "application", props);
	if (throwError) throw props;
}

export function handle({ type = "log", props } = {}) {
	if (type === "error") error(props);
	else log(props);
}

if (typeof window !== "undefined") {
	window.addEventListener("error", (event) => {
		errorLog("Unhandled browser error", {
			message: event.message,
			filename: event.filename,
			line: event.lineno,
			column: event.colno,
			error: event.error,
		});
	});
}
