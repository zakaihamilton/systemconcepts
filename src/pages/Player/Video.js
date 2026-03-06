import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";
import { PlayerStore } from "../Player";
import styles from "./Video.module.scss";

export default function Video({ show, metadataPath, metadataKey, name, path, renewUrl, color, group, children, elements, showDetails: _showDetails, isTranscript: _isTranscript, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    const [errorCount, setErrorCount] = useState(0);

    const onError = () => {
        if (errorCount < 3) {
            console.log("Video error, renewing URL...");
            renewUrl();
            setErrorCount(count => count + 1);
        }
    };

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
    return <>
        <video ref={ref} {...props} playsInline onError={onError}>
            {children}
        </video>
        {elements}
        <div className={styles.root}>
            {playerRef && <Controls
                playerRef={playerRef}
                color={color}
                metadataPath={metadataPath}
                metadataKey={metadataKey}
                path={path}
                show={show}
                sessionName={name}
                groupName={group}
            />}
            {playerRef && <Toolbar show={show} name={name} playerRef={playerRef} isVideo={true} />}
        </div>
    </>;
}
