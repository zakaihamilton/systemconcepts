import CancelIcon from "@icons/svg/Cancel.svg";
import DataUsageIcon from "@icons/svg/DataUsage.svg";
import { Divider } from "@ui";
import Dialog from "@ui/Dialog";
import DialogContent from "@ui/DialogContent";
import DialogTitle from "@ui/DialogTitle";
import IconButton from "@ui/IconButton";
import Table from "@ui/Table";
import TableBody from "@ui/TableBody";
import TableCell from "@ui/TableCell";
import TableContainer from "@ui/TableContainer";
import TableRow from "@ui/TableRow";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import Message from "@widgets/Message";
import Tooltip from "@widgets/Tooltip";
import { useEffect, useState } from "react";
import styles from "./Statistics.module.css";
export default function Statistics({ group, open, onClose, sessions }) {
	const translations = useTranslations();
	const [loading, setLoading] = useState(false);
	const [stats, setStats] = useState(null);

	useEffect(() => {
		if (!open || !group || !sessions) {
			return;
		}
		setLoading(true);
		const loadStats = async () => {
			try {
				let total = 0;
				let ai = 0;
				let standard = 0;
				let overviews = 0;

				const groupSessions = sessions.filter(
					(session) => session.group === group.name,
				);

				if (groupSessions) {
					for (const session of groupSessions) {
						total++;

						if (session.name.endsWith(" - AI")) {
							ai++;
						} else if (session.name.startsWith("Overview - ")) {
							overviews++;
						} else {
							standard++;
						}
					}
				}

				setStats({
					total,
					ai,
					standard,
					overviews,
				});
			} catch (err) {
				structuredLogger.error(err);
			} finally {
				setLoading(false);
			}
		};

		loadStats();
	}, [open, group, sessions]);

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
			<DialogTitle className={styles.titleBar}>
				<b>{group.name[0].toUpperCase() + group.name.slice(1)}</b>{" "}
				{translations.STATISTICS}
				<Tooltip title={translations.CLOSE} arrow>
					<IconButton onClick={onClose} size="large">
						<CancelIcon />
					</IconButton>
				</Tooltip>
			</DialogTitle>
			<Divider />
			<DialogContent>
				{loading && (
					<Message
						animated={true}
						Icon={DataUsageIcon}
						label={translations.LOADING + "..."}
					/>
				)}
				{!loading && stats && (
					<TableContainer>
						<Table>
							<TableBody>
								<TableRow>
									<TableCell>{translations.SESSIONS}</TableCell>
									<TableCell align="right">{stats.total}</TableCell>
								</TableRow>
								<TableRow className={styles.borderless}>
									<TableCell>Standard</TableCell>
									<TableCell align="right">{stats.standard}</TableCell>
								</TableRow>
								<TableRow className={styles.borderless}>
									<TableCell>Overview</TableCell>
									<TableCell align="right">{stats.overviews}</TableCell>
								</TableRow>
								<TableRow className={styles.borderless}>
									<TableCell>AI</TableCell>
									<TableCell align="right">{stats.ai}</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</DialogContent>
		</Dialog>
	);
}
