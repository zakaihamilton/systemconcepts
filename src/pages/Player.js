import { useContext, useEffect } from "react";
import { Store } from "pullstate";
import { useTranslations } from "@util/translations";
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
import { useFile } from "@util/storage";
import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import { useParentParams } from "@util/pages";
import StatusBar from "@widgets/StatusBar";
import Cookies from 'js-cookie';

export const PlayerStore = new Store({
    playerPath: "",
    mediaPath: "",
    hash: "",
    player: null
});

registerToolbar("Player");

export default function PlayerPage({ show = false, suffix }) {
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const translations = useTranslations();
    const { hash, playerPath, mediaPath } = PlayerStore.useState();
    const size = useContext(ContentSize);
    const { prefix = "sessions", group = "", year = "", date = "", name = "" } = useParentParams();
    let components = [prefix, group, year, date + " " + name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").join("/");
    const [data, , loading, error] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && group && path !== playerPath);
    const folder = fileFolder(path);
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata" + folder + "/" + sessionName + ".json";
    const [metadata, , , setMetadata] = useFile(!!name && metadataPath, [metadataPath], data => {
        return data ? JSON.parse(data) : {};
    });

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
                s.playerPath = path;
            });
        }
    }, [show, path]);

    useEffect(() => {
        if (data && data.path) {
            PlayerStore.update(s => {
                s.mediaPath = data && data.path;
            });
        }
    }, [data && data.path]);

    const toolbarItems = [
        hash && {
            id: "player",
            name: translations.PLAYER,
            icon: <VideoLabelIcon />,
            menu: false,
            target: hash,
            onClick: gotoPlayer
        }
    ].filter(Boolean);

    useToolbar({ id: "Player", items: toolbarItems, visible: !show, depends: [hash, translations] });

    const style = {
        visibility: show ? "visible" : "hidden",
        flex: show ? "1" : "",
        ...!show && { maxHeight: "0px" }
    };
    const mediaStyles = {
        width: size.width + "px",
        height: size.height - (size.emPixels * 11) + "px"
    }
    const isAudio = isAudioFile(mediaPath);
    const isVideo = isVideoFile(mediaPath);
    let MediaComponent = null;
    let mediaType = undefined;
    const mediaProps = {
        metadata,
        setMetadata,
        path: mediaPath,
        show,
        name: date + " " + name,
        preload: "metadata"
    }
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
    }

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
        <Download visible={show && mediaPath} onClick={downloadFile} />
        {MediaComponent && <MediaComponent style={mediaStyles} {...mediaProps}>
            {mediaPath && <source src={mediaPath} type={mediaType} />}
        </MediaComponent>}
        {!!loading && !mediaPath && <Progress />}
    </div>;
}
