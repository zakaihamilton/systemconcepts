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
import { useGroups } from "@util/groups";
import ClosedCaptionIcon from "@mui/icons-material/ClosedCaption";
import ClosedCaptionOffIcon from "@mui/icons-material/ClosedCaptionOff";
import SpeedSlider from "./Player/SpeedSlider";

export const PlayerStore = new Store({
    mediaPath: "",
    subtitles: "",
    showSubtitles: true,
    showSpeed: false,
    hash: "",
    player: null
});

registerToolbar("Player");

export default function PlayerPage({ show = false, suffix }) {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    const { hash, mediaPath, subtitles, showSubtitles, showSpeed } = PlayerStore.useState();
    const { speedToolbar } = MainStore.useState();
    const size = useContext(ContentSize);
    useLocalStorage("PlayerStore", PlayerStore, ["showSpeed", "showSubtitles"]);
    const [groups] = useGroups([]);
    const { prefix = "sessions", group = "", year = "", date = "", name = "" } = useParentParams();
    let components = [prefix, group, year, date + " " + name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const [data, , loading, error] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && group);
    const folder = fileFolder(path);
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata" + folder + "/" + sessionName + ".json";

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
        if (data && data.path) {
            PlayerStore.update(s => {
                s.mediaPath = data && data.path;
                s.subtitles = data && data.subtitles;
            });
        }
    }, [data && data.path]);

    const color = groups.find(item => item.name === group)?.color;

    const toolbarItems = [
        hash && !show && {
            id: "player",
            name: translations.PLAYER,
            icon: <VideoLabelIcon />,
            menu: false,
            target: hash,
            onClick: gotoPlayer
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
        }
    ].filter(Boolean);

    useToolbar({ id: "Player", items: toolbarItems, depends: [hash, subtitles, showSubtitles, translations, show] });

    const style = {
        visibility: show ? "visible" : "hidden",
        flex: show ? "1" : "",
        ...(!show && { maxHeight: "0px" })
    };

    // Account for: header (4em), tabs (4em), speed slider (120px when visible), controls (~3em)
    // Total: ~11em base + 120px for speed slider when visible + 2em for video margins
    const baseEmSubtraction = 13; // Increased from 11 to account for 2em margins (top + bottom)
    const speedSliderHeight = showSpeed ? 120 : 0;
    const mediaStyles = {
        width: size.width + "px",
        height: (size.height - (size.emPixels * baseEmSubtraction) - speedSliderHeight) + "px",
        marginTop: "1em",
        marginBottom: "1em"
    };
    const isAudio = isAudioFile(mediaPath);
    const isVideo = isVideoFile(mediaPath);
    let MediaComponent = null;
    let mediaType = undefined;
    const mediaProps = {
        metadataPath,
        path: mediaPath,
        date,
        year,
        show,
        group,
        color,
        name,
        preload: "metadata",
        crossOrigin: "anonymous"
    };
    if (isAudio) {
        MediaComponent = Audio;
        mediaType = "audio/mp4";
    }
    else if (isVideo) {
        MediaComponent = Video;
        mediaType = "video/mp4";
    }

    const downloadFile = () => {
        exportFile(mediaPath, fileName(path));
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

    return <div className={styles.root} style={style}>
        {statusBar}
        {speedToolbar === "top" && <SpeedSlider />}
        <Download visible={show && mediaPath} onClick={downloadFile} target={mediaPath} />
        {MediaComponent && <MediaComponent key={subtitles} style={mediaStyles} {...mediaProps}>
            {mediaPath && <source src={mediaPath} type={mediaType} />}
            {subtitles && showSubtitles && <track label="English" kind="subtitles" srcLang="en" src={subtitles} default />}
        </MediaComponent>}
        {speedToolbar === "bottom" && <SpeedSlider />}
        {!!loading && !mediaPath && <Progress />}
    </div>;
}
