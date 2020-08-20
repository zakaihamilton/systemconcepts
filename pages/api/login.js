const { login } = require("../../src/util/login");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        let error = null;
        let params = {};
        try {
            const { user: userId, password, hash } = req.headers || {};
            params = await login({ userId, password, hash });
        }
        catch (err) {
            error = err;
        }
        if (error) {
            console.error("login error: ", error);
        }
        else {
            console.log("login success", params);
        }
        res.status(200).json({ ...error && { error }, ...params });
    }
};
