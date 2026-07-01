const withPWA = require("@ducanh2912/next-pwa").default({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	extendDefaultRuntimeCaching: true,
	fallbacks: {
		document: "/~offline",
	},
	workboxOptions: {
		runtimeCaching: require("./runtimeCaching"),
	},
});

const version = require("./package.json").version;

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	outputFileTracingRoot: __dirname,
	env: {
		NEXT_PUBLIC_VERSION: version,
	},
	// Silence Turbopack error for existing webpack config (from next-pwa)
	turbopack: {},
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
							"script-src 'self' 'unsafe-inline'",
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
							"img-src 'self' data: blob: https:",
							"media-src 'self' blob: https:",
							"font-src 'self' data: https://fonts.gstatic.com",
							"connect-src 'self' https: wss:",
							"worker-src 'self' blob:",
							"manifest-src 'self'",
							"upgrade-insecure-requests",
						].join("; "),
					},
				],
			},
		];
	},
};

module.exports = withPWA(nextConfig);
