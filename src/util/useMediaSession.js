import { useEffect, useRef, useCallback } from "react";

/**
 * useMediaSession - Manages the MediaSession API for Bluetooth headset controls
 * 
 * This hook provides:
 * 1. MediaSession action handlers (play, pause, seekforward, seekbackward)
 * 2. Media metadata updates (title, artist, artwork)
 * 3. Visibility change handling to recover audio after iOS suspends it
 * 4. Position state updates for headset display
 * 
 * @param {Object} options
 * @param {HTMLMediaElement} options.playerRef - Reference to the audio/video element
 * @param {string} options.title - Track title
 * @param {string} options.artist - Artist/group name
 * @param {string} options.artworkUrl - Optional artwork URL
 * @param {boolean} options.enabled - Whether to enable MediaSession (usually when player is visible)
 */
export function useMediaSession({ playerRef, title, artist, artworkUrl, enabled = true }) {
    // Track if we were playing before an interruption
    const wasPlayingRef = useRef(false);
    // Track the last known playback state
    const lastPlayStateRef = useRef(false);

    // Safely play with error handling
    const safePlay = useCallback(async () => {
        if (!playerRef) return;
        try {
            // On iOS, we may need to reload if the connection timed out
            if (playerRef.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                playerRef.load();
            }
            await playerRef.play();
        } catch (err) {
            console.error("[MediaSession] Play failed:", err);
            // If play fails due to not allowed, the user needs to interact
            // If it fails due to network, try reloading
            if (err.name === "NotSupportedError" || err.name === "AbortError") {
                try {
                    playerRef.load();
                    await playerRef.play();
                } catch (retryErr) {
                    console.error("[MediaSession] Retry play failed:", retryErr);
                }
            }
        }
    }, [playerRef]);

    // Register MediaSession action handlers
    useEffect(() => {
        if (!enabled || !playerRef || !("mediaSession" in navigator)) {
            return;
        }

        const handlers = {
            play: async () => {
                console.log("[MediaSession] play action received");
                await safePlay();
            },
            pause: () => {
                console.log("[MediaSession] pause action received");
                if (playerRef) {
                    playerRef.pause();
                }
            },
            seekforward: (details) => {
                console.log("[MediaSession] seekforward action received");
                if (playerRef) {
                    const skipTime = details?.seekOffset || 10;
                    playerRef.currentTime = Math.min(
                        playerRef.duration || 0,
                        playerRef.currentTime + skipTime
                    );
                }
            },
            seekbackward: (details) => {
                console.log("[MediaSession] seekbackward action received");
                if (playerRef) {
                    const skipTime = details?.seekOffset || 10;
                    playerRef.currentTime = Math.max(0, playerRef.currentTime - skipTime);
                }
            },
            seekto: (details) => {
                console.log("[MediaSession] seekto action received", details);
                if (playerRef && details?.seekTime !== undefined) {
                    playerRef.currentTime = details.seekTime;
                }
            },
            stop: () => {
                console.log("[MediaSession] stop action received");
                if (playerRef) {
                    playerRef.pause();
                    playerRef.currentTime = 0;
                }
            }
        };

        // Register handlers
        for (const [action, handler] of Object.entries(handlers)) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (err) {
                console.warn(`[MediaSession] Handler '${action}' not supported:`, err);
            }
        }

        return () => {
            // Cleanup handlers
            for (const action of Object.keys(handlers)) {
                try {
                    navigator.mediaSession.setActionHandler(action, null);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [enabled, playerRef, safePlay]);

    // Update media metadata
    useEffect(() => {
        if (!enabled || !("mediaSession" in navigator)) {
            return;
        }

        try {
            const metadata = {
                title: title || "Session",
                artist: artist || "",
                album: ""
            };

            if (artworkUrl) {
                metadata.artwork = [
                    { src: artworkUrl, sizes: "512x512", type: "image/png" }
                ];
            }

            navigator.mediaSession.metadata = new MediaMetadata(metadata);
        } catch (err) {
            console.warn("[MediaSession] Failed to set metadata:", err);
        }
    }, [enabled, title, artist, artworkUrl]);

    // Update position state periodically
    useEffect(() => {
        if (!enabled || !playerRef || !("mediaSession" in navigator)) {
            return;
        }

        const updatePositionState = () => {
            if (!playerRef.duration || isNaN(playerRef.duration)) {
                return;
            }
            try {
                navigator.mediaSession.setPositionState({
                    duration: playerRef.duration,
                    playbackRate: playerRef.playbackRate || 1,
                    position: playerRef.currentTime || 0
                });
            } catch (err) {
                // setPositionState may throw if duration is 0 or invalid
            }
        };

        // Update on timeupdate events
        playerRef.addEventListener("timeupdate", updatePositionState);
        playerRef.addEventListener("loadedmetadata", updatePositionState);
        playerRef.addEventListener("ratechange", updatePositionState);

        return () => {
            playerRef.removeEventListener("timeupdate", updatePositionState);
            playerRef.removeEventListener("loadedmetadata", updatePositionState);
            playerRef.removeEventListener("ratechange", updatePositionState);
        };
    }, [enabled, playerRef]);

    // Track play/pause state for visibility recovery
    useEffect(() => {
        if (!playerRef) return;

        const handlePlay = () => {
            lastPlayStateRef.current = true;
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "playing";
            }
        };

        const handlePause = () => {
            lastPlayStateRef.current = false;
            if ("mediaSession" in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        };

        playerRef.addEventListener("play", handlePlay);
        playerRef.addEventListener("playing", handlePlay);
        playerRef.addEventListener("pause", handlePause);

        return () => {
            playerRef.removeEventListener("play", handlePlay);
            playerRef.removeEventListener("playing", handlePlay);
            playerRef.removeEventListener("pause", handlePause);
        };
    }, [playerRef]);

    // Handle visibility changes - iOS may suspend audio when tab is hidden
    useEffect(() => {
        if (!enabled || !playerRef) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                // Store whether we were playing before hiding
                wasPlayingRef.current = !playerRef.paused;
            } else if (document.visibilityState === "visible") {
                // If we were playing and now we're paused, try to resume
                // This handles iOS suspending audio when tab was hidden
                if (wasPlayingRef.current && playerRef.paused) {
                    console.log("[MediaSession] Attempting to resume after visibility change");
                    // Small delay to let iOS settle
                    setTimeout(() => {
                        if (wasPlayingRef.current && playerRef.paused) {
                            safePlay();
                        }
                    }, 100);
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [enabled, playerRef, safePlay]);

    // Handle iOS audio interruptions (phone call, Siri, etc.)
    // These are surfaced as pause events followed by no corresponding play
    useEffect(() => {
        if (!enabled || !playerRef) return;

        let pauseTimeout = null;

        const handlePause = () => {
            // Clear any existing timeout
            if (pauseTimeout) {
                clearTimeout(pauseTimeout);
            }

            // If we were playing, set up recovery check
            if (lastPlayStateRef.current) {
                wasPlayingRef.current = true;
            }
        };

        const handlePlay = () => {
            // Clear recovery state on successful play
            wasPlayingRef.current = false;
            if (pauseTimeout) {
                clearTimeout(pauseTimeout);
                pauseTimeout = null;
            }
        };

        // Handle stalled/waiting events - may indicate connection timeout
        const handleStalled = () => {
            console.log("[MediaSession] Stalled event - possible connection timeout");
        };

        const handleWaiting = () => {
            console.log("[MediaSession] Waiting for data");
        };

        playerRef.addEventListener("pause", handlePause);
        playerRef.addEventListener("play", handlePlay);
        playerRef.addEventListener("stalled", handleStalled);
        playerRef.addEventListener("waiting", handleWaiting);

        return () => {
            if (pauseTimeout) {
                clearTimeout(pauseTimeout);
            }
            playerRef.removeEventListener("pause", handlePause);
            playerRef.removeEventListener("play", handlePlay);
            playerRef.removeEventListener("stalled", handleStalled);
            playerRef.removeEventListener("waiting", handleWaiting);
        };
    }, [enabled, playerRef]);

    return {
        // Expose for manual recovery if needed
        attemptResume: safePlay,
        getWasPlaying: () => wasPlayingRef.current
    };
}
