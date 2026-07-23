import { logger as structuredLogger } from "@util/api/logger";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RENEW_ATTEMPTS = 3;

/**
 * Renews a signed media URL on playback errors, without getting stuck when the
 * renew fetch fails or when the user switches sessions mid-recovery.
 */
export function useMediaUrlRenewal({
	path,
	renewUrl,
	renewing,
	onLoadError,
	sessionKey,
	label = "Media",
}) {
	const [recovering, setRecovering] = useState(false);
	const errorCountRef = useRef(0);
	const renewInFlightRef = useRef(false);
	const reportedLoadError = useRef(false);
	const pathWhenRenewStartedRef = useRef(null);

	const clearRecovery = useCallback(() => {
		renewInFlightRef.current = false;
		setRecovering(false);
		errorCountRef.current = 0;
		reportedLoadError.current = false;
	}, []);

	// New session — drop any in-flight recovery so the next URL is not treated
	// as a resume of the previous session.
	useEffect(() => {
		clearRecovery();
		pathWhenRenewStartedRef.current = null;
	}, [sessionKey, clearRecovery]);

	useEffect(() => {
		// A new signed URL arrived — allow subsequent errors to renew again.
		renewInFlightRef.current = false;
	}, [path]);

	useEffect(() => {
		if (renewing) {
			if (pathWhenRenewStartedRef.current === null) {
				pathWhenRenewStartedRef.current = path;
			}
			return;
		}
		if (pathWhenRenewStartedRef.current === null) {
			return;
		}
		const startedWith = pathWhenRenewStartedRef.current;
		pathWhenRenewStartedRef.current = null;
		renewInFlightRef.current = false;
		// Fetch finished without a new URL — clear recovering so the UI is not
		// stuck in a perpetual loading/renewing state.
		if (path === startedWith) {
			setRecovering(false);
		}
	}, [renewing, path]);

	const onError = useCallback(() => {
		// Ignore duplicate errors from the dying source while a renew is in flight.
		if (renewInFlightRef.current || renewing) {
			return;
		}
		if (errorCountRef.current < MAX_RENEW_ATTEMPTS) {
			structuredLogger.debug(`${label} error, renewing URL...`);
			renewInFlightRef.current = true;
			setRecovering(true);
			errorCountRef.current += 1;
			renewUrl?.();
		} else if (!reportedLoadError.current) {
			reportedLoadError.current = true;
			setRecovering(false);
			onLoadError?.();
		}
	}, [renewing, renewUrl, onLoadError, label]);

	return { recovering, onError, clearRecovery };
}
