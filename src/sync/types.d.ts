export type SyncDirection = "bi" | "push" | "pull";

export interface SyncConfig {
	name: string;
	localPath: string;
	remotePath: string;
	direction: SyncDirection;
	uploadsRole: string;
	filters?: Record<string, boolean>;
	migration?: boolean;
	restoreMissingFiles?: boolean;
	useChangeCounter?: boolean;
	excludeNames?: string[];
}

export interface ManifestEntry {
	path: string;
	fullPath?: string;
	modified?: number;
	version?: number;
	hash?: string;
	deleted?: boolean;
	[key: string]: unknown;
}

export interface Manifest extends Array<ManifestEntry> {
	loadedFromManifest?: boolean;
	authoritative?: boolean;
}

export interface ManifestFreshness {
	fresh: boolean;
	signature: string;
	storageKey: string;
	missingLocalFiles: string[];
}

export interface PipelineResult {
	hasChanges: boolean;
	complete: boolean;
	newOffset: number;
}

export interface SyncResult {
	completed: boolean;
	reason?: "unauthorized" | "incomplete" | "stopped";
}

export interface SyncProgress {
	total: number;
	processed: number;
}

export interface SyncState {
	active: number;
	counter: number;
	busy: boolean;
	lastSynced: number;
	lastSyncTime: number;
	progress: SyncProgress;
	currentBundle: string | null;
	logs: Array<{ message?: string; type?: string } | string>;
	lastDuration: number;
	startTime: number;
	needsSessionReload: boolean;
	phase: string | null;
	libraryUpdateCounter: number;
	personalSyncBusy: boolean;
	personalSyncError: unknown;
	locked: boolean;
	autoSync: boolean;
	stopping: boolean;
	debugLevel: string;
}
