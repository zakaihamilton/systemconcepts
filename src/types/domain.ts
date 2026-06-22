export type StorageItemType = "file" | "dir";

export interface StorageItem {
	id: string;
	name: string;
	type: StorageItemType;
	path?: string;
	size?: number;
	mtimeMs?: number;
	stat?: {
		type?: StorageItemType;
		size?: number;
		mtimeMs?: number;
	};
}

export interface StorageAdapter {
	id: string;
	name?: string;
	enabled: boolean | (() => boolean);
	getListing?: (path: string, options?: unknown) => Promise<StorageItem[]>;
	getRecursiveList?: (path: string) => Promise<StorageItem[]>;
	createFolder?: (...args: unknown[]) => Promise<unknown>;
	createFolders?: (...args: unknown[]) => Promise<unknown>;
	createFolderPath?: (...args: unknown[]) => Promise<unknown>;
	deleteFolder?: (...args: unknown[]) => Promise<unknown>;
	deleteFolderPath?: (...args: unknown[]) => Promise<unknown>;
	deleteFile?: (...args: unknown[]) => Promise<unknown>;
	readFile?: (...args: unknown[]) => Promise<unknown>;
	readFiles?: (...args: unknown[]) => Promise<unknown>;
	writeFile?: (...args: unknown[]) => Promise<unknown>;
	writeFiles?: (...args: unknown[]) => Promise<unknown>;
	exists?: (...args: unknown[]) => Promise<boolean>;
	exportFolder?: (...args: unknown[]) => Promise<unknown>;
	importFolder?: (...args: unknown[]) => Promise<unknown>;
	copyFolder?: (...args: unknown[]) => Promise<unknown>;
	copyFile?: (...args: unknown[]) => Promise<unknown>;
	getSize?: (...args: unknown[]) => Promise<number>;
}

export interface SyncManifestEntry {
	path: string;
	hash?: string;
	size?: number;
	mtimeMs?: number;
	deleted?: boolean;
}

export type SyncManifest = SyncManifestEntry[];

export interface SessionMetadata {
	items: StorageItem[];
	tags: Record<string, unknown>;
	durations: Record<string, unknown>;
	summaries: Record<string, unknown>;
	transcriptions: Record<string, unknown>;
}

export interface Session {
	id: string;
	name?: string;
	group?: string;
	year?: string | number;
	type?: string;
	[key: string]: unknown;
}

export interface SessionYear {
	name: string;
	sessions: Session[];
	fingerprint?: string;
}

export interface SessionGroup {
	name: string;
	years: SessionYear[];
}
