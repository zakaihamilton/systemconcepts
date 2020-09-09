const { handleRequest } = require("@/util/mongo");
const { login } = require("../../src/util/login");
var Cookie = require('cookie');

module.exports = async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie, sync } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        let collectionName = "fs";
        let readOnly = true;
        if (id && hash) {
            await login({ id, hash });
            collectionName += "_" + id;
            readOnly = false;
        }
        if (sync && req.method === "GET") {
            const shared = await handleRequest({ collectionName: "fs", req, readOnly });
            const private = await handleRequest({ collectionName, req, readOnly });
            res.status(200).json([...shared, ...private]);
        }
        else {
            const result = await handleRequest({ collectionName, req, readOnly });
            res.status(200).json(result);
        }
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
