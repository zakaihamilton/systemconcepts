import styles from "./Player.module.scss";
import { useContext } from "react";
import { getPreviousPath } from "@/util/pages";
import { PageSize } from "@/components/Page";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import { useTranslations } from "@/util/translations";
import { exportData } from "@/util/importExport";
import Download from "./Player/Download";
import {
    Player,
    ControlBar,
    ReplayControl,
    ForwardControl,
    CurrentTimeDisplay,
    TimeDivider,
    PlaybackRateMenuButton,
    VolumeMenuButton
} from 'video-react';

registerToolbar("Player");

export default function PlayerPage({ name }) {
    const translations = useTranslations();
    const size = useContext(PageSize);
    const path = (getPreviousPath() + "/" + name).split("/").slice(1).join("/");

    const menuItems = [
    ].filter(Boolean);

    useToolbar({ id: "Player", items: menuItems, depends: [] });

    const style = {};

    return <div className={styles.root} style={style}>
        <Player playsInline src="https://media.w3.org/2010/05/sintel/trailer_hd.mp4">
            <ControlBar>
                <ReplayControl seconds={10} order={1.1} />
                <ForwardControl seconds={30} order={1.2} />
                <CurrentTimeDisplay order={4.1} />
                <TimeDivider order={4.2} />
                <Download order={7} />
                <PlaybackRateMenuButton rates={[5, 2, 1, 0.5, 0.1]} order={7.1} />
                <VolumeMenuButton enabled />
            </ControlBar>
        </Player>
    </div>;
}
