import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";
import { PlayerStore } from "../Player";
import styles from "./Audio.module.scss";
import Group from "@components/Widgets/Group";

export default function Audio({ show, metadataPath, name, path, group, color, children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
        return () => {
            setPlayerRef(null);
        };
    }, []);
    useEffect(() => {
        PlayerStore.update(s => {
            s.player = playerRef;
        });
    }, [playerRef]);

    useEffect(() => {
        if (ref.current) {
            const tracks = ref.current.textTracks;
            if (tracks && tracks[0]) {
                tracks[0].mode = 'showing';
            }
        }
    }, [children]);

    const { style, ...rest } = props;
    return <div className={styles.root} style={style}>
        <video ref={ref} className={styles.video} {...rest}>
            {children}
        </video>
        <div className={styles.group}><Group fill={false} name={group} color={color} /></div>
        <div className={styles.name}>{name}</div>
        {playerRef && <Controls
            playerRef={playerRef}
            metadataPath={metadataPath}
            path={path}
            show={show}
            zIndex={1}
        />}
        {playerRef && <Toolbar show={show} name={name} playerRef={playerRef} isVideo={false} />}
    </div>;
}
