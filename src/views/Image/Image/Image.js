import { ContentSize } from "@components/Page/Content";
import ErrorIcon from "@mui/icons-material/Error";
import { useSync } from "@sync/sync";
import {
	getStableFetchCacheOptions,
	SIGNED_URL_CACHE_TTL_MS,
	useFetchJSON,
} from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { readBinary } from "@util/data/binary";
import { makePath } from "@util/data/path";
import { useTranslations } from "@util/domain/translations";
import { useParentParams, useParentPath } from "@util/domain/views";
import { exportData, exportFile } from "@util/storage/importExport";
import Download from "@widgets/Download";
import Message from "@widgets/Message";
import Progress from "@widgets/Progress";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./Image.module.css";

function useImagePath(imageName = "", extension) {
	const {
		prefix = "sessions",
		group = "",
		year = "",
		date = "",
		name,
	} = useParentParams();
	const parentPath = useParentPath();
	let path = "";
	if (group) {
		let components = [prefix, group, year, date + " " + name + "." + extension]
			.filter(Boolean)
			.join("/");
		path = makePath(components).split("/").join("/");
	} else {
		if (imageName.endsWith("." + extension)) {
			path = (parentPath + "/" + imageName).split("/").slice(1).join("/");
		} else {
			path = (parentPath + "/" + imageName + "." + extension)
				.split("/")
				.slice(1)
				.join("/");
		}
	}
	const [data, , loading] = useFetchJSON(
		"/api/player",
		{
			headers: { path: encodeURIComponent(path) },
			...getStableFetchCacheOptions(SIGNED_URL_CACHE_TTL_MS),
		},
		[path],
		path && group,
	);
	let downloadUrl = "";
	if (path && group) {
		if (data) {
			path = data.path || "";
			downloadUrl = data.downloadUrl || "";
		}
	}

	return { path, downloadUrl, loading };
}

export default function ImagePage({ name, ext = "png" }) {
	const translations = useTranslations();
	const size = useContext(ContentSize);
	const [syncCounter] = useSync();
	const {
		path,
		downloadUrl,
		loading: signingLoading,
	} = useImagePath(name, ext);
	const busyRef = useRef(false);
	const [loading, setLoading] = useState(false);
	const [imageLoading, setImageLoading] = useState(true);
	const [content, setContent] = useState(null);
	const [src, setSrc] = useState(null);
	const [error, setError] = useState(null);
	const onLoad = () => {
		setImageLoading(false);
	};
	const onError = (event) => {
		structuredLogger.warn("Failed to load image", event);
		setError(true);
		setImageLoading(false);
	};

	const readFile = useCallback(async () => {
		if (busyRef.current) {
			return;
		}
		busyRef.current = true;
		setLoading(true);
		setError(null);
		try {
			if (path.startsWith("https")) {
				setSrc(path);
			} else {
				const content = await readBinary(path);
				setContent(content);
			}
			setLoading(false);
		} catch (err) {
			const errorString = String(err);
			if (errorString.includes("FILE_NOT_FOUND") && signingLoading) {
				// Ignore local file not found if we are still fetching signed URL
				structuredLogger.debug(
					"Local image not found, waiting for signed URL...",
				);
				setLoading(false);
			} else {
				structuredLogger.warn("Failed to read image", err);
				setError(err);
				setContent(null);
				setLoading(false);
			}
		}
		busyRef.current = false;
	}, [path, signingLoading]);
	useEffect(() => {
		if (path) {
			readFile();
		}
	}, [path, readFile]);

	useEffect(() => {
		if (path) {
			readFile();
		}
	}, [syncCounter, path, readFile]);

	useEffect(() => {
		if (content) {
			var reader = new FileReader();
			reader.addEventListener(
				"load",
				() => {
					setSrc(reader.result);
				},
				false,
			);
			reader.readAsDataURL(content);
		}
	}, [content]);

	const downloadImage = () => {
		if (downloadUrl) {
			exportFile(downloadUrl, name + "." + ext);
		} else if (content) {
			exportData(content, name);
		} else {
			exportFile(path, name);
		}
	};
	const style = { height: size.height - 22, width: size.width - 22 };

	return (
		<div className={styles.root}>
			<Download
				visible={!loading && !imageLoading && !error && !signingLoading}
				onClick={downloadUrl ? undefined : downloadImage}
				target={downloadUrl}
			/>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			{!loading && !error && src && (
				<img
					alt={name}
					className={styles.img}
					onError={onError}
					onLoad={onLoad}
					style={{ ...style, visibility: imageLoading ? "hidden" : "visible" }}
					src={src}
				/>
			)}
			{(!!loading || !!imageLoading || !!signingLoading) && (
				<Progress fullscreen={true} />
			)}
			{!!error && (
				<Message Icon={ErrorIcon} label={translations.CANNOT_LOAD_IMAGE} />
			)}
		</div>
	);
}
