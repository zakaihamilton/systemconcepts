import Button from "@ui/Button";
import LinearProgress from "@ui/LinearProgress";
import Link from "@ui/Link";
import { setPath, usePages } from "@util/domain/views";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import styles from "./Apps.module.css";

const SESSION_LIMIT = 4;
const LATEST_SESSION_LIMIT = SESSION_LIMIT * 2;
const TRAILING_QUICK_ACCESS_PAGE_IDS = ["settings", "account"];
const SKELETON_DELAY = 300;

function useDelayedLoading(loading) {
	const [showLoading, setShowLoading] = useState(false);

	useEffect(() => {
		if (!loading) {
			setShowLoading(false);
			return;
		}

		const timer = setTimeout(() => setShowLoading(true), SKELETON_DELAY);
		return () => clearTimeout(timer);
	}, [loading]);

	return showLoading;
}

function getSessionKey({ group, date, name }) {
	return `${group || ""}::${date || ""}::${name || ""}`;
}

function getSessionPath({ group, year, date, name }) {
	return `session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`;
}

function getSessionImagePath(session) {
	const imagePath = session.image?.path;
	if (
		imagePath?.startsWith("wasabi/") ||
		imagePath?.startsWith("/aws/") ||
		imagePath?.startsWith("aws/")
	) {
		return imagePath;
	}
	return (
		session.imagePath ||
		(typeof session.thumbnail === "string" ? session.thumbnail : imagePath)
	);
}

function SessionCard({ session }) {
	const trackCardModule = require("@views/Schedule/TracksView/Card");
	const TrackCard = trackCardModule.default || trackCardModule;
	const sessionPath = getSessionPath(session);
	const imagePath = getSessionImagePath(session);
	const goToSession = () => setPath("sessions", sessionPath);
	const onKeyDown = (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			goToSession();
		}
	};

	return (
		<div
			className={styles.sessionCard}
			tabIndex={0}
			role="link"
			onClick={goToSession}
			onKeyDown={onKeyDown}
		>
			<TrackCard
				session={{ ...session, thumbnail: imagePath || session.thumbnail }}
				onSessionClick={goToSession}
			/>
		</div>
	);
}

function SessionSection({ children, title, href, onClick }) {
	return (
		<section className={styles.section} aria-label={title}>
			<div className={styles.sectionHeader}>
				<Link
					href={href}
					underline="none"
					className={styles.sectionLink}
					onClick={(event) => {
						event.preventDefault();
						onClick();
					}}
				>
					{title}
				</Link>
			</div>
			{children}
		</section>
	);
}

function SessionSkeletons({ count = SESSION_LIMIT }) {
	return (
		<div
			className={styles.sessionGrid}
			aria-label="Loading sessions"
			data-testid="session-skeletons"
		>
			{Array.from({ length: count }, (_, index) => (
				<div
					key={index}
					className={styles.sessionSkeleton}
					aria-hidden="true"
				/>
			))}
		</div>
	);
}

function SessionContent({ translations }) {
	// Lazy-load these hooks because Apps is part of the root page registry that the
	// session domain reaches through shared language/page state.
	const { useRecentHistory } = require("@util/domain/history");
	const { SessionsStore, useSessions } = require("@util/domain/sessions");
	const { useSyncFeature } = require("@sync/sync");
	const { SyncActiveStore } = require("@sync/syncState");
	const [sessions, loading] = useSessions([], {
		filterSessions: false,
		showToolbar: false,
	});
	const [history, , historyLoading] = useRecentHistory();
	const {
		sync,
		busy: syncBusy,
		percentage: syncPercentage = 0,
	} = useSyncFeature();
	const needsSessionReload = SyncActiveStore.useState(
		(state) => state.needsSessionReload,
	);
	const sessionsLoading = loading || sessions === null;
	const continueWatchingLoading = sessionsLoading || historyLoading;
	const delayedSessionLoading = useDelayedLoading(sessionsLoading);
	const delayedContinueWatchingLoading = useDelayedLoading(
		continueWatchingLoading,
	);
	const showSessionSkeletons = sessionsLoading && delayedSessionLoading;
	const showContinueWatchingSkeletons =
		continueWatchingLoading && delayedContinueWatchingLoading;

	useEffect(() => {
		if (!needsSessionReload || syncBusy) return;

		SessionsStore.update((state) => {
			state.sessions = null;
			state.busy = false;
		});
		SyncActiveStore.update((state) => {
			state.needsSessionReload = false;
		});
	}, [needsSessionReload, syncBusy]);
	const openScheduleView = (viewMode) => {
		const { ScheduleStore } = require("@views/Schedule/Schedule");
		if (typeof window !== "undefined") {
			let savedScheduleState = {};
			try {
				savedScheduleState = JSON.parse(
					window.localStorage.getItem("ScheduleStore") || "{}",
				);
			} catch {
				// Ignore invalid saved schedule state and replace it below.
			}
			window.localStorage.setItem(
				"ScheduleStore",
				JSON.stringify({
					...savedScheduleState,
					viewMode,
					lastViewMode: null,
				}),
			);
		}
		ScheduleStore.update((state) => {
			state.viewMode = viewMode;
			state.lastViewMode = null;
		});
		setPath("schedule");
	};
	const sessionsByKey = new Map(
		(sessions || []).map((session) => [getSessionKey(session), session]),
	);
	const continueWatching = (history || [])
		.map((historyItem) => {
			const session = sessionsByKey.get(getSessionKey(historyItem));
			return (
				session && {
					...session,
					position: historyItem.position ?? session.position,
				}
			);
		})
		.filter(Boolean)
		.slice(0, SESSION_LIMIT);
	const latestSessions = [...(sessions || [])]
		.sort(
			(a, b) =>
				(b.date || "").localeCompare(a.date || "") ||
				(b.name || "").localeCompare(a.name || ""),
		)
		.slice(0, LATEST_SESSION_LIMIT);
	const hasSessions = sessions?.length > 0;

	if (!hasSessions && (syncBusy || !sessionsLoading)) {
		return (
			<SyncPrompt
				translations={translations}
				onStart={sync}
				busy={syncBusy}
				percentage={syncPercentage}
			/>
		);
	}

	if (sessionsLoading && !showSessionSkeletons) {
		return null;
	}

	return (
		<>
			{(!continueWatchingLoading || showContinueWatchingSkeletons) && (
				<SessionSection
					title={translations.CONTINUE_WATCHING}
					href="#schedule"
					onClick={() => openScheduleView("history")}
				>
					{showContinueWatchingSkeletons ? (
						<SessionSkeletons />
					) : continueWatching.length ? (
						<div className={styles.sessionGrid}>
							{continueWatching.map((session) => (
								<SessionCard key={getSessionKey(session)} session={session} />
							))}
						</div>
					) : (
						<div className={styles.state}>{translations.NO_SESSIONS_YET}</div>
					)}
				</SessionSection>
			)}

			<SessionSection
				title={translations.LATEST_SESSIONS}
				href="#schedule"
				onClick={() => openScheduleView("week")}
			>
				{showSessionSkeletons ? (
					<SessionSkeletons count={LATEST_SESSION_LIMIT} />
				) : latestSessions.length ? (
					<div className={styles.sessionGrid}>
						{latestSessions.map((session) => (
							<SessionCard key={getSessionKey(session)} session={session} />
						))}
					</div>
				) : (
					<div className={styles.state}>{translations.NO_SESSIONS_YET}</div>
				)}
			</SessionSection>
		</>
	);
}

function QuickAccess({ pages, translations }) {
	const appItems = [
		...pages
			.filter(
				(page) =>
					page.apps &&
					!page.category &&
					!TRAILING_QUICK_ACCESS_PAGE_IDS.includes(page.id),
			)
			.sort((a, b) => b.name.localeCompare(a.name)),
		...TRAILING_QUICK_ACCESS_PAGE_IDS.map((id) =>
			pages.find((page) => page.id === id),
		).filter(Boolean),
	];

	return (
		<section className={styles.quickAccess} aria-label={translations.APPS}>
			<div className={styles.appItems} data-testid="app-quick-access-items">
				{appItems.map((page) => {
					const { Icon } = page;
					return (
						<Link
							href={"#" + page.id}
							underline="none"
							key={page.id}
							className={`${styles.appItem} ${
								page.id === "settings" ? styles.trailingAppItem : ""
							}`}
							onClick={() => setPath(page.id)}
						>
							{Icon && <Icon className={styles.appIcon} />}
							<span>{page.name}</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}

function SignInPrompt({ translations }) {
	return (
		<section
			className={styles.signInPrompt}
			aria-label={translations.REQUIRE_SIGNIN}
		>
			<p>{translations.REQUIRE_SIGNIN}</p>
			<Link
				href="#account"
				underline="none"
				className={styles.signInLink}
				onClick={(event) => {
					event.preventDefault();
					setPath("account");
				}}
			>
				{translations.SIGN_IN}
			</Link>
		</section>
	);
}

function SyncPrompt({ translations, onStart, busy, percentage }) {
	return (
		<section className={styles.syncPrompt} aria-label={translations.START_SYNC}>
			{!busy && <p>{translations.NO_SESSIONS_YET}</p>}
			{busy ? (
				<div className={styles.syncProgress} aria-live="polite">
					<div className={styles.syncProgressStatus}>
						<span>{translations.SYNCING}</span>
						<span>{percentage}%</span>
					</div>
					<LinearProgress
						variant="determinate"
						value={percentage}
						aria-label={translations.SYNCING}
					/>
				</div>
			) : (
				<Button variant="contained" onClick={onStart}>
					{translations.START_SYNC}
				</Button>
			)}
		</section>
	);
}

export default function Apps() {
	const { useTranslations } = require("@util/domain/translations");
	const pages = usePages();
	const translations = useTranslations();
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");

	return (
		<div className={styles.root}>
			<QuickAccess pages={pages} translations={translations} />
			{isSignedIn ? (
				<SessionContent translations={translations} />
			) : (
				<SignInPrompt translations={translations} />
			)}
		</div>
	);
}
