## 2024-03-03 - [Missing Path Validation]
**Vulnerability:** The Wasabi storage adapter (`src/util/wasabi.js`) was missing a `validatePathAccess` check, which was present in `src/util/aws.js`.
**Learning:** Due to how S3 APIs (both AWS and Wasabi) work with key strings (`forcePathStyle: true` vs virtual-hosted routing), an unvalidated `..` character could trigger directory traversal logic inside standard `GetObjectCommand`s.
**Prevention:** Whenever there are multiple storage adapters implementing the same contract (e.g. S3 AWS vs Wasabi), security checks built into the abstract layer or duplicated explicitly in both adapters are vital. Ensure `decodeURIComponent` and path normalization are strictly applied before checking for traversal tokens `..`.
