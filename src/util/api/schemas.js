import { z } from "zod";

export const loginRequestSchema = z
	.object({
		action: z.enum([
			"reset-request",
			"reset-confirm",
			"password-change",
			"register",
			"login",
		]),
		id: z.string().trim().min(1).max(320).optional(),
		password: z.string().max(1024).optional(),
		newPassword: z.string().max(1024).optional(),
		oldPassword: z.string().max(1024).optional(),
		code: z.string().max(1024).optional(),
		email: z.string().max(320).optional(),
		firstName: z.string().max(200).optional(),
		lastName: z.string().max(200).optional(),
		remember: z.boolean().optional(),
	})
	.strict();

export const internalCacheRequestSchema = z
	.object({
		type: z.string().min(1).max(100),
		key: z.string().min(1).max(1000),
		body: z.string(),
	})
	.strict();

export const internalRateLimitRequestSchema = z
	.object({
		ip: z.string().min(1).max(200),
		limit: z.number().int().min(1).max(10000).optional(),
		windowMs: z
			.number()
			.int()
			.min(1000)
			.max(24 * 60 * 60 * 1000)
			.optional(),
	})
	.strict();

export const clientLogRequestSchema = z
	.object({
		type: z.enum(["error", "log"]).optional(),
		props: z
			.object({
				component: z.string().max(100).optional(),
				message: z.string().max(2000).optional(),
			})
			.optional(),
	})
	.strict();

export function parseBody(schema, body) {
	const result = schema.safeParse(body);
	return result.success ? result.data : null;
}
