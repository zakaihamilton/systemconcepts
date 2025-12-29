import { findRecord, insertRecord, replaceRecord } from "./mongo";
import { compare, hash } from "bcryptjs";
import resetPasswordTemplate from "@data/resetPasswordTemplate";
import { v4 as uuidv4 } from 'uuid';

import gmailSend from "gmail-send";

const sendResetMail = gmailSend({
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
    from: process.env.GMAIL_FROM,
    subject: "Reset Password",
});

export async function login({ id, password, hash, api, path }) {
    if (!id) {
        console.error("empty user id");
        throw "USER_NOT_FOUND";
    }
    console.log("user:", id, "api:", api, "path", path);
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
    const dateObj = new Date();
    const date = dateObj.toString();
    const utc = dateObj.getTime();
    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            date,
            utc
        }
    });
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

export async function changePassword({ api, id, oldPassword, newPassword, salt = 10 }) {
    id = id.toLowerCase();
    let user = await login({ id, password: oldPassword, api });
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

export async function resetPassword({ api, id, code, newPassword, salt = 10 }) {
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
        throw "USER_NOT_FOUND";
    }

    // Verify reset token
    if (!user.resetToken) {
        console.error("Invalid reset token for user", id);
        throw "INVALID_TOKEN";
    }

    const match = await compare(code, user.resetToken);
    if (!match) {
        console.error("Invalid reset token for user", id);
        throw "INVALID_TOKEN";
    }

    if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
        console.error("Expired reset token for user", id);
        throw "TOKEN_EXPIRED";
    }

    let result = null;
    try {
        result = await hash(newPassword, salt);
    }
    catch (err) {
        console.error(err);
        throw err;
    }

    // Clear reset token and update password
    const updatedUser = { ...user, hash: result };
    delete updatedUser.resetToken;
    delete updatedUser.resetTokenExpiry;

    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: updatedUser
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

    const resetToken = uuidv4();
    const resetTokenHash = await hash(resetToken, 10);
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save reset token to user
    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            resetToken: resetTokenHash,
            resetTokenExpiry
        }
    });

    let emailText = resetPasswordTemplate;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    emailText = emailText.replace(/{{name}}/g, fullName);
    // Use resetToken instead of user.hash
    emailText = emailText.replace(/{{resetlink}}/g, process.env.SITE_URL + "#/" + encodeURIComponent("resetpassword/" + resetToken));

    if (!sendResetMail || typeof sendResetMail !== 'function') {
        console.error("Email service not configured properly");
        throw "EMAIL_SERVICE_ERROR";
    }

    await sendResetMail({ to: user.email, text: emailText });
}
