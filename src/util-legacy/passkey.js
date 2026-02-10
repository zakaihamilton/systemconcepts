import { insertRecord, findRecord, deleteRecord, replaceRecord } from "./mongo";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { hash } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const rpName = "App"; // Should be configurable


export async function getPasskeyRegistrationOptions({ id, email, firstName, lastName, rpID, authenticated }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });

    if (user && !authenticated) {
        throw "USER_ALREADY_EXISTS";
    }

    const credentials = user ? (user.credentials || []) : [];

    // Cleanup existing challenges for this user and action
    await deleteRecord({
        collectionName: "challenges",
        query: { userId: id, type: 'register' }
    });

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(id), // Encode string ID to Buffer
        userName: email || (user && user.email) || id,
        // Don't exclude credentials for now, or fetch them from user.credentials
        excludeCredentials: credentials.map(cred => ({
            id: cred.id,
            transports: cred.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
            // Removed authenticatorAttachment: 'platform' to support security keys
        },
    });

    // Clean userInfo to avoid undefined values
    const userInfo = !user ? {
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null
    } : null;

    // Store challenge
    await insertRecord({
        collectionName: "challenges",
        record: {
            userId: id,
            challenge: options.challenge,
            createdAt: new Date(),
            type: 'register',
            userInfo
        }
    });

    return options;
}

export async function verifyPasskeyRegistration({ id, response, name, origin, rpID, authenticated }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const challengeRecord = await findRecord({
        collectionName: "challenges",
        query: { userId: id, type: 'register' }
    });

    if (!challengeRecord) {
        throw "CHALLENGE_NOT_FOUND";
    }

    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
    });

    if (verification.verified) {
        const { registrationInfo } = verification;
        const { credential } = registrationInfo;

        let user = await findRecord({ collectionName: "users", query: { id } });

        // Security check: If user exists, we must be authenticated to add a passkey
        if (user && !authenticated) {
            // This case should be caught by getPasskeyRegistrationOptions usually,
            // but if an attacker got a challenge for a new user, and then the user was created in the meantime?
            // Or if getPasskeyRegistrationOptions allowed it (race condition?)
            // We should strictly enforce it here.
            throw "USER_ALREADY_EXISTS";
        }

        const newCredential = {
            id: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString('base64'),
            counter: credential.counter,
            transports: credential.transports,
            deviceType: registrationInfo.credentialDeviceType,
            backedUp: registrationInfo.credentialBackedUp,
            name: name || `Passkey ${user && user.credentials ? user.credentials.length + 1 : 1}`,
            createdAt: new Date().toISOString()
        };

        if (!user) {
            // Create new user
            const userInfo = challengeRecord.userInfo || {};
            const dateObj = new Date();
            const date = dateObj.toString();
            const utc = dateObj.getTime();
            const role = "visitor";

            // Generate a random hash for the user (as session token)
            const password = uuidv4();
            const result = await hash(password, 10);

            user = {
                id,
                email: userInfo.email || id, // Default to id if email missing
                firstName: userInfo.firstName || null,
                lastName: userInfo.lastName || null,
                credentials: [newCredential],
                date,
                utc,
                role,
                hash: result
            };

            await insertRecord({
                collectionName: "users",
                record: user
            });
        } else {
            // Update existing user
            const credentials = user.credentials || [];
            credentials.push(newCredential);

            await replaceRecord({
                collectionName: "users",
                query: { id },
                record: {
                    ...user,
                    credentials
                }
            });
        }

        // Delete challenge
        await deleteRecord({
            collectionName: "challenges",
            query: { userId: id, type: 'register' }
        });

        // Return user so we can access user.hash if needed (though API might not use it for reg verify)
        return { verified: true, user };
    }

    throw "VERIFICATION_FAILED";
}

export async function getPasskeys({ id }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }
    return (user.credentials || []).map(cred => ({
        id: cred.id,
        name: cred.name || "Passkey",
        createdAt: cred.createdAt
    }));
}

export async function deletePasskey({ id, credentialId }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const credentials = (user.credentials || []).filter(cred => cred.id !== credentialId);

    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            credentials
        }
    });
    return { success: true };
}

export async function getPasskeyAuthOptions({ id, rpID }) {
    let user = null;
    if (id) {
        id = id.toLowerCase();
        user = await findRecord({ collectionName: "users", query: { id } });
    }

    // If no ID is provided, we might be doing discoverable credentials (usernameless).
    // But for now let's assume we know the user ID or email (from the form).
    // If id is provided:

    if (!user && id) {
        // User might not exist yet if they typed a wrong ID, but we shouldn't reveal that?
        // But for auth options we need to know if we are targeting a specific user.
        throw "USER_NOT_FOUND";
    }

    // Cleanup existing challenges for this user and action
    if (id) {
        await deleteRecord({
            collectionName: "challenges",
            query: { userId: id, type: 'auth' }
        });
    }

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user ? (user.credentials || []).map(cred => ({
            id: cred.id,
            transports: cred.transports,
        })) : [],
        userVerification: 'preferred',
    });

    // Store challenge. If we don't know the user yet (discoverable), we might need a session ID.
    // But here we rely on the client sending the ID back?
    // If we use discoverable credentials, we don't know the user ID at this point.
    // So we can store the challenge with a temporary ID or just the challenge itself.
    // But verify needs to retrieve it.
    // Let's assume the client sends the ID they are trying to login as, OR we handle discoverable.
    // If discoverable, we store challenge keyed by... session cookie?
    // The current app doesn't have a pre-login session.
    // So we'll mandate entering the username first for now to keep it simple and consistent with current flow.

    await insertRecord({
        collectionName: "challenges",
        record: {
            userId: id,
            challenge: options.challenge,
            createdAt: new Date(),
            type: 'auth'
        }
    });

    return options;
}

export async function verifyPasskeyAuth({ id, response, origin, rpID }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const challengeRecord = await findRecord({
        collectionName: "challenges",
        query: { userId: id, type: 'auth' }
    });

    if (!challengeRecord) {
        throw "CHALLENGE_NOT_FOUND";
    }

    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const credId = response.id;
    const credential = (user.credentials || []).find(c => c.id === credId);

    if (!credential) {
        throw "CREDENTIAL_NOT_FOUND";
    }

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
            counter: credential.counter,
        },
    });

    if (verification.verified) {
        const { authenticationInfo } = verification;

        // Update counter
        credential.counter = authenticationInfo.newCounter;

        await replaceRecord({
            collectionName: "users",
            query: { id },
            record: {
                ...user,
                // credentials is a reference to the array in user, so modifying it inside works?
                // No, we need to ensure the array is updated in the object we save.
                // It is modified in place above? Yes.
            }
        });

        // Delete challenge
        await deleteRecord({
            collectionName: "challenges",
            query: { userId: id, type: 'auth' }
        });

        // Perform login (update last login time, etc.)
        // We can reuse the login function or part of it.
        // The `login` function in `src/util/login.js` does:
        // 1. Check password (skipped here)
        // 2. Update date/utc
        // 3. Return user

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

    throw "VERIFICATION_FAILED";
}
