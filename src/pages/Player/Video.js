import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";
import { PlayerStore } from "../Player";
import styles from "./Video.module.scss";

export default function Video({ show, metadataPath, name, path, children, ...props }) {
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
        <video ref={ref} {...props}>
            {children}
        </video>
        <div className={styles.root}>
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
