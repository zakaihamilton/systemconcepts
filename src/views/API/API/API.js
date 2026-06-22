import PageLoad from "@components/PageLoad";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";
import Cookies from "js-cookie";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./API.module.css";

export default function API() {
	const translations = useTranslations();
	const [user, setUser] = useState(null);
	const [activeTab, setActiveTab] = useState("curl");
	const [copiedUrl, setCopiedUrl] = useState(false);
	const [copiedCode, setCopiedCode] = useState(false);
	const [selectedApi, setSelectedApi] = useState("sessions");
	const [mounted, setMounted] = useState(false);
	const sectionNavSlotRef = useRef(null);
	const sectionNavMeasureRef = useRef(null);
	const [sectionNavFrame, setSectionNavFrame] = useState(null);
	const [activeSectionId, setActiveSectionId] = useState(
		"api-sessions-endpoint",
	);

	const userId = Cookies.get("id");
	const isSignedIn = userId && Cookies.get("hash");
	const sessionSections = useMemo(
		() => [
			{
				id: "api-sessions-endpoint",
				label: translations.API_SECTION_ENDPOINT || "Endpoint",
			},
			{
				id: "api-sessions-parameters",
				label: translations.API_QUERY_PARAMETERS || "Query Parameters",
			},
			{
				id: "api-sessions-examples",
				label: translations.API_SECTION_EXAMPLES || "Examples",
			},
			{
				id: "api-sessions-schema",
				label: translations.API_JSON_RESPONSE_SCHEMA || "JSON Response Schema",
			},
		],
		[
			translations.API_JSON_RESPONSE_SCHEMA,
			translations.API_QUERY_PARAMETERS,
			translations.API_SECTION_ENDPOINT,
			translations.API_SECTION_EXAMPLES,
		],
	);

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

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (selectedApi !== "sessions") {
			setSectionNavFrame(null);
			return;
		}

		const updateSectionNav = () => {
			const slot = sectionNavSlotRef.current;
			const nav = sectionNavMeasureRef.current;
			if (!slot || !nav) {
				return;
			}

			const topOffset = 76;
			const slotRect = slot.getBoundingClientRect();
			const navRect = nav.getBoundingClientRect();
			const shouldPin = slotRect.top <= topOffset;
			const sectionTopOffset = topOffset + navRect.height + 24;
			const activeSection = sessionSections
				.map((section) => {
					const element = document.getElementById(section.id);
					const rect = element?.getBoundingClientRect();
					return rect
						? {
								id: section.id,
								top: rect.top,
								bottom: rect.bottom,
							}
						: null;
				})
				.filter(Boolean)
				.find(
					(section) =>
						section.top <= sectionTopOffset &&
						section.bottom > sectionTopOffset,
				);

			if (activeSection) {
				setActiveSectionId(activeSection.id);
			}

			const nextFrame = shouldPin
				? {
						height: navRect.height,
						left: slotRect.left,
						width: slotRect.width,
					}
				: null;

			setSectionNavFrame((previousFrame) => {
				if (!previousFrame && !nextFrame) {
					return previousFrame;
				}
				if (
					previousFrame &&
					nextFrame &&
					previousFrame.height === nextFrame.height &&
					previousFrame.left === nextFrame.left &&
					previousFrame.width === nextFrame.width
				) {
					return previousFrame;
				}
				return nextFrame;
			});
		};

		const scrollParent = document.querySelector('[class*="pageContainer"]');
		let transitionFrame = null;
		let resizeObserver = null;
		const trackLayoutTransition = () => {
			const startTime = performance.now();
			const tick = () => {
				updateSectionNav();
				if (performance.now() - startTime < 350) {
					transitionFrame = requestAnimationFrame(tick);
				}
			};

			if (transitionFrame) {
				cancelAnimationFrame(transitionFrame);
			}
			transitionFrame = requestAnimationFrame(tick);
		};

		updateSectionNav();
		scrollParent?.addEventListener("scroll", updateSectionNav, {
			passive: true,
		});
		window.addEventListener("scroll", updateSectionNav, {
			passive: true,
		});
		window.addEventListener("resize", updateSectionNav);
		window.addEventListener("transitionrun", trackLayoutTransition, true);
		window.addEventListener("transitionstart", trackLayoutTransition, true);

		if (window.ResizeObserver) {
			resizeObserver = new ResizeObserver(updateSectionNav);
			if (sectionNavSlotRef.current) {
				resizeObserver.observe(sectionNavSlotRef.current);
			}
			if (scrollParent) {
				resizeObserver.observe(scrollParent);
			}
		}

		return () => {
			if (transitionFrame) {
				cancelAnimationFrame(transitionFrame);
			}
			resizeObserver?.disconnect();
			scrollParent?.removeEventListener("scroll", updateSectionNav);
			window.removeEventListener("scroll", updateSectionNav);
			window.removeEventListener("resize", updateSectionNav);
			window.removeEventListener("transitionrun", trackLayoutTransition, true);
			window.removeEventListener(
				"transitionstart",
				trackLayoutTransition,
				true,
			);
		};
	}, [selectedApi, sessionSections]);

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

	const apiEndpoints = {
		sessions: {
			name: translations.API_SESSIONS || "Sessions API",
			url: `${window.location.origin}/api/sessions?id=${userId}&token=${user.rssToken}`,
			description:
				translations.API_INSTRUCTIONS ||
				"Use the following personal endpoint to integrate session data into your external services, scripts, or platforms.",
		},
	};

	const apiUrl = apiEndpoints[selectedApi]?.url || "";

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(apiUrl);
		setCopiedUrl(true);
		setTimeout(() => setCopiedUrl(false), 2000);
	};

	const codeExamples = {
		curl: `curl -X GET "${apiUrl}&group=american&index=0&count=5"`,
		fetch: `fetch("${apiUrl}&group=american&index=0&count=5")
  .then(response => response.json())
  .then(data => structuredLogger.debug(data))
  .catch(error => structuredLogger.error(error));`,
		python: `import requests

url = "${apiUrl}"
params = {
    "group": "american",
    "index": 0,
    "count": 5
}

response = requests.get(url, params=params)
if response.status_code == 200:
    sessions = response.json()
    for session in sessions:
        print(f"{session['date']} - {session['name']}")
else:
    print(f"Error: {response.status_code}")`,
	};

	const handleCopyCode = () => {
		navigator.clipboard.writeText(codeExamples[activeTab]);
		setCopiedCode(true);
		setTimeout(() => setCopiedCode(false), 2000);
	};

	const handleSectionJump = (sectionId) => {
		setActiveSectionId(sectionId);
		document.getElementById(sectionId)?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	const renderSectionNav = ({
		fixed = false,
		hidden = false,
		measure = false,
	} = {}) => (
		<nav
			ref={measure ? sectionNavMeasureRef : undefined}
			className={`${styles.sectionNav} ${fixed ? styles.sectionNavFixed : ""} ${hidden ? styles.sectionNavPlaceholder : ""}`}
			style={
				fixed && sectionNavFrame
					? {
							left: sectionNavFrame.left,
							width: sectionNavFrame.width,
						}
					: undefined
			}
			aria-label={translations.API_SECTION_NAVIGATION || "API sections"}
			aria-hidden={hidden ? "true" : undefined}
		>
			{sessionSections.map((section) => (
				<button
					type="button"
					key={section.id}
					className={`${styles.sectionNavLink} ${activeSectionId === section.id ? styles.sectionNavLinkActive : ""}`}
					onClick={() => handleSectionJump(section.id)}
					aria-current={activeSectionId === section.id ? "true" : undefined}
				>
					{section.label}
				</button>
			))}
		</nav>
	);

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
						{mounted &&
							sectionNavFrame &&
							createPortal(renderSectionNav({ fixed: true }), document.body)}
						<div
							ref={sectionNavSlotRef}
							className={styles.sectionNavSlot}
							style={
								sectionNavFrame
									? { minHeight: sectionNavFrame.height }
									: undefined
							}
						>
							{renderSectionNav({
								hidden: Boolean(sectionNavFrame),
								measure: true,
							})}
						</div>

						<Grid container spacing={3} className={styles.form}>
							{/* Main API Info & Copy Section */}
							<Grid
								size={12}
								id="api-sessions-endpoint"
								className={styles.jumpSection}
							>
								<Typography className={styles.sectionDescription}>
									{translations.API_INSTRUCTIONS ||
										"Use the following personal endpoint to integrate session data into your external services, scripts, or platforms."}
								</Typography>

								<div className={styles.urlContainer}>
									<Tooltip title={apiUrl}>
										<div className={styles.urlText}>{apiUrl}</div>
									</Tooltip>
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
											<tr>
												<td>
													<code className={styles.inlineCode}>group</code>
												</td>
												<td>{translations.API_TYPE_STRING || "String"}</td>
												<td>
													{translations.API_PARAM_GROUP_DESC ||
														"Filter sessions by their specific group name."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>tag</code>
												</td>
												<td>{translations.API_TYPE_STRING || "String"}</td>
												<td>
													{translations.API_PARAM_TAG_DESC ||
														"Filter sessions containing a specific tag."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>date</code>
												</td>
												<td>{translations.API_TYPE_STRING || "String"}</td>
												<td>
													{translations.API_PARAM_DATE_DESC ||
														"Filter by exact date (format: YYYY-MM-DD)."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>year</code>
												</td>
												<td>{translations.API_TYPE_STRING || "String"}</td>
												<td>
													{translations.API_PARAM_YEAR_DESC ||
														"Filter sessions by year."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>query</code>
												</td>
												<td>{translations.API_TYPE_STRING || "String"}</td>
												<td>
													{translations.API_PARAM_QUERY_DESC ||
														"Text search across title, synopsis, and tags."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>index</code>
												</td>
												<td>{translations.API_TYPE_INTEGER || "Integer"}</td>
												<td>
													{translations.API_PARAM_INDEX_DESC ||
														"Start index for pagination / sliding window (default: 0)."}
												</td>
											</tr>
											<tr>
												<td>
													<code className={styles.inlineCode}>count</code>
												</td>
												<td>{translations.API_TYPE_INTEGER || "Integer"}</td>
												<td>
													{translations.API_PARAM_COUNT_DESC ||
														"Limit results count (default: 100, max: 500)."}
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</Grid>

							{/* Code Examples Section */}
							<Grid
								size={12}
								id="api-sessions-examples"
								className={styles.jumpSection}
							>
								<div className={styles.docHeader}>
									<Typography className={styles.subSectionTitle}>
										{translations.API_DOCUMENTATION ||
											"API Documentation & Examples"}
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
							<Grid
								size={12}
								id="api-sessions-schema"
								className={styles.jumpSection}
							>
								<Typography className={styles.subSectionTitle}>
									{translations.API_JSON_RESPONSE_SCHEMA ||
										"JSON Response Schema"}
								</Typography>
								<div className={styles.codeBlockContainer}>
									<pre className={styles.codeBlock}>
										<code>{`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SessionsResponse",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Unique identifier of the session."
      },
      "group": {
        "type": "string",
        "description": "The group name the session belongs to."
      },
      "year": {
        "type": "string",
        "description": "The year of the session (YYYY)."
      },
      "date": {
        "type": "string",
        "format": "date",
        "description": "The exact date of the session (YYYY-MM-DD)."
      },
      "name": {
        "type": "string",
        "description": "The display name of the session."
      },
      "duration": {
        "type": "integer",
        "minimum": 0,
        "description": "The duration of the session in seconds."
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "List of tags associated with the session."
      },
      "summaryText": {
        "type": ["string", "null"],
        "description": "Detailed AI-generated summary of the session."
      },
      "imageUrl": {
        "type": ["string", "null"],
        "format": "uri",
        "description": "S3-proxied secure URL to the image asset."
      },
      "transcriptionUrl": {
        "type": ["string", "null"],
        "format": "uri",
        "description": "S3-proxied secure URL to the raw text transcription file."
      }
    },
    "required": [
      "id",
      "group",
      "year",
      "date",
      "name",
      "duration",
      "tags",
      "summaryText",
      "imageUrl",
      "transcriptionUrl"
    ]
  }
}`}</code>
									</pre>
								</div>
							</Grid>
						</Grid>
					</>
				)}
			</div>
		</div>
	);
}
