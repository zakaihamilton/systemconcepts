const { login } = require("../../src/util/login");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        let error = null;
        let params = {};
        try {
            const { email, password, hash } = req.headers || {};
            params = await login({ email, password, hash });
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
        res.status(200).json({ ...error && { err: error.toString() }, ...params });
    }
};
