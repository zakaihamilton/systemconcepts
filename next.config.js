const path = require("node:path");
const version = require("./package.json").version;
const isDev = process.env.NODE_ENV === "development";
const iconSvgrBase = require("./src/components/Icons/svgr.config.js");
const iconSvgrTemplate = require("./src/components/Icons/svgr-template.js");
const iconSvgrConfigFile = path.join(
	__dirname,
	"src/components/Icons/svgr.webpack.config.js",
);
const iconSvgrOptions = {
	...iconSvgrBase,
	template: iconSvgrTemplate,
};
const iconsSvgDir = path.join(__dirname, "src/components/Icons/svg");
function configuredOrigin(value) {
	try {
		if (!value) return null;
		const endpoint = value.trim();
		return new URL(
			/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`,
		).origin;
	} catch {
		return null;
	}
}
const externalOrigins = [
	configuredOrigin(
		process.env.AWS_ENDPOINT || "https://sfo3.digitaloceanspaces.com",
	),
	"https://s3.wasabisys.com",
	configuredOrigin(process.env.WASABI_URL),
	configuredOrigin(process.env.SITE_URL),
	configuredOrigin(process.env.NEXT_PUBLIC_SITE_URL),
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	outputFileTracingRoot: __dirname,
	env: {
		NEXT_PUBLIC_VERSION: version,
	},
	turbopack: {
		rules: {
			"./src/components/Icons/svg/*.svg": {
				loaders: [
					{
						loader: "@svgr/webpack",
						options: {
							configFile: iconSvgrConfigFile,
						},
					},
				],
				as: "*.js",
			},
		},
	},
	webpack(config) {
		const fileLoaderRule = config.module.rules.find((rule) =>
			rule.test?.test?.(".svg"),
		);

		config.module.rules.push(
			{
				...fileLoaderRule,
				test: /\.svg$/i,
				include: iconsSvgDir,
				resourceQuery: /url/,
			},
			{
				test: /\.svg$/i,
				include: iconsSvgDir,
				issuer: fileLoaderRule.issuer,
				resourceQuery: {
					not: [...fileLoaderRule.resourceQuery.not, /url/],
				},
				use: [
					{
						loader: "@svgr/webpack",
						options: iconSvgrOptions,
					},
				],
			},
		);

		fileLoaderRule.exclude = iconsSvgDir;

		return config;
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "X-XSS-Protection",
						value: "1; mode=block",
					},
					{
						key: "X-Frame-Options",
						value: "SAMEORIGIN",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self'",
							"base-uri 'self'",
							"frame-ancestors 'self'",
							"form-action 'self'",
							"object-src 'none'",
							[
								"script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
								isDev && "'unsafe-eval'",
							]
								.filter(Boolean)
								.join(" "),
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
							["img-src 'self' data: blob:", ...externalOrigins].join(" "),
							["media-src 'self' blob:", ...externalOrigins].join(" "),
							"font-src 'self' data: https://fonts.gstatic.com",
							[
								"connect-src 'self'",
								...externalOrigins,
								"https://va.vercel-scripts.com",
							].join(" "),
							"worker-src 'self' blob:",
							"manifest-src 'self'",
							"upgrade-insecure-requests",
						].join("; "),
					},
					{
						key: "Permissions-Policy",
						value:
							"camera=(), geolocation=(), microphone=(), payment=(), usb=()",
					},
				],
			},
		];
	},
};

module.exports = nextConfig;
