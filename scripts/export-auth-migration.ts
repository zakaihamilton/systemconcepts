import { createCipheriv, randomBytes } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

const OUTPUT_FLAG = "--output";
const outputIndex = process.argv.indexOf(OUTPUT_FLAG);
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
if (!outputPath || outputIndex !== process.argv.lastIndexOf(OUTPUT_FLAG)) {
  throw new Error(`Usage: pnpm migration:export-auth -- ${OUTPUT_FLAG} <new-file.enc>`);
}
if (!process.env.MONGO_URL) throw new Error("MONGO_URL is required");

const keyText = process.env.PERMINISTER_MIGRATION_ENCRYPTION_KEY ?? "";
if (!/^[A-Za-z0-9_-]{43}$/.test(keyText)) {
  throw new Error("PERMINISTER_MIGRATION_ENCRYPTION_KEY must be a 32-byte base64url key");
}
const encryptionKey = Buffer.from(keyText, "base64url");
if (encryptionKey.length !== 32) throw new Error("Invalid migration encryption key");

const client = new MongoClient(process.env.MONGO_URL, { maxPoolSize: 1 });
try {
  await client.connect();
  const identities = await client
    .db(process.env.MONGO_DB)
    .collection("users")
    .find({}, { projection: { _id: 0, id: 1, email: 1, firstName: 1, lastName: 1, hash: 1 } })
    .sort({ id: 1 })
    .toArray();

  const payload = JSON.stringify({
    format: "systemconcepts-bcrypt-v1",
    identities: identities.map((record) => ({
      id: record.id,
      email: record.email ?? null,
      firstName: record.firstName ?? null,
      lastName: record.lastName ?? null,
      passwordHash: record.hash,
    })),
  });
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const envelope = JSON.stringify({
    format: "systemconcepts-auth-migration-encrypted-v1",
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  });
  const absoluteOutputPath = resolve(outputPath);
  const file = await open(absoluteOutputPath, "wx", 0o600);
  try {
    await file.writeFile(`${envelope}\n`, { encoding: "utf8" });
    await file.sync();
  } finally {
    await file.close();
  }
  console.log(`Encrypted ${identities.length} account verifiers to ${absoluteOutputPath}.`);
  console.log("This file contains sensitive password verifiers; transfer it securely and remove it after import.");
} finally {
  await client.close();
}
