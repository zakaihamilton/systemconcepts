import { fileExtension, fileFolder, fileTitle, fileName } from "@/util/path";
import { useContext, useEffect } from "react";
import styles from "./Audio.module.scss";
import { useParentPath } from "@/util/pages";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
import { useAudioPlayer, useAudioPosition } from "react-use-audio-player";
import { AudioStore } from "@/widgets/Audio";
import Player from "./Audio/Player";
import { useFile } from "@/util/storage";
import { makePath } from "@/util/path";
import Download from "@/widgets/Download";
import { exportFile } from "@/util/importExport";

export default function AudioPage({ prefix = "", group = "", year = "", name }) {
    const size = useContext(PageSize);
    let components = [useParentPath(), prefix, group, year, name].filter(Boolean).join("/");
    const path = makePath(components).split("/").slice(2).join("/");
    const { path: audioPath, loaded, url } = AudioStore.useState();
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && path !== audioPath);
    const audioPlayer = useAudioPlayer({});
    const audioPosition = useAudioPosition({});
    const folder = fileFolder(path);
    const [, , groupName, yearName] = folder.split("/");
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata/" + folder + "/" + sessionName + ".json";
    const [metadata, , , setMetadata] = useFile(metadataPath, [], data => {
        return data ? JSON.parse(data) : {};
    });
    useEffect(() => {
        if (data && data.path && path !== audioPath) {
            const extension = fileExtension(path);
            AudioStore.update(s => {
                s.hash = window.location.hash;
                s.path = path;
                s.loaded = false;
                s.url = data.path;
            });
            audioPlayer.load({
                src: data.path,
                format: extension,
                autoplay: false,
                onload: () => {
                    AudioStore.update(s => {
                        s.loaded = true;
                    });
                }
            });
        }
    }, [data && data.path]);

    useEffect(() => {
        if (loaded && metadata && metadata.position) {
            audioPosition.seek(metadata.position);
        }
    }, [loaded]);

    const style = { height: size.height, width: size.width };
    const downloadFile = () => {
        exportFile(url, fileName(path));
    }

    return <div className={styles.root} style={style}>
        <Download loading={loading} onClick={downloadFile} />
        {!loading && audioPlayer.ready && <div className={styles.player}>
            <Player
                setMetadata={setMetadata}
                group={groupName}
                year={yearName}
                name={sessionName} />
        </div>}
        {(loading || !audioPlayer.ready) && <Progress />}
    </div>;
}
