export const API_ERROR_CODES = [
	"AUTHENTICATION_REQUIRED",
	"INTERNAL_ERROR",
	"INVALID_REQUEST",
	"NOT_FOUND",
	"RATE_LIMIT_EXCEEDED",
	"TOO_MANY_RECORDS",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorResponse {
	err: ApiErrorCode | string;
}

export interface ApiSuccessResponse<T> {
	data: T;
}

export class ApiRequestError extends Error {
	readonly code: ApiErrorCode | string;
	readonly status?: number;
	readonly details?: unknown;

	constructor(
		code: ApiErrorCode | string,
		options: { status?: number; details?: unknown; message?: string } = {},
	) {
		super(options.message || code);
		this.name = "ApiRequestError";
		this.code = code;
		this.status = options.status;
		this.details = options.details;
	}
}
