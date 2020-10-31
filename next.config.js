const withPWA = require('next-pwa')
const runtimeCaching = require("./runtimeCaching");

module.exports = {
    reactStrictMode: true,
    ...withPWA({
        pwa: {
            disable: process.env.NODE_ENV === 'development',
            dest: 'public',
            runtimeCaching
        },
        webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
            config.plugins.push(new webpack.DefinePlugin({
                VERSION: JSON.stringify(require("./package.json").version)
            }));
            return config
        }
    })
}
