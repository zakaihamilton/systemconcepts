import type { logger as structuredLogger } from "@util/api/logger";
import type { SyncProgressTracker } from "./progressTracker";
import type { Manifest, SyncConfig } from "./types";

export type LocalFile = { path: string; fullPath: string };

export type ManifestResult = {
	manifest: Manifest;
	hasChanges: boolean;
	complete?: boolean;
	cleanedRemoteManifest?: Manifest;
};

export type ProgressTracker = Pick<
	SyncProgressTracker,
	| "updateProgress"
	| "completeStep"
	| "setComplete"
	| "usePersonalWeights"
	| "getCurrentOffset"
>;

export interface PipelineDependencies {
	storage: {
		createFolderPath(path: string): Promise<unknown>;
		readFile(path: string): Promise<string | null>;
	};
	roleAuth(role: string | undefined, requiredRole: string): boolean;
	addSyncLog(message: string, type: string): void;
	logger: Pick<typeof structuredLogger, "warn" | "debug" | "error">;
	ProgressTracker: new (
		offset: number,
		total: number | null,
	) => ProgressTracker;
	getLocalFiles(path: string, config: SyncConfig): Promise<LocalFile[]>;
	readLibraryCounter(): Promise<number>;
	getSavedLibraryCounter(): number | null;
	saveLibraryCounter(counter: number): void;
	syncManifest(
		path: string,
		locked: boolean,
		migration: boolean,
	): Promise<Manifest>;
	migrateFromMongoDB(
		userId: string,
		manifest: Manifest,
		path: string,
		canUpload: boolean,
	): Promise<{
		migrated: boolean;
		fileCount: number;
		deletedKeys?: string[];
		manifest?: Manifest | null;
		error?: unknown;
	}>;
	updateLocalManifest(
		files: LocalFile[],
		path: string,
		manifest: Manifest,
		options: { skipHashing: boolean },
	): Promise<Manifest>;
	downloadUpdates(
		local: Manifest,
		remote: Manifest,
		localPath: string,
		remotePath: string,
		canUpload: boolean,
		progress: ProgressTracker,
		restore?: boolean,
	): Promise<ManifestResult>;
	removeDeletedFiles(
		local: Manifest,
		remote: Manifest,
		path: string,
		readOnly: boolean,
	): Promise<ManifestResult>;
	uploadUpdates(
		local: Manifest,
		remote: Manifest,
		localPath: string,
		remotePath: string,
		progress: ProgressTracker,
	): Promise<ManifestResult>;
	uploadNewFiles(
		local: Manifest,
		remote: Manifest,
		localPath: string,
		remotePath: string,
		progress: ProgressTracker,
	): Promise<ManifestResult>;
	deleteRemoteFiles(
		local: Manifest,
		path: string,
		syncId: string,
	): Promise<{ complete: boolean }>;
	applyRemoteTombstones(
		local: Manifest,
		remote: Manifest,
		path: string,
		canUpload: boolean,
		syncId: string,
	): Promise<ManifestResult>;
	uploadManifest(manifest: Manifest, path: string): Promise<unknown>;
	createSyncTrashId(): string;
}
