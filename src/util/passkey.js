import { insertRecord, findRecord, deleteRecord, replaceRecord } from "./mongo";
import { 
    generateRegistrationOptions, 
    verifyRegistrationResponse, 
    generateAuthenticationOptions, 
    verifyAuthenticationResponse 
} from "@simplewebauthn/server";

const rpName = "System Concepts"; 

/**
 * Updated to accept dynamic rpID and origin.
 * If they aren't provided (fallback), it uses the env vars.
 */
export async function getPasskeyRegistrationOptions({ id, email, rpID = process.env.WEBAUTHN_RP_ID }) {
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) throw "USER_NOT_FOUND";

    const credentials = user.credentials || [];

    const options = await generateRegistrationOptions({
        rpName,
        rpID, // Use the dynamic ID
        userID: id,
        userName: email || user.email,
        excludeCredentials: credentials.map(cred => ({
            id: cred.id,
            transports: cred.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });

    await insertRecord({
        collectionName: "challenges",
        record: {
            userId: id,
            challenge: options.challenge,
            createdAt: new Date(),
            type: 'register'
        }
    });

    return options;
}

export async function verifyPasskeyRegistration({ id, response, origin, rpID }) {
    id = id.toLowerCase();
    const challengeRecord = await findRecord({
        collectionName: "challenges",
        query: { userId: id, type: 'register' }
    });

    if (!challengeRecord) throw "CHALLENGE_NOT_FOUND";

    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin, // Use the dynamic origin
        expectedRPID: rpID,     // Use the dynamic RP ID
    });

    if (verification.verified) {
        const { registrationInfo } = verification;
        const { credential } = registrationInfo;

        const user = await findRecord({ collectionName: "users", query: { id } });
        const credentials = user.credentials || [];

        const newCredential = {
            id: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString('base64'),
            counter: credential.counter,
            transports: credential.transports,
            deviceType: registrationInfo.credentialDeviceType,
            backedUp: registrationInfo.credentialBackedUp
        };

        credentials.push(newCredential);

        await replaceRecord({
            collectionName: "users",
            query: { id },
            record: { ...user, credentials }
        });

        await deleteRecord({
            collectionName: "challenges",
            query: { userId: id, type: 'register' }
        });

        return { verified: true };
    }

    throw "VERIFICATION_FAILED";
}

export async function getPasskeyAuthOptions({ id, rpID }) {
    let user = null;
    if (id) {
        id = id.toLowerCase();
        user = await findRecord({ collectionName: "users", query: { id } });
    }

    if (!user && id) throw "USER_NOT_FOUND";

    const options = await generateAuthenticationOptions({
        rpID, // Use the dynamic ID
        allowCredentials: user ? (user.credentials || []).map(cred => ({
            id: cred.id,
            transports: cred.transports,
        })) : [],
        userVerification: 'preferred',
    });

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
    id = id.toLowerCase();
    const challengeRecord = await findRecord({
        collectionName: "challenges",
        query: { userId: id, type: 'auth' }
    });

    if (!challengeRecord) throw "CHALLENGE_NOT_FOUND";

    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) throw "USER_NOT_FOUND";

    const credential = (user.credentials || []).find(c => c.id === response.id);
    if (!credential) throw "CREDENTIAL_NOT_FOUND";

    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: origin, // Use dynamic origin
        expectedRPID: rpID,     // Use dynamic RP ID
        authenticator: {
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
            counter: credential.counter,
            transports: credential.transports,
        },
    });

    if (verification.verified) {
        credential.counter = verification.authenticationInfo.newCounter;

        const dateObj = new Date();
        await replaceRecord({
            collectionName: "users",
            query: { id },
            record: {
                ...user,
                date: dateObj.toString(),
                utc: dateObj.getTime()
            }
        });

        await deleteRecord({
            collectionName: "challenges",
            query: { userId: id, type: 'auth' }
        });

        return user;
    }

    throw "VERIFICATION_FAILED";
}
