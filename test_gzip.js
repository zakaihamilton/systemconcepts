const pako = require("pako");
const fs = require("fs");

function testGzipStability() {
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
            // console.log(`Chunk ${i} differs.`);
        }
    }

    console.log(`Total Chunks: ${chunks1.length}`);
    console.log(`Changed Chunks: ${diffCount}`);
    console.log(`Percentage Changed: ${(diffCount / chunks1.length * 100).toFixed(2)}%`);
}

testGzipStability();
