const { findRecord, insertRecord, replaceRecord } = require("./mongo");
const { compare, hash } = require("bcrypt");

export async function login({ id, password, hash }) {
    let user = null;
    try {
        user = await findRecord({ collectionName: "users", query: { id } });
    }
    catch (err) {
        console.error(err);
        throw "USER_NOT_FOUND";
    }
    if (!user) {
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
    return user;
}

export async function register({ id, firstName, lastName, email, password, salt = 10 }) {
    let result = undefined;
    const user = await findRecord({ collectionName: "users", query: { email } });
    if (user) {
        throw "USER_ALREADY_EXISTS";
    }
    try {
        result = await hash(password, salt);
    }
    catch (err) {
        console.error(err);
        throw err;
    }
    const dateObj = new Date();
    const date = dateObj.toString();
    const utc = dateObj.getTime();
    const role = "visitor";
    await insertRecord({
        collectionName: "users",
        record: {
            id,
            firstName,
            lastName,
            email,
            hash: result,
            date,
            utc,
            role
        }
    });
    return result;
}

export async function changePassword({ id, oldPassword, newPassword, salt = 10 }) {
    let user = await login({ id, password: oldPassword });
    let result = null;
    try {
        result = await hash(newPassword, salt);
    }
    catch (err) {
        console.error(err);
        throw err;
    }
    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            hash: result
        }
    });
    return result;
}
