declare module "js-cookie" {
	const Cookies: {
		get(name: string): string | undefined;
		set(
			name: string,
			value: string,
			options?: { expires?: number },
		): string | undefined;
		remove(
			name: string,
			options?: { path?: string; domain?: string; secure?: boolean },
		): void;
	};
	export default Cookies;
}
