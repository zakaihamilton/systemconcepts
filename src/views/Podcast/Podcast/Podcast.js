import PageLoad from "@components/PageLoad";
import Button from "@ui/Button";
import Typography from "@ui/Typography";
import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import { getOrigin } from "@util/domain/views";
import Tooltip from "@widgets/Tooltip";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import styles from "./Podcast.module.css";

export default function Podcast() {
	const translations = useTranslations();
	const [user, setUser] = useState(null);
	const [copiedUrl, setCopiedUrl] = useState(false);
	const userId = Cookies.get("id");
	const isSignedIn = userId && Cookies.get("hash");

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
					<Typography variant="h4" className={styles.accessDeniedTitle}>
						{translations.ACCESS_DENIED || "Access Denied"}
					</Typography>
					<Typography className={styles.accessDeniedDescription}>
						{translations.PODCAST_ACCESS_DENIED_DESC ||
							"The podcast feed is only available to registered users. Visitor accounts do not have access."}
					</Typography>
				</div>
			</div>
		);
	}

	const podcastUrl = `${getOrigin()}/api/rss?id=${userId}&token=${user.rssToken}`;

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(podcastUrl);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 2000);
	};

	return (
		<div className={styles.root}>
			<div className={styles.card}>
				<Typography className={styles.podcastTitle}>
					{translations.PODCAST_FEED}
				</Typography>
				<Typography className={styles.podcastDescription}>
					{translations.PODCAST_FEED_DESCRIPTION}
				</Typography>
				<div className={styles.urlContainer}>
					<div className={styles.urlTextWrap}>
						<Tooltip title={podcastUrl}>
							<div className={styles.urlText}>{podcastUrl}</div>
						</Tooltip>
					</div>
					<Button
						variant="contained"
						size="small"
						onClick={handleCopyUrl}
						className={styles.copyButton}
					>
						{copiedUrl
							? translations.API_COPIED || "Copied!"
							: translations.COPY_URL}
					</Button>
				</div>
			</div>
		</div>
	);
}
