import { findRecord, insertRecord, replaceRecord } from "./mongo";
import { compare, hash } from "bcrypt";
import resetPasswordTemplate from '@/data/resetPasswordTemplate';

const sendResetMail = require('gmail-send')({
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
    from: process.env.GMAIL_FROM,
    subject: 'Reset Password',
});

export async function login({ id, password, hash }) {
    if (!id) {
        console.error("empty user id");
        throw "USER_NOT_FOUND";
    }
    console.log("user", id, "is logging in...");
    id = id.toLowerCase();
    let user = null;
    try {
        user = await findRecord({ collectionName: "users", query: { id } });
    }
    catch (err) {
        console.error("Error finding record for user", id, err);
        throw "USER_NOT_FOUND";
    }
    if (!user) {
        console.error("cannot find user for: ", id);
        throw "USER_NOT_FOUND";
    }
    if (password) {
        const result = await compare(password, user.hash);
        if (!result) {
            console.error("wrong password for user", id);
            throw "WRONG_PASSWORD";
        }
    }
    else if (hash !== user.hash) {
        console.error("wrong password for user", id);
        throw "WRONG_PASSWORD";
    }
    return user;
}

export async function register({ id, firstName, lastName, email, password, salt = 10 }) {
    id = id.toLowerCase();
    let result = undefined;
    const user = await findRecord({ collectionName: "users", query: { id } });
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
            id: id.toLowerCase(),
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
    id = id.toLowerCase();
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

export async function resetPassword({ id, code, newPassword, salt = 10 }) {
    id = id.toLowerCase();
    let user = await login({ id, hash: code });
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

export async function sendResetEmail({ id }) {
    id = id.toLowerCase();
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
    let emailText = resetPasswordTemplate;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    emailText = emailText.replace(/{{name}}/g, fullName);
    emailText = emailText.replace(/{{resetlink}}/g, process.env.SITE_URL + "#/" + encodeURIComponent("resetpassword/" + user.hash));
    await sendResetMail({ to: user.email, text: emailText });
}