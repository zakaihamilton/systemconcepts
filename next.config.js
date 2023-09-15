const withPWA = require("next-pwa");
const runtimeCaching = require("./runtimeCaching");

const version = require("./package.json").version;

module.exports = {
    reactStrictMode: true,
    publicRuntimeConfig: {
        VERSION: version
    },
    ...withPWA({
        pwa: {
            disable: process.env.NODE_ENV === "development",
            dest: "public",
            runtimeCaching
        },
        webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
            config.plugins.push(new webpack.DefinePlugin({
                VERSION: version
            }));
            return config;
        }
    })
};
