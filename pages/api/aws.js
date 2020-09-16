const { handleRequest } = require("@/util/aws");
const { login } = require("@/util/login");
const { roleAuth } = require("@/util/roles");
var Cookie = require('cookie');

module.exports = async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        let readOnly = true;
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        user = await login({ id, hash });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (roleAuth(user.role, "admin")) {
            readOnly = false;
        }
        const result = await handleRequest({ req, readOnly });
        if (typeof result === "object") {
            res.status(200).json(result);
        }
        else {
            res.status(200).end(result);
        }
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
