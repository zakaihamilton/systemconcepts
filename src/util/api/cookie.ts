export default function parseCookie(cookieHeader: any) {
	if (!cookieHeader) return {};

	const cookies: Record<string, any> = {};
	cookieHeader.split(";").forEach((cookieStr: any) => {
		const [name, value] = cookieStr.trim().split("=");
		if (name && value) {
			cookies[name] = value;
		}
	});
	return cookies;
}
