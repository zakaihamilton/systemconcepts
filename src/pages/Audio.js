import { fileExtension } from "@/util/path";
import { useContext, useEffect } from "react";
import styles from "./Audio.module.scss";
import { getPreviousPath } from "@/util/pages";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
import { useAudioPlayer } from "react-use-audio-player"
import { AudioStore } from "@/widgets/Audio";
import Toolbar from "./Audio/Toolbar";

export default function AudioPage({ name }) {
    const size = useContext(PageSize);
    const path = (getPreviousPath() + "/" + name).split("/").slice(2).join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);
    const { path: audioPath } = AudioStore.useState();
    const audioPlayer = useAudioPlayer({});
    const onEnd = () => {

    };
    useEffect(() => {
        if (data && path !== audioPath) {
            const extension = fileExtension(path);
            audioPlayer.load({
                src: data.path,
                format: extension,
                onend: onEnd
            });
            AudioStore.update(s => {
                s.path = path;
            });
        }
    }, [data && data.path]);

    const style = { height: size.height, width: size.width };

    return <div className={styles.root} style={style}>
        {!loading && audioPlayer.ready && <div className={styles.player}>
            <Toolbar />
        </div>}
        {(loading || !audioPlayer.ready) && <Progress />}
    </div>;
}
