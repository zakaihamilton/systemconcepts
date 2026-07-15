import Link from "@ui/Link";
import { setPath, usePages } from "@util/domain/views";
import styles from "./Apps.module.css";

const SESSION_LIMIT = 4;
const LATEST_SESSION_LIMIT = SESSION_LIMIT * 2;

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

export default function Apps() {
	// Lazy-load these hooks because Apps is part of the root page registry that the
	// session domain reaches through shared language/page state.
	const { useRecentHistory } = require("@util/domain/history");
	const { useSessions } = require("@util/domain/sessions");
	const { useTranslations } = require("@util/domain/translations");
	const pages = usePages();
	const translations = useTranslations();
	const [sessions, loading] = useSessions([], {
		filterSessions: false,
		showToolbar: false,
	});
	const [history, , historyLoading] = useRecentHistory();
	const sessionsLoading = loading || sessions === null;
	const continueWatchingLoading = sessionsLoading || historyLoading;
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

	const appItems = pages
		.filter((page) => page.apps && !page.category)
		.sort((a, b) => b.name.localeCompare(a.name));
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

	return (
		<div className={styles.root}>
			<section className={styles.quickAccess} aria-label={translations.APPS}>
				<div className={styles.appItems} data-testid="app-quick-access-items">
					{appItems.map((page) => {
						const { Icon } = page;
						return (
							<Link
								href={"#" + page.id}
								underline="none"
								key={page.id}
								className={styles.appItem}
								onClick={() => setPath(page.id)}
							>
								{Icon && <Icon className={styles.appIcon} />}
								<span>{page.name}</span>
							</Link>
						);
					})}
				</div>
			</section>

			<SessionSection
				title={translations.CONTINUE_WATCHING}
				href="#schedule"
				onClick={() => openScheduleView("history")}
			>
				{continueWatchingLoading ? (
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

			<SessionSection
				title={translations.LATEST_SESSIONS}
				href="#schedule"
				onClick={() => openScheduleView("week")}
			>
				{sessionsLoading ? (
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
		</div>
	);
}
