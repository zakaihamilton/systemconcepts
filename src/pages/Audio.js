import { fileExtension, fileFolder, fileName } from "@/util/path";
import { useContext, useEffect, useState } from "react";
import styles from "./Audio.module.scss";
import { getPreviousPath } from "@/util/pages";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
import { useAudioPlayer, useAudioPosition } from "react-use-audio-player";
import { AudioStore } from "@/widgets/Audio";
import Controls from "./Audio/Controls";
import { useFile } from "@/util/storage";

export default function AudioPage({ name }) {
    const size = useContext(PageSize);
    const path = (getPreviousPath() + "/" + name).split("/").slice(2).join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);
    const { path: audioPath } = AudioStore.useState();
    const [loaded, setLoaded] = useState(false);
    const audioPlayer = useAudioPlayer({});
    const audioPosition = useAudioPosition({});
    const metadataPath = "local/personal/metadata/" + fileFolder(path) + "/" + fileName(path) + ".json";
    const [metadata, , , setMetadata] = useFile(metadataPath, [], data => {
        return data ? JSON.parse(data) : {};
    });
    useEffect(() => {
        if (data && path !== audioPath) {
            const extension = fileExtension(path);
            audioPlayer.load({
                src: data.path,
                format: extension,
                autoplay: false,
                onload: () => setLoaded(true)
            });
            AudioStore.update(s => {
                s.path = path;
            });
        }
    }, [data && data.path]);

    useEffect(() => {
        if (loaded && metadata.position) {
            audioPosition.seek(metadata.position);
        }
    }, [loaded]);

    const style = { height: size.height, width: size.width };

    return <div className={styles.root} style={style}>
        {!loading && audioPlayer.ready && <div className={styles.player}>
            <Controls setMetadata={setMetadata} />
        </div>}
        {(loading || !audioPlayer.ready) && <Progress />}
    </div>;
}
