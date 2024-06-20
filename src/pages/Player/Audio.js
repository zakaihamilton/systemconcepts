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
    }, [ref.current]);
    useEffect(() => {
        PlayerStore.update(s => {
            s.player = playerRef;
        });
    }, [playerRef]);
    return <>
        <audio ref={ref} {...props}>
            {children}
        </audio>
        <div className={styles.root}>
            <div className={styles.group}><Group fill={false} name={group} color={color} /></div>
            <div className={styles.name}>{name}</div>
            {playerRef && <Controls
                playerRef={playerRef}
                metadataPath={metadataPath}
                path={path}
                show={show}
            />}
            {playerRef && <Toolbar show={show} name={name} playerRef={playerRef} isVideo={true} />}
        </div>
    </>;
}
