import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";
import iconSvgrBase from "./src/components/Icons/svgr.config.ts";
import iconSvgrWebpackOptions from "./src/components/Icons/svgr.webpack.config.ts";

const rootDirectory = process.cwd();
const require = createRequire(path.join(rootDirectory, "next.config.ts"));
const version = JSON.parse(
	readFileSync(path.join(rootDirectory, "package.json"), "utf8"),
).version as string;
const isDev = process.env.NODE_ENV === "development";
const iconSvgrOptions = {
	...iconSvgrWebpackOptions,
};
const iconsSvgDir = path.join(rootDirectory, "src/components/Icons/svg");
function configuredOrigin(value: string | undefined): string | null {
	try {
		if (!value) return null;
		// WASABI_URL may use s3://user:pass@host/bucket. Treat that like https
		// so we keep the real host in CSP instead of origin "https://s3".
		const endpoint = value.trim().replace(/^s3:\/\//i, "https://");
		return new URL(
			/^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint)
				? endpoint
				: `https://${endpoint}`,
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
].filter((origin): origin is string => Boolean(origin));

const withBundleAnalyzer = require("@next/bundle-analyzer")({
	enabled: process.env.ANALYZE === "true",
	openAnalyzer: false,
});

const nextConfig: NextConfig = {
	reactStrictMode: true,
	outputFileTracingRoot: rootDirectory,
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
							...iconSvgrBase,
							runtimeConfig: false,
						},
					},
				],
				as: "*.js",
			},
		},
	},
	webpack(config) {
		const fileLoaderRule: any = config.module.rules.find((rule: any) =>
			rule?.test?.test?.(".svg"),
		);
		if (!fileLoaderRule) {
			throw new Error("Next.js SVG file loader rule was not found.");
		}

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
					not: [...(fileLoaderRule.resourceQuery?.not ?? []), /url/],
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

export default withBundleAnalyzer(nextConfig);
