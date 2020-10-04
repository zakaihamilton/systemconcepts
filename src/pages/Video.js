import { useContext } from "react";
import styles from "./Video.module.scss";
import { useParentPath } from "@/util/pages";
import Progress from "@/widgets/Progress";
import { PageSize } from "@/components/Page";
import { useFetchJSON } from "@/util/fetch";
import { makePath, fileName } from "@/util/path";
import Download from "@/widgets/Download";
import { exportFile } from "@/util/importExport";
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

    const style = { height: size.height, width: size.width };
    const downloadFile = () => {
        exportFile(url, fileName(path));
    }

    return <div className={styles.root} style={style}>
        <Download loading={loading} onClick={downloadFile} />
        {!loading && <Player fluid={false} width={style.width} height={style.height} autoPlay={true} playsInline src={data && data.path}>
            <BigPlayButton position="center" />
            <ControlBar>
                <ReplayControl seconds={10} order={1.1} />
                <ForwardControl seconds={30} order={1.2} />
                <CurrentTimeDisplay order={4.1} />
                <TimeDivider order={4.2} />
                <PlaybackRateMenuButton rates={[5, 2, 1.25, 1, 0.75, 0.5, 0.1]} order={7} />
                <VolumeMenuButton enabled />
            </ControlBar>
        </Player>}
        {loading && <Progress />}
    </div>;
}
