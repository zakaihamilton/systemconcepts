const productId = "systemconcepts";

export async function GET() {
	const roleNames = [
		"visitor",
		"student",
		"upper",
		"teacher",
		"admin",
	] as const;
	return Response.json(
		{
			schemaVersion: 1,
			productId,
			version: "1.0.0",
			roles: roleNames.map((role) => ({
				id: `systemconcepts-${role}`,
				name:
					role === "upper"
						? "Upper school"
						: role.slice(0, 1).toUpperCase() + role.slice(1),
				description: `System Concepts ${role} access. Higher roles include the capabilities of lower roles.`,
				role,
				scopeKinds: ["product"],
				actions: [`${productId}:access:${role}`],
			})),
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}
