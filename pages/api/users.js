const { listCollection } = require("@/util/mongo");

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
    }
};
