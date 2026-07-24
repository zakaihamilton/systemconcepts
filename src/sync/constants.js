export const SYNC_BASE_PATH = "aws/sync";
export const LOCAL_SYNC_PATH = "local/sync";
export const LIBRARY_REMOTE_PATH = "aws/library";
export const LIBRARY_LOCAL_PATH = "local/library";
export const FILES_MANIFEST = "files.json";
export const FILES_MANIFEST_GZ = "files.json.gz";
export const LIBRARY_COUNTER_FILE = "library-counter.json";

// Number of parallel operations for work that does not contend on the local
// LightningFS database.
export const SYNC_BATCH_SIZE = 10;

// LightningFS uses a single IndexedDB-backed operation queue. Keeping full
// sync downloads to one file at a time prevents local reads, directory
// creation, and writes from competing on a fresh database.
export const SYNC_DOWNLOAD_BATCH_SIZE = 1;
