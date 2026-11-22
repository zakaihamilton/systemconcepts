import Button from "@ui/Button";
import Grid from "@ui/Grid";
import Typography from "@ui/Typography";
import Tooltip from "@widgets/Tooltip";
import { useState } from "react";
import styles from "./SessionsApiDocs.module.css";
import {
	buildSessionsCodeExamples,
	SESSIONS_QUERY_PARAMS,
	SESSIONS_RESPONSE_SCHEMA,
} from "./sessionsApiDocs";

interface SessionsApiDocsViewProps {
	apiUrl: string;
	translations: any;
}

/**
 * Renders the Sessions JSON API endpoint box, query parameter reference,
 * interactive code examples, and JSON response schema.
 */
export default function SessionsApiDocsView({
	apiUrl,
	translations,
}: SessionsApiDocsViewProps) {
	const [activeTab, setActiveTab] = useState("curl");
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [copiedCode, setCopiedCode] = useState(false);

	const codeExamples = buildSessionsCodeExamples(apiUrl);

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(apiUrl);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 2000);
	};

	const handleCopyCode = () => {
		navigator.clipboard.writeText(codeExamples[activeTab]);
		setCopiedCode(true);
		setTimeout(() => setCopiedCode(false), 2000);
	};

	return (
		<Grid container spacing={3} className={styles.form}>
			{/* Main API Info & Copy Section */}
			<Grid size={12} id="api-sessions-endpoint" className={styles.jumpSection}>
				<Typography className={styles.sectionDescription}>
					{translations.API_INSTRUCTIONS ||
						"Use the following personal endpoint to integrate session data into your external services, scripts, or platforms."}
				</Typography>

				<div className={styles.urlContainer}>
					<div className={styles.urlTextWrap}>
						<Tooltip title={apiUrl}>
							<div className={styles.urlText}>{apiUrl}</div>
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
							: translations.COPY_URL || "Copy URL"}
					</Button>
				</div>
			</Grid>

			{/* Parameters Documentation Section */}
			<Grid
				size={12}
				id="api-sessions-parameters"
				className={styles.jumpSection}
			>
				<Typography className={styles.subSectionTitle}>
					{translations.API_QUERY_PARAMETERS || "Query Parameters"}
				</Typography>
				<div className={styles.tableContainer}>
					<table className={styles.paramsTable}>
						<thead>
							<tr>
								<th>{translations.API_PARAMETER || "Parameter"}</th>
								<th>{translations.API_TYPE || "Type"}</th>
								<th>{translations.API_DESCRIPTION || "Description"}</th>
							</tr>
						</thead>
						<tbody>
							{SESSIONS_QUERY_PARAMS.map((param) => (
								<tr key={param.name}>
									<td>
										<code className={styles.inlineCode}>{param.name}</code>
									</td>
									<td>{translations[param.typeKey] || param.typeDefault}</td>
									<td>{translations[param.descKey] || param.descDefault}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Grid>

			{/* Code Examples Section */}
			<Grid size={12} id="api-sessions-examples" className={styles.jumpSection}>
				<div className={styles.docHeader}>
					<Typography className={styles.subSectionTitle}>
						{translations.API_DOCUMENTATION || "API Documentation & Examples"}
					</Typography>
					<Button
						variant="outlined"
						size="small"
						onClick={handleCopyCode}
						className={styles.copyCodeBtn}
					>
						{copiedCode
							? translations.API_COPIED_CODE || "Copied Code!"
							: translations.API_COPY_CODE || "Copy Code"}
					</Button>
				</div>

				{/* Code Tabs Switcher */}
				<div className={styles.tabBar}>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "curl" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("curl")}
					>
						cURL
					</button>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "fetch" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("fetch")}
					>
						JavaScript (Fetch)
					</button>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "python" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("python")}
					>
						Python
					</button>
				</div>

				{/* Dynamic Code Viewer */}
				<div className={styles.codeBlockContainer}>
					<pre className={styles.codeBlock}>
						<code>{codeExamples[activeTab]}</code>
					</pre>
				</div>
			</Grid>

			{/* Example JSON Response */}
			<Grid size={12} id="api-sessions-schema" className={styles.jumpSection}>
				<Typography className={styles.subSectionTitle}>
					{translations.API_JSON_RESPONSE_SCHEMA || "JSON Response Schema"}
				</Typography>
				<div className={styles.codeBlockContainer}>
					<pre className={styles.codeBlock}>
						<code>{SESSIONS_RESPONSE_SCHEMA}</code>
					</pre>
				</div>
			</Grid>
		</Grid>
	);
}
