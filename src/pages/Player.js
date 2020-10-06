import { useContext, useEffect } from "react";
import { Store } from "pullstate";
import { useTranslations } from "@/util/translations";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import styles from "./Player.module.scss";
import { makePath, fileTitle, fileName, fileFolder, isAudioFile, isVideoFile } from "@/util/path";
import Audio from "./Player/Audio";
import Video from "./Player/Video";
import { PageSize } from "@/components/Page";
import Download from "@/widgets/Download";
import { exportFile } from "@/util/importExport";
import { useFetchJSON } from "@/util/fetch";
import Progress from "@/widgets/Progress";
import { useFile } from "@/util/storage";
import VideoLabelIcon from '@material-ui/icons/VideoLabel';

export const PlayerStore = new Store({
    playerPath: "",
    mediaPath: "",
    hash: ""
});

registerToolbar("Player");

export default function PlayerPage({ show = false, prefix = "", group = "", year = "", name, suffix, parentPath }) {
    const translations = useTranslations();
    const { hash, playerPath, mediaPath } = PlayerStore.useState();
    const size = useContext(PageSize);
    let components = [parentPath, prefix, group, year, name + (suffix || "")].filter(Boolean).join("/");
    const path = makePath(components).split("/").slice(2).join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && path !== playerPath);
    const folder = fileFolder(path);
    const [, , groupName, yearName] = folder.split("/");
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata/" + folder + "/" + sessionName + ".json";
    const [metadata, , , setMetadata] = useFile(metadataPath, [], data => {
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
        PlayerStore.update(s => {
            s.mediaPath = data && data.path;
        });
    }, [data && data.path]);

    const menuItems = [
        hash && !show && {
            id: "player",
            name: translations.PLAYER,
            icon: <VideoLabelIcon />,
            onClick: gotoPlayer
        }
    ].filter(Boolean);

    useToolbar({ id: "Player", items: menuItems, depends: [hash, show, translations] });

    const style = {
        visibility: show ? "visible" : "hidden",
        flex: show ? "1" : "",
        ...!show && { maxHeight: "0px" }
    };
    const mediaStyles = {
        width: size.width + "px",
        height: size.height - (size.emPixels * 9) + "px"
    }
    const isAudio = isAudioFile(mediaPath);
    const isVideo = isVideoFile(mediaPath);
    let MediaComponent = null;
    let mediaType = undefined;
    const mediaProps = {
        metadata,
        setMetadata,
        group: groupName,
        year: yearName,
        name: sessionName,
        path: mediaPath
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

    return <div className={styles.root} style={style}>
        <Download visible={show && mediaPath} onClick={downloadFile} />
        {MediaComponent && <MediaComponent style={mediaStyles} {...mediaProps}>
            {mediaPath && <source src={mediaPath} type={mediaType} />}
        </MediaComponent>}
        {!!loading && <Progress />}
    </div>;
}