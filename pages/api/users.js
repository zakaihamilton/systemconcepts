const { handleRequest } = require("@/util/mongo");

const collectionName = "users";

module.exports = async (req, res) => {
    await handleRequest({ collectionName, req, res });
};
