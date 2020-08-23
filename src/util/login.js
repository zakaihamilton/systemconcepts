const { listCollection } = require("./mongo");
const { compare, hash } = require("bcrypt");
const { error } = require("./logger");

export async function login({ email, password, hash }) {
    if (!email) {
        throw `No email passed in header`;
    }
    if (!password && !hash) {
        throw `No password or hash passed in header`;
    }
    let users = null;
    try {
        users = await listCollection({ collectionName: "users" }) || [];
    }
    catch (err) {
        console.error(err);
        throw "Cannnot access list of users";
    }
    const user = users.find(user => user.email === email);
    if (!user) {
        console.error("Cannot find user: " + email);
        throw "USER_NOT_FOUND";
    }
    if (password) {
        const result = await compare(password, user.hash);
        if (!result) {
            throw "WRONG_PASSWORD";
        }
    }
    else if (hash !== user.hash) {
        throw "WRONG_PASSWORD";
    }
    return { roleId: user.roleId, hash: user.hash, email: user.email };
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
