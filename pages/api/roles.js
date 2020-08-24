const { handleRequest } = require("@/util/mongo");

const collectionName = "roles";

module.exports = async (req, res) => {
    await handleRequest({ collectionName, req, res });
};
