const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    runtimeCaching: require("./runtimeCaching")
});

const version = require("./package.json").version;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_VERSION: version
    },
    // Silence Turbopack error for existing webpack config (from next-pwa)
    turbopack: {}
};

module.exports = withPWA(nextConfig);
