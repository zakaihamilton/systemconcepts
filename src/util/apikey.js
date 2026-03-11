import { findRecord, replaceRecord } from "./mongo";
import { hash as bcryptHash, compare } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function getApiKeys({ id }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const apiKeys = user.apiKeys || [];
    // Return keys without the actual hash for security
    return apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        createdAt: key.createdAt
    }));
}

export async function createApiKey({ id, name }) {
    if (!id) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const keyId = uuidv4();
    const rawSecret = uuidv4();
    const apiKey = `${id}:${rawSecret}`;

    // Hash the raw secret before storing it
    const hashedSecret = await bcryptHash(rawSecret, 10);

    const newKeyRecord = {
        id: keyId,
        hash: hashedSecret,
        name: name || "API Key",
        createdAt: new Date().toISOString()
    };

    const currentKeys = user.apiKeys || [];
    currentKeys.push(newKeyRecord);

    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            apiKeys: currentKeys
        }
    });

    return { apiKey, keyId, name: newKeyRecord.name, createdAt: newKeyRecord.createdAt };
}

export async function deleteApiKey({ id, keyId }) {
    if (!id || !keyId) {
        throw "MISSING_ID";
    }
    id = id.toLowerCase();
    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const currentKeys = user.apiKeys || [];
    const newKeys = currentKeys.filter(key => key.id !== keyId);

    if (currentKeys.length === newKeys.length) {
        throw "KEY_NOT_FOUND";
    }

    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            apiKeys: newKeys
        }
    });

    return { success: true };
}

export async function validateApiKey(apiKey) {
    if (!apiKey) {
        throw "MISSING_API_KEY";
    }

    const parts = apiKey.split(":");
    if (parts.length !== 2) {
        throw "INVALID_API_KEY_FORMAT";
    }

    const id = parts[0].toLowerCase();
    const rawSecret = parts[1];

    const user = await findRecord({ collectionName: "users", query: { id } });
    if (!user) {
        throw "USER_NOT_FOUND";
    }

    const apiKeys = user.apiKeys || [];
    if (apiKeys.length === 0) {
        throw "INVALID_API_KEY";
    }

    // Check against all keys for this user
    for (const key of apiKeys) {
        const match = await compare(rawSecret, key.hash);
        if (match) {
            // Update last used time if desired
            return user;
        }
    }

    throw "INVALID_API_KEY";
}
