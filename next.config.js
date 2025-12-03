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
    webpack: (config, { webpack }) => {
        config.plugins.push(new webpack.DefinePlugin({
            VERSION: JSON.stringify(version)
        }));
        return config;
    }
};

module.exports = withPWA(nextConfig);
