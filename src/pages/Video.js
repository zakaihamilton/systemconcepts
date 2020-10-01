import { useContext } from "react";
import styles from "./Video.module.scss";
import { useParentPath } from "@/util/pages";
import Download from "./Player/Download";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
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

export default function VideoPage({ name }) {
    const size = useContext(PageSize);
    const path = (useParentPath() + "/" + name).split("/").slice(2).join("/");
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);

    const style = { height: size.height, width: size.width };

    return <div className={styles.root} style={style}>
        {!loading && <Player fluid={false} width={style.width} height={style.height} autoPlay={true} playsInline src={data && data.path}>
            <BigPlayButton position="center" />
            <ControlBar>
                <ReplayControl seconds={10} order={1.1} />
                <ForwardControl seconds={30} order={1.2} />
                <CurrentTimeDisplay order={4.1} />
                <TimeDivider order={4.2} />
                <PlaybackRateMenuButton rates={[5, 2, 1, 0.5, 0.1]} order={7} />
                <Download order={7.1} />
                <VolumeMenuButton enabled />
            </ControlBar>
        </Player>}
        {loading && <Progress />}
    </div>;
}
