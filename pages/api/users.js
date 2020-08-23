const { listCollection, deleteRecord } = require("@/util/mongo");

module.exports = async (req, res) => {
    if (req.method === "GET") {
        try {
            const result = await listCollection({ collectionName: "users" });
            res.status(200).json(result);
        }
        catch (err) {
            console.error("login error: ", err);
            res.status(200).json({ err: err.toString() });
        }
    } else if (req.method === "DELETE") {
        try {
            const { email } = req.headers || {};
            await deleteRecord({ query: { email }, collectionName: "users" });
            res.status(200).json({});
        }
        catch (err) {
            console.error("login error: ", err);
            res.status(200).json({ err: err.toString() });
        }
    }
};
