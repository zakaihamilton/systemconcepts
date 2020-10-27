const { login, register, changePassword, resetPassword, sendResetEmail } = require("@util/login");

export default async (req, res) => {
    if (req.method === "GET") {
        let error = null;
        let params = {};
        try {
            const { id, password, hash } = req.headers || {};
            params = await login({
                id,
                password: decodeURIComponent(password),
                hash,
                api: "login"
            });
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
    else if (req.method === "PUT") {
        const headers = req.headers || {};
        if (headers.reset) {
            try {
                const { id } = headers;
                await sendResetEmail({ id });
                res.status(200).json({});
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: err.toString() });
            }
        }
        else if (headers.newpassword && headers.code) {
            try {
                const { id, code, newpassword } = headers;
                const hash = await resetPassword({
                    id,
                    code,
                    newPassword: decodeURIComponent(newpassword),
                    api: "login"
                });
                res.status(200).json({ hash });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: err.toString() });
            }
        }
        else if (headers.oldpassword && headers.newpassword) {
            try {
                const { id, oldpassword, newpassword } = headers;
                const hash = await changePassword({
                    id,
                    oldPassword: decodeURIComponent(oldpassword),
                    newPassword: decodeURIComponent(newpassword),
                    api: "login"
                });
                res.status(200).json({ hash });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: err.toString() });
            }
        }
        else {
            try {
                const { id, email, first_name, last_name, password } = headers;
                const hash = await register({
                    id,
                    email,
                    firstName: decodeURIComponent(first_name),
                    lastName: decodeURIComponent(last_name),
                    password: decodeURIComponent(password)
                });
                res.status(200).json({ hash });
            }
            catch (err) {
                console.error("login error: ", err);
                res.status(200).json({ err: err.toString() });
            }
        }
    }
};
