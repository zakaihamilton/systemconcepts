import { logger as structuredLogger } from "@util/api/logger";
import { useFile } from "@util/storage/storage";
import type { MutableRefObject } from "react";
import { useEffect } from "react";
import type { PendingResume } from "./useMediaPlaybackState";

interface UsePlaybackBookmarkOptions {
	metadataPath?: string;
	metadataKey?: string;
	playerRef: any;
	currentTime: number;
	setCurrentTime: (time: number) => void;
	pendingResumeRef: MutableRefObject<PendingResume | null>;
}

/**
 * Loads and persists per-session playback position bookmarks via metadata storage.
 */
export function usePlaybackBookmark({
	metadataPath,
	metadataKey,
	playerRef,
	currentTime,
	setCurrentTime,
	pendingResumeRef,
}: UsePlaybackBookmarkOptions) {
	const [metadata, , , setMetadata] = useFile(
		metadataPath,
		[metadataPath, metadataKey],
		(data: any) => {
			return data ? JSON.parse(data) : {};
		},
	);

	useEffect(() => {
		structuredLogger.debug("[Controls] Metadata effect triggered", {
			hasMetadata: !!metadata,
			metadataKey,
			readyState: playerRef?.readyState,
			currentTime: playerRef?.currentTime,
		});

		if (!metadataKey) return; // Skip if metadataKey not ready
		// A pending signed-URL renew owns position restore; don't apply bookmarks.
		if (pendingResumeRef.current) return;
		if (metadata && playerRef && playerRef.readyState >= 1) {
			const currentMetadata = metadataKey
				? metadata?.[metadataKey] || {}
				: metadata || {};
			structuredLogger.debug("[Controls] Current metadata:", {
				metadataKey,
				currentMetadata,
				position: currentMetadata.position,
				hasMetadataKey: !!metadataKey,
				metadataKeys: Object.keys(metadata).slice(0, 5),
			});

			if (currentMetadata.position && playerRef.currentTime < 1) {
				playerRef.currentTime = currentMetadata.position;
				setCurrentTime(currentMetadata.position);
			} else {
				structuredLogger.debug("[Controls] Not setting position:", {
					hasPosition: !!currentMetadata.position,
					currentTime: playerRef.currentTime,
				});
			}
		}
	}, [metadata, metadataKey, playerRef, pendingResumeRef, setCurrentTime]);

	useEffect(() => {
		if (
			currentTime &&
			!isNaN(currentTime) &&
			playerRef.duration &&
			metadataKey
		) {
			setMetadata((data: any) => {
				if (!data) {
					data = {};
				}
				const duration = parseInt(playerRef && playerRef.duration);
				const position = Math.floor(Number(currentTime));

				if (metadataKey) {
					const subData = data[metadataKey] || {};
					subData.duration = duration;
					subData.position = position;
					return { ...data, [metadataKey]: subData };
				}

				data.duration = duration;
				data.position = position;
				return { ...data };
			});
		}
	}, [currentTime, playerRef, setMetadata, metadataKey]);

	return metadata;
}
