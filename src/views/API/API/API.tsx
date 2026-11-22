import PageLoad from "@components/PageLoad";
import Typography from "@ui/Typography";
import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import { useEffect, useMemo, useState } from "react";
import styles from "./API.module.css";
import SessionsApiDocsView from "./SessionsApiDocsView";
import StickySectionNav from "./StickySectionNav";
import { getSessionsApiSections } from "./sessionsApiDocs";
import { useStickySectionNav } from "./useStickySectionNav";

export default function API() {
	const translations = useTranslations();
	const [user, setUser] = useState<any>(null);
	const [selectedApi, setSelectedApi] = useState("sessions");

	const userId = Cookies.get("id");
	const isSignedIn = userId && Cookies.get("hash");
	const sessionSections = useMemo(
		() => getSessionsApiSections(translations),
		[translations],
	);

	const {
		mounted,
		sectionNavSlotRef,
		sectionNavMeasureRef,
		sectionNavFrame,
		activeSectionId,
		handleSectionJump,
	} = useStickySectionNav({
		enabled: selectedApi === "sessions",
		sections: sessionSections,
		initialSectionId: "api-sessions-endpoint",
	});

	useEffect(() => {
		if (isSignedIn) {
			fetchJSON("/api/users", {
				headers: {
					id: userId,
				},
			})
				.then((data) => {
					setUser(data);
				})
				.catch(structuredLogger.error);
		}
	}, [isSignedIn, userId]);

	if (!isSignedIn) {
		return null;
	}

	if (!user) {
		return <PageLoad />;
	}

	if (user.err || user.role === "visitor" || !user.rssToken) {
		return (
			<div className={styles.root}>
				<div className={styles.card}>
					<Typography
						variant="h4"
						className={styles.title}
						style={{
							color: "var(--error-color)",
							background: "none",
							WebkitTextFillColor: "initial",
						}}
					>
						{translations.ACCESS_DENIED || "Access Denied"}
					</Typography>
					<Typography
						className={styles.sectionDescription}
						style={{ textAlign: "center", fontSize: "1.1rem" }}
					>
						{translations.API_ACCESS_DENIED_DESC ||
							"The JSON API features are only available to registered users. Visitor accounts do not have access to the API."}
					</Typography>
				</div>
			</div>
		);
	}

	const apiEndpoints: Record<
		string,
		{ name: string; url: string; description: string }
	> = {
		sessions: {
			name: translations.API_SESSIONS || "Sessions API",
			url: `${window.location.origin}/api/sessions?id=${userId}&token=${user.rssToken}`,
			description:
				translations.API_INSTRUCTIONS ||
				"Use the following personal endpoint to integrate session data into your external services, scripts, or platforms.",
		},
	};

	const apiUrl = apiEndpoints[selectedApi]?.url || "";

	return (
		<div className={styles.root}>
			<div className={styles.card}>
				<Typography variant="h4" className={styles.title}>
					{translations.API || "API"}
				</Typography>

				<div className={styles.apiSelector}>
					<button
						type="button"
						className={`${styles.apiSelectorTab} ${selectedApi === "sessions" ? styles.apiSelectorTabActive : ""}`}
						onClick={() => setSelectedApi("sessions")}
					>
						{apiEndpoints.sessions.name}
					</button>
				</div>

				{selectedApi === "sessions" && (
					<>
						<StickySectionNav
							sections={sessionSections}
							activeSectionId={activeSectionId}
							sectionNavFrame={sectionNavFrame}
							sectionNavSlotRef={sectionNavSlotRef}
							sectionNavMeasureRef={sectionNavMeasureRef}
							mounted={mounted}
							ariaLabel={translations.API_SECTION_NAVIGATION || "API sections"}
							onJump={handleSectionJump}
						/>
						<SessionsApiDocsView apiUrl={apiUrl} translations={translations} />
					</>
				)}
			</div>
		</div>
	);
}
