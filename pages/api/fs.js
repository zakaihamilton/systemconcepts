const { handleRequest } = require("@/util/mongo");
const { login } = require("../../src/util/login");
var Cookie = require('cookie');

module.exports = async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        let collectionName = "fs";
        let readOnly = true;
        if (id && hash) {
            await login({ id, hash });
            collectionName += "_" + id;
            readOnly = false;
        }
        await handleRequest({ collectionName, req, res, readOnly });
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
