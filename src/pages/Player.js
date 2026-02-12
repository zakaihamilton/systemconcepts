import { useContext, useEffect } from "react";
import { Store } from "pullstate";
import { useLocalStorage } from "@util/store";
import { useTranslations } from "@util/translations";
import { MainStore } from "../components/Main";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import styles from "./Player.module.scss";
import { makePath, fileTitle, fileName, fileFolder, isAudioFile, isVideoFile } from "@util/path";
import Audio from "./Player/Audio";
import Video from "./Player/Video";
import { ContentSize } from "@components/Page/Content";
import Download from "@widgets/Download";
import { exportFile } from "@util/importExport";
import { useFetchJSON } from "@util/fetch";
import Progress from "@widgets/Progress";
import VideoLabelIcon from "@mui/icons-material/VideoLabel";
import { useParentParams } from "@util/pages";
import StatusBar from "@widgets/StatusBar";
import Cookies from "js-cookie";
import { useSessions } from "@util/sessions";
import ClosedCaptionIcon from "@mui/icons-material/ClosedCaption";
import ClosedCaptionOffIcon from "@mui/icons-material/ClosedCaptionOff";
import InfoIcon from "@mui/icons-material/Info";
import SpeedSlider from "./Player/SpeedSlider";
import Transcript from "./Player/Transcript";
import { useRecentHistory } from "@util/history";

export const PlayerStore = new Store({
    mediaPath: "",
    downloadUrl: "",
    subtitles: "",
    showSubtitles: true,
    showDetails: true,
    showSpeed: false,
    hash: "",
    player: null,
    session: null
});

registerToolbar("Player");

export default function PlayerPage({ show = false, suffix, mode, ...props }) {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    const { hash, mediaPath: storeMediaPath, downloadUrl, subtitles: storeSubtitles, showSubtitles, showSpeed, showDetails, session } = PlayerStore.useState();
    const { speedToolbar } = MainStore.useState();
    const size = useContext(ContentSize);
    useLocalStorage("PlayerStore", PlayerStore, ["showSpeed", "showSubtitles", "showDetails"]);
    const [, , groups] = useSessions([], { filterSessions: false, skipSync: true, active: false });
    const { prefix = "sessions", group = "", year = "", date = "", name = "" } = { ...useParentParams(), ...props };
    let components = [prefix, group, year, date + " " + name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const [data, , loading, error] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && group);
    const folder = fileFolder(path);
    const sessionName = fileTitle(path);
    const groupInfo = groups.find(g => g.name === group);
    const isBundled = groupInfo?.bundled;
    const isMerged = groupInfo?.merged;

    let metadataPath = null;
    let metadataKey = null;

    if (folder && sessionName && group) { // ensure we have group
        if (isBundled) {
            // Bundled groups share a common file
            metadataPath = "local/personal/bundle.json";
            // Key must include group to be unique
            metadataKey = `${group}/${year ? year + "/" : ""}${sessionName}.json`;
        } else if (isMerged) {
            // Merged groups have their own single file
            metadataPath = `local/personal/${group}.json`;
            // Key format: {year}/{sessionName}.json
            metadataKey = `${year ? year + "/" : ""}${sessionName}.json`;
        } else {
            // Split groups: year-based bundles
            metadataPath = `local/personal/${group}/${year}.json`;
            metadataKey = `${sessionName}.json`;
        }
    }


    const mediaPath = data?.path || storeMediaPath;
    const subtitles = data?.subtitles || storeSubtitles;

    const isAudio = isAudioFile(path);
    const isVideo = isVideoFile(path);

    const gotoPlayer = () => {
        let hashPath = hash;
        if (hashPath.startsWith("#")) {
            hashPath = hashPath.substring(1);
        }
        window.location.hash = hashPath;
    };

    useEffect(() => {
        if (show) {
            PlayerStore.update(s => {
                s.hash = window.location.hash;
            });
        }
    }, [show, path]);

    useEffect(() => {
        PlayerStore.update(s => {
            s.mediaPath = "";
            s.downloadUrl = "";
            s.subtitles = "";
        });
    }, [path]);

    useEffect(() => {
        if (data && data.path) {
            PlayerStore.update(s => {
                s.mediaPath = data.path;
                s.downloadUrl = data.downloadUrl;
                s.subtitles = data.subtitles;
            });
        }
    }, [data]);

    const [, addToHistory, loadingHistory] = useRecentHistory();

    useEffect(() => {
        if (group && date && name && !loadingHistory) {
            PlayerStore.update(s => {
                const session = { group, date, name };
                console.log("sesion playing", session);
                s.session = session;
                addToHistory(session);
            });
        }
    }, [group, date, name, addToHistory, loadingHistory]);

    const color = groups.find(item => item.name === group)?.color;

    const playingSessionName = session && <div className={styles.playingSessionName}><b>{session.group[0].toUpperCase() + session.group.substring(1)}</b><div>{session.date + " " + session.name}</div></div>;

    const toolbarItems = [
        hash && !show && {
            id: "player",
            name: playingSessionName,
            icon: <VideoLabelIcon />,
            menu: false,
            target: hash,
            onClick: gotoPlayer,
            className: styles.playerIcon
        },
        subtitles && show && {
            id: "subtitles",
            location: "header",
            name: showSubtitles ? translations.SUBTITLES : translations.SUBTITLES_OFF,
            icon: showSubtitles ? <ClosedCaptionIcon /> : <ClosedCaptionOffIcon />,
            onClick: () => {
                PlayerStore.update(s => {
                    s.showSubtitles = !s.showSubtitles;
                });
            }
        },
        show && !isVideo && {
            id: "details",
            location: "header",
            name: translations.DETAILS,
            icon: <InfoIcon />,
            active: showDetails,
            onClick: () => {
                PlayerStore.update(s => {
                    s.showDetails = !s.showDetails;
                });
            }
        }
    ].filter(Boolean);

    useToolbar({ id: "Player", items: toolbarItems, depends: [hash, subtitles, showSubtitles, translations, show, showDetails, isVideo, playingSessionName] });

    const style = {
        visibility: show ? "visible" : "hidden",
        height: show ? size.height + "px" : "auto",
        overflow: "hidden",
        ...(!show && { maxHeight: "0px" })
    };

    // Account for: header (4em), tabs (4em), speed slider (120px when visible), controls (~3em)
    // Total: ~11em base + 120px for speed slider when visible + 2em for video margins
    const baseEmSubtraction = 13; // Increased from 11 to account for 2em margins (top + bottom)
    const isTranscript = mode === "transcript";
    const speedSliderHeight = showSpeed ? 120 : 0;
    const mediaStyles = {
        width: size.width + "px",
        marginTop: "1em",
        marginBottom: "1em"
    };

    if (isTranscript) {
        mediaStyles.flex = "1";
        mediaStyles.minHeight = "0";
        mediaStyles.display = "flex";
        mediaStyles.flexDirection = "column";
    }
    else {
        mediaStyles.height = (size.height - (size.emPixels * baseEmSubtraction) - speedSliderHeight) + "px";
    }
    let MediaComponent = null;
    let mediaType = undefined;
    const activeMetadataKey = (data && !loading) ? metadataKey : null;

    const mediaProps = {
        metadataPath,
        metadataKey: activeMetadataKey,
        path: mediaPath,
        date,
        year,
        show,
        group,
        color,
        name,
        showDetails,
        isTranscript,
        preload: "metadata",
        crossOrigin: "anonymous"
    };
    if (isAudio || (isVideo && isTranscript)) {
        MediaComponent = Audio;
        mediaType = isAudio ? "audio/mp4" : "video/mp4";
    }
    else if (isVideo) {
        MediaComponent = Video;
        mediaType = "video/mp4";
    }

    const downloadFile = () => {
        if (downloadUrl) {
            exportFile(downloadUrl, fileName(path));
        }
    };
    const statusBar = <StatusBar store={PlayerStore} />;

    useEffect(() => {
        PlayerStore.update(s => {
            if (!isSignedIn) {
                s.mode = "signin";
                s.message = translations.REQUIRE_SIGNIN;
            }
            else if (error) {
                s.mode = "player";
                s.message = translations.PLAY_NOT_ALLOWED;
            }
            else {
                s.mode = "";
                s.message = "";
            }
        });
    }, [isSignedIn, translations, error]);

    const elements = isTranscript ? <Transcript show={show} /> : null;

    return <div className={styles.root} style={style}>
        <div id="search-status-portal" />
        {statusBar}
        {speedToolbar === "top" && <SpeedSlider />}
        <Download visible={show && downloadUrl && !isTranscript} onClick={downloadFile} target={downloadUrl} />
        {MediaComponent ? <MediaComponent key={subtitles} style={mediaStyles} {...mediaProps} elements={elements}>
            {mediaPath && <source src={mediaPath} type={mediaType} />}
            {!isTranscript && subtitles && showSubtitles && <track label="English" kind="subtitles" srcLang="en" src={subtitles} default />}
        </MediaComponent> : (isTranscript ? elements : null)}
        {speedToolbar === "bottom" && <SpeedSlider />}
        {!!loading && !mediaPath && <Progress />}
    </div>;
}
