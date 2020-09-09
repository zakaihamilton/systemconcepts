const { handleRequest } = require("@/util/mongo");
const { login } = require("../../src/util/login");
var Cookie = require('cookie');

module.exports = async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        await login({ id, hash });
        const result = await handleRequest({ collectionName: "fs_" + id, req, readOnly: false });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
