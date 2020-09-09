const { handleRequest } = require("@/util/mongo");
const { login } = require("../../src/util/login");
var Cookie = require('cookie');

const collectionName = "users";

module.exports = async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        user = await login({ id, hash });
        if (!user || user.role !== "admin") {
            throw "ACCESS_DENIED";
        }
        const result = await handleRequest({ collectionName, req });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
