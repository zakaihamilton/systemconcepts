const { register } = require("../../src/util/login");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        try {
            const { email, first_name, last_name, password } = req.headers || {};
            const hash = await register({ email, firstName: first_name, lastName: last_name, password });
            res.status(200).json({ hash });
        }
        catch (err) {
            console.error("login error: ", err);
            res.status(200).json({ err: err.toString() });
        }
    }
};
