import { fileExtension, fileFolder, fileName } from "@/util/path";
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

export default function AudioPage({ name }) {
    const size = useContext(PageSize);
    const path = (useParentPath() + "/" + name).split("/").slice(2).join("/");
    const { path: audioPath, loaded } = AudioStore.useState();
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && path !== audioPath);
    const audioPlayer = useAudioPlayer({});
    const audioPosition = useAudioPosition({});
    const folder = fileFolder(path);
    const [, , group, year] = folder.split("/");
    const sessionName = fileName(path);
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

    return <div className={styles.root} style={style}>
        {!loading && audioPlayer.ready && <div className={styles.player}>
            <Player
                setMetadata={setMetadata}
                group={group}
                year={year}
                name={sessionName} />
        </div>}
        {(loading || !audioPlayer.ready) && <Progress />}
    </div>;
}
