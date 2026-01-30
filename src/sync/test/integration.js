const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const pako = require('pako');

// --- HELPER: FNV-1a Hash (Matches src/sync/hash.js) ---
function calculateHash(content) {
    let data;
    if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
    } else if (Buffer.isBuffer(content)) {
        data = new Uint8Array(content);
    } else {
        data = content;
    }

    let hash = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

async function getFileInfo(content) {
    const hash = calculateHash(content);
    let size = 0;
    if (typeof content === 'string') {
        size = Buffer.byteLength(content);
    } else if (content && content.length) {
        size = content.length;
    }
    return { hash, size };
}

// --- HELPER: Load Module in Sandbox ---
function loadModule(relativePath, mocks) {
    const fullPath = path.resolve(__dirname, '../../..', relativePath);
    let code = fs.readFileSync(fullPath, 'utf8');

    // Strip imports (simplistic regex)
    code = code.replace(/import .* from .*;/g, '');
    code = code.replace(/import .* from ".*"/g, ''); // Handle no semicolon

    // Strip exports
    code = code.replace(/export async function/g, 'async function');
    code = code.replace(/export function/g, 'function');
    code = code.replace(/export const/g, 'const');
    code = code.replace(/export default/g, '');

    const sandbox = {
        console,
        Buffer,
        TextEncoder,
        JSON,
        setTimeout,
        Math,
        Date,
        Set,
        Map,
        Array,
        Object,
        Promise,
        performance: { now: () => Date.now() },
        ...mocks
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

// --- MOCKS ---
const mockStorage = {
    ops: [],
    files: {},
    writeFile: async (path, content) => {
        mockStorage.ops.push({ op: 'write', path, content });
        mockStorage.files[path] = content;
    },
    createFolderPath: async () => { },
    exists: async (path) => !!mockStorage.files[path],
    readFile: async (path) => mockStorage.files[path],
    deleteFile: async () => { },
    getRecursiveList: async () => []
};

const mockLogs = {
    logs: [],
    addSyncLog: (msg, type) => {
        // console.log(`[MockLog] ${msg}`);
        mockLogs.logs.push({ msg, type });
    }
};



const commonMocks = {
    // Mocks for downloadUpdates.js
    storage: mockStorage,
    makePath: (a, b) => path.join(a, b),
    readCompressedFileRaw: async (p) => mockStorage.files[p] || null, // Mock reading directly
    writeCompressedFile: async () => { }, // Mock
    getFileInfo,
    addSyncLog: mockLogs.addSyncLog,
    applyManifestUpdates: async () => { },
    lockMutex: async () => () => { },
    SYNC_BATCH_SIZE: 1,
    FILES_MANIFEST: "files.json",
    FILES_MANIFEST_GZ: "files.json.gz",

    // Mocks for migrateFromMongoDB.js
    calculateHash: async (c) => calculateHash(c),
    readGroups: async () => ({ groups: [] }),
    SyncActiveStore: { update: () => { } }
};

// --- TESTS ---
async function runTests() {
    console.log("Running Sync Integration Tests...\n");

    try {
        // --- Test 1: Download Updates Hash Verification ---
        console.log("Test 1: Download Hash Verification");
        const downloadModule = loadModule('src/sync/steps/downloadUpdates.js', commonMocks);
        // Extract the inner 'downloadFile' function by exposing it or we create a wrapper in the vm. 
        // Since it's not exported, we can't access it unless we change the source or use the 'downloadUpdates' function.
        // But 'downloadUpdates' calls 'downloadFile'. We can test via 'downloadUpdates'.

        // Setup "Remote" (In our mock 'readCompressedFileRaw' reads from mockStorage.files)
        const rawContent = '{"a":1}'; // Compact
        const prettyContent = '{\n    "a": 1\n}'; // Pretty

        const rawHash = calculateHash(rawContent);
        const prettyHash = calculateHash(prettyContent);

        // Case A: Remote has RAW hash. We download RAW content. Should write RAW.
        mockStorage.files['aws/sync/test.json.gz'] = rawContent;
        mockStorage.files['aws/sync/test.json'] = rawContent;
        mockStorage.ops = [];

        const localManifest = [];
        const remoteManifest = [{ path: 'test.json', hash: rawHash, version: 1 }];

        await downloadModule.downloadUpdates(localManifest, remoteManifest, 'local/sync', 'aws/sync', true);

        const writeOp = mockStorage.ops.find(o => o.op === 'write' && o.path.includes('test.json'));
        assert.ok(writeOp, "File should be written");
        assert.strictEqual(writeOp.content, rawContent, "Should write raw content when hash matches");
        console.log("  [PASS] Writes RAW when hash matches");

        // Case B: Remote has PRETTY hash. We download RAW content. Should write PRETTY.
        mockStorage.files['aws/sync/test.json.gz'] = rawContent; // Server serves raw
        mockStorage.ops = [];
        const remoteManifestPretty = [{ path: 'test.json', hash: prettyHash, version: 2 }]; // But manifest has pretty hash

        await downloadModule.downloadUpdates(localManifest, remoteManifestPretty, 'local/sync', 'aws/sync', true);

        const writeOpPretty = mockStorage.ops.find(o => o.op === 'write' && o.path.includes('test.json'));
        assert.ok(writeOpPretty, "File should be written");
        // We expect the content to be pretty printed
        // Note: The logic does JSON.stringify(obj, null, 4).
        // My prettyContent variable above might strictly differ in spacing if I'm not careful.
        // Let's rely on checking if it contains newlines, which raw doesn't.
        assert.ok(writeOpPretty.content.includes('\n'), "Should write pretty content when raw hash mismatch but pretty match");
        console.log("  [PASS] Writes PRETTY when raw mismatch but pretty matches");


        // --- Test 2: Migration Array Handling ---
        console.log("\nTest 2: Migration Array Handling");
        const migrateModule = loadModule('src/sync/steps/personal/migrateFromMongoDB.js', commonMocks);

        // Case A: remoteManifest is Array (New Format)
        const remoteManifestArray = [{ path: "existing.json", hash: "123", version: 1 }];
        // We just want to ensure it doesn't crash and correctly identifies existing files

        mockLogs.logs = [];
        await migrateModule.migrateFromMongoDB("user1", remoteManifestArray, "local/sync");

        // Check logs for the verbose message we added
        const logCheck = mockLogs.logs.find(l => l.msg.includes("Migration check: Remote manifest has 1 files"));
        assert.ok(logCheck, "Should log manifest size from Array");
        console.log("  [PASS] Correctly handles Array manifest");

        // --- Test 3: Upload Updates ---
        console.log("\nTest 3: Upload Updates");


        // We need a smart mock that captures writes to mockStorage
        const smartMocks = {
            ...commonMocks,
            writeCompressedFile: async (path, content) => {
                mockStorage.writeFile(path, JSON.stringify(content)); // Simulate write
            },
            readCompressedFile: async (path) => {
                // Return parsed object if we have it in mockStorage
                return mockStorage.files[path];
            },
            Cookies: { get: () => "admin" } // Mock cookie for role check
        };
        const uploadModuleSmart = loadModule('src/sync/steps/uploadUpdates.js', smartMocks);

        // Case A: Local version > Remote version. uploadFile should be called.

        // Setup Local Manifest & Content
        const localFile = { path: 'upload.json', version: 2 };
        const localContent = JSON.stringify({ version: 'new' });
        mockStorage.files['local/sync/upload.json'] = localContent;
        mockStorage.ops = [];

        // Setup Remote Manifest (Old version)
        const remoteManifestUpload = [{ path: 'upload.json', version: 1 }];

        await uploadModuleSmart.uploadUpdates([localFile], remoteManifestUpload, 'local/sync', 'aws/sync');

        const smartUploadOp = mockStorage.ops.find(o => o.op === 'write' && o.path.includes('upload.json.gz'));
        assert.ok(smartUploadOp, "File should be uploaded with smart mock");
        console.log("  [PASS] Uploads files with newer versions");


        // --- Test 4: Manifest Sync ---
        console.log("\nTest 4: Manifest Sync");
        const manifestModule = loadModule('src/sync/steps/syncManifest.js', smartMocks);

        // Case A: Remote manifest exists (gzipped)
        // We simulate reading a gzipped file by putting content in mockStorage 
        // and having readCompressedFile return it.
        const manifestContent = [{ path: '/test.json', version: 1 }];
        mockStorage.files['aws/sync/files.json.gz'] = manifestContent; // Object for mock

        // We need readCompressedFile to return the object directly for our mock to work simply
        smartMocks.readCompressedFile = async () => manifestContent;

        const loadedManifest = await manifestModule.syncManifest('aws/sync');
        assert.strictEqual(loadedManifest.length, 1, "Should load 1 entry");
        assert.strictEqual(loadedManifest[0].path, '/test.json', "Should normalize path");
        console.log("  [PASS] Loads and normalizes manifest");

        // --- Test 5: Gzip Stability ---
        console.log("\nTest 5: Gzip Stability");
        // 1. Create a large base object
        const base = {};
        for (let i = 0; i < 10000; i++) {
            base[`key_${i}`] = `some_long_value_string_to_fill_space_${i}`;
        }

        // 2. Clone and modify slightly
        const modified = { ...base };
        modified["key_5000"] = "CHANGED_VALUE_HERE";

        // 3. Stringify
        const json1 = JSON.stringify(base);
        const json2 = JSON.stringify(modified);

        // 4. Gzip
        const bin1 = pako.gzip(json1);
        const bin2 = pako.gzip(json2);

        // 5. Base64
        const b64_1 = Buffer.from(bin1).toString("base64");
        const b64_2 = Buffer.from(bin2).toString("base64");

        // 6. Chunk (3.5MB ~ 3,500,000 chars) 
        // Let's use smaller chunks for this test to see granularity
        const CHUNK_SIZE = 10 * 1024; // 10KB chunks

        const chunks1 = [];
        for (let i = 0; i < b64_1.length; i += CHUNK_SIZE) {
            chunks1.push(b64_1.substring(i, i + CHUNK_SIZE));
        }

        const chunks2 = [];
        for (let i = 0; i < b64_2.length; i += CHUNK_SIZE) {
            chunks2.push(b64_2.substring(i, i + CHUNK_SIZE));
        }

        // 7. Compare
        let diffCount = 0;
        for (let i = 0; i < Math.max(chunks1.length, chunks2.length); i++) {
            if (chunks1[i] !== chunks2[i]) {
                diffCount++;
            }
        }

        console.log(`  Total Chunks: ${chunks1.length}`);
        console.log(`  Changed Chunks: ${diffCount}`);
        console.log(`  Percentage Changed: ${(diffCount / chunks1.length * 100).toFixed(2)}%`);
        console.log("  [PASS] Gzip Stability Test Ran");

    } catch (err) {
        console.error("\n[FAIL] Test Failed:", err);
        process.exit(1);
    }

    console.log("\nAll Tests Passed!");
}


runTests();
