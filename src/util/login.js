const { listCollection } = require("./mongo");
const { compare, hash } = require("bcrypt");
const { error } = require("./logger");

export async function login({ userId, password, hash }) {
    if (!userId) {
        throw `No userId passed in header`;
    }
    if (!password && !hash) {
        throw `No password or hash passed in header`;
    }
    let users = null;
    try {
        users = await listCollection({ collectionName: "users" }) || [];
    }
    catch (err) {
        error(err);
        throw "Cannnot access list of users";
    }
    const user = users.find(user => user.userId === userId);
    if (!user) {
        throw `Cannot find user ${userId}`;
    }
    if (password) {
        const result = await compare(password, user.hash);
        if (!result) {
            throw `Password does not match`;
        }
    }
    else if (hash !== user.hash) {
        throw `Hash does not match`;
    }
    return { roleId: user.roleId, hash: user.hash, userId: user.userId };
}

export async function register({ firstName, lastName, email, password, salt = 10 }) {
    let result = undefined;
    try {
        result = await hash(password, salt);
    }
    catch (err) {
        console.error(err);
        throw err;
    }
    return result;
}
