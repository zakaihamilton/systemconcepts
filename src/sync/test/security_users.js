const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Helper to load module in sandbox
function loadModule(relativePath, mocks) {
    const fullPath = path.resolve(__dirname, '../../..', relativePath);
    let code = fs.readFileSync(fullPath, 'utf8');

    // Strip imports
    code = code.replace(/import .* from .*;/g, '');
    code = code.replace(/import .* from ".*"/g, '');

    // Strip exports
    code = code.replace(/export default async function/g, 'async function');

    const sandbox = {
        console,
        Buffer,
        JSON,
        Promise,
        ...mocks
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.USERS_API;
}

async function runTest() {
    console.log("Running Security Test for Users API...");

    let handledReqBody = null;

    const mocks = {
        // Mocks
        handleRequest: async ({ req }) => {
            handledReqBody = req.body;
            return []; // Return empty array as result
        },
        findRecord: async ({ query: _query }) => {
            // Return a mock user record
            return {
                id: "user1",
                role: "visitor",
                hash: "hashed_password", // Original hash
                firstName: "OriginalFirst",
                lastName: "OriginalLast",
                email: "original@example.com"
            };
        },
        login: async () => ({ id: "user1", role: "visitor" }),
        roleAuth: (role, check) => role === check,
        parseCookie: () => ({ id: "user1", hash: "hash1" }),
        getSafeError: (err) => err,
        // Mock escapeHTML to verify it's called.
        // We use a simple replacement to distinguish from real implementation if needed,
        // but checking the output format is enough.
        escapeHTML: (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;"),

        // Globals needed
        decodeURIComponent: decodeURIComponent
    };

    const USERS_API = loadModule('pages/api/users.js', mocks);

    // Test Case: Non-admin updates profile with malicious fields and XSS
    const req = {
        method: "PUT",
        headers: {
            id: "user1", // queryId
            cookie: "id=user1; hash=hash1"
        },
        body: {
            id: "user1",
            role: "visitor", // Must match record to pass pre-check
            hash: "hacked", // Malicious: Try to change password hash via Mass Assignment
            maliciousField: "ShouldNotBeHere", // Malicious: Mass Assignment
            firstName: "<script>alert(1)</script>", // Malicious: XSS
            lastName: "NewLast" // Valid update
        }
    };

    const res = {
        status: (_code) => ({
            json: (_data) => {
                // console.log("Response:", code, data);
            }
        })
    };

    try {
        await USERS_API(req, res);

        // Assertions
        assert.ok(handledReqBody, "handleRequest should have been called");

        // 1. Check Mass Assignment (hash should be protected)
        assert.strictEqual(handledReqBody.hash, "hashed_password", "Hash should remain original (Mass Assignment prevented)");

        // 2. Check Mass Assignment (maliciousField should be gone)
        assert.strictEqual(handledReqBody.maliciousField, undefined, "maliciousField should be removed");

        // 3. Check XSS (firstName should be escaped)
        assert.strictEqual(handledReqBody.firstName, "&lt;script&gt;alert(1)&lt;/script&gt;", "firstName should be escaped");

        // 4. Check Allowed Updates
        assert.strictEqual(handledReqBody.lastName, "NewLast", "lastName should be updated");

        console.log("✅ Security Test Passed!");
    } catch (err) {
        console.error("❌ Test Failed:", err);
        process.exit(1);
    }
}

runTest();
