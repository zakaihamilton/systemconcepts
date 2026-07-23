/**
 * @jest-environment jsdom
 */

function createMemoryIndexedDB() {
	const databases = new Map();

	function asap(fn) {
		queueMicrotask(fn);
	}

	class MemoryRequest {
		constructor() {
			this.result = undefined;
			this.error = null;
			this.onsuccess = null;
			this.onerror = null;
			this.onupgradeneeded = null;
			this.onblocked = null;
		}
	}

	class MemoryStore {
		constructor(data) {
			this.data = data;
		}
		get(key) {
			const req = new MemoryRequest();
			asap(() => {
				req.result = this.data.has(key) ? this.data.get(key) : undefined;
				req.onsuccess?.({ target: req });
			});
			return req;
		}
		getKey(key) {
			const req = new MemoryRequest();
			asap(() => {
				req.result = this.data.has(key) ? key : undefined;
				req.onsuccess?.({ target: req });
			});
			return req;
		}
		getAllKeys() {
			const req = new MemoryRequest();
			asap(() => {
				req.result = [...this.data.keys()];
				req.onsuccess?.({ target: req });
			});
			return req;
		}
		put(value, key) {
			const req = new MemoryRequest();
			asap(() => {
				this.data.set(key, value);
				req.result = key;
				req.onsuccess?.({ target: req });
			});
			return req;
		}
		delete(key) {
			const req = new MemoryRequest();
			asap(() => {
				this.data.delete(key);
				req.result = undefined;
				req.onsuccess?.({ target: req });
			});
			return req;
		}
	}

	class MemoryTransaction {
		constructor(db) {
			this._db = db;
			this.oncomplete = null;
			this.onerror = null;
			this.onabort = null;
			// Complete after request callbacks scheduled in this turn have run.
			asap(() => asap(() => this.oncomplete?.()));
		}
		objectStore() {
			return new MemoryStore(this._db.data);
		}
		abort() {
			this.onabort?.();
		}
	}

	class MemoryDB {
		constructor(data) {
			this.data = data;
			this.objectStoreNames = { contains: (s) => s === "files" };
		}
		transaction() {
			return new MemoryTransaction(this);
		}
		createObjectStore() {
			return undefined;
		}
	}

	return {
		open(name, version) {
			const req = new MemoryRequest();
			asap(() => {
				let entry = databases.get(name);
				if (!entry) {
					entry = { version: 0, data: new Map() };
					databases.set(name, entry);
				}
				const db = new MemoryDB(entry.data);
				if (entry.version < version) {
					entry.version = version;
					req.result = db;
					req.onupgradeneeded?.({ target: req });
				}
				req.result = db;
				req.onsuccess?.({ target: req });
			});
			return req;
		},
		deleteDatabase(name) {
			const req = new MemoryRequest();
			databases.delete(name);
			asap(() => req.onsuccess?.({ target: req }));
			return req;
		},
	};
}

describe("syncYearFiles", () => {
	let api;

	beforeEach(() => {
		jest.resetModules();
		global.indexedDB = createMemoryIndexedDB();
		// eslint-disable-next-line global-require
		api = require("@storage/syncYearFiles");
	});

	it("detects sync year file paths", () => {
		expect(api.isSyncYearFilePath("/sync/american/2026.json")).toBe(true);
		expect(api.isSyncYearFilePath("/sync/american/2026.json.tmp")).toBe(true);
		expect(api.isSyncYearFilePath("/sync/american/files.json")).toBe(false);
		expect(api.isSyncYearFilePath("/sync/american/sub/2026.json")).toBe(false);
	});

	it("writes, reads, exists, renames, lists, and deletes year files", async () => {
		const live = "/sync/american/2026.json";
		const temp = "/sync/american/2026.json.tmp";

		await api.idbWriteSyncYearFile(temp, '{"sessions":[1]}');
		expect(await api.idbExistsSyncYearFile(temp)).toBe(true);
		expect(await api.idbReadSyncYearFile(temp)).toBe('{"sessions":[1]}');

		await api.idbRenameSyncYearFile(temp, live);
		expect(await api.idbExistsSyncYearFile(temp)).toBe(false);
		expect(await api.idbExistsSyncYearFile(live)).toBe(true);
		expect(await api.idbListSyncYearFilesInDir("/sync/american")).toEqual([
			"2026.json",
		]);

		await api.idbDeleteSyncYearFile(live);
		expect(await api.idbExistsSyncYearFile(live)).toBe(false);
	});
});
