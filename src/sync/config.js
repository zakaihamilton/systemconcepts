/** @type {import("./types").SyncConfig[]} */
export const SYNC_CONFIG = [
	{
		name: "Main",
		localPath: "local/sync",
		remotePath: "aws/sync",
		direction: "bi",
		uploadsRole: "admin",
		filters: { tags: true },
	},
	{
		name: "Library",
		localPath: "local/library",
		remotePath: "aws/library",
		direction: "bi",
		uploadsRole: "admin",
		useChangeCounter: true,
	},
	{
		name: "Personal",
		localPath: "local/personal",
		remotePath: "aws/personal/{userid}",
		direction: "bi",
		uploadsRole: "student",
		migration: true,
		restoreMissingFiles: true,
	},
];
