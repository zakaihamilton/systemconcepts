import { useContext, useEffect, useRef, useState } from "react";
import styles from "./Video.module.scss";
import { useParentPath } from "@/util/pages";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
import { makePath, fileName, fileTitle, fileFolder } from "@/util/path";
import Download from "@/widgets/Download";
import { exportFile } from "@/util/importExport";
import { useFile } from "@/util/storage";
import {
    Player,
    ControlBar,
    ReplayControl,
    ForwardControl,
    CurrentTimeDisplay,
    TimeDivider,
    PlaybackRateMenuButton,
    VolumeMenuButton,
    BigPlayButton
} from 'video-react';

export default function VideoPage({ prefix = "", group = "", year = "", name }) {
    const size = useContext(PageSize);
    let components = [useParentPath(), prefix, group, year, name].filter(Boolean).join("/");
    const path = makePath(components).split("/").slice(2).join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);
    const folder = fileFolder(path);
    const [playerState, setPlayerState] = useState({});
    const [seeked, setSeeked] = useState(false);
    const [player, setPlayer] = useState(null);
    const sessionName = fileTitle(path);
    const metadataPath = "local/personal/metadata/" + folder + "/" + sessionName + ".json";
    const [metadata, , , setMetadata] = useFile(metadataPath, [], data => {
        return data ? JSON.parse(data) : {};
    });

    const style = { height: size.height, width: size.width };
    const downloadFile = () => {
        exportFile(url, fileName(path));
    }

    useEffect(() => {
        if (player) {
            player.subscribeToStateChange(state => {
                setPlayerState(state);
            });
        }
    }, [player]);

    useEffect(() => {
        if (player && metadata && !seeked) {
            player.seek(metadata.position);
            setSeeked(true);
        }
    }, [player, metadata, seeked]);

    useEffect(() => {
        if (playerState && typeof playerState.currentTime !== "undefined") {
            setMetadata(data => {
                if (data) {
                    data.position = parseInt(playerState.currentTime);
                }
                return data;
            });
        }
    }, [playerState && parseInt(playerState.currentTime)]);

    const setPlayerRef = player => {
        setPlayer(player);
    };

    return <div className={styles.root} style={style}>
        <Download loading={loading} onClick={downloadFile} />
        {!loading && <Player
            ref={setPlayerRef}
            fluid={false}
            width={style.width}
            height={style.height}
            autoPlay={true}
            playsInline
            src={data && data.path}>
            <BigPlayButton position="center" />
            <ControlBar>
                <ReplayControl seconds={10} order={1.1} />
                <ForwardControl seconds={10} order={1.2} />
                <CurrentTimeDisplay order={4.1} />
                <TimeDivider order={4.2} />
                <PlaybackRateMenuButton rates={[5, 2, 1.25, 1, 0.75, 0.5, 0.1]} order={7} />
                <VolumeMenuButton enabled />
            </ControlBar>
        </Player>}
        {loading && <Progress />}
    </div>;
}
