import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";
import { PlayerStore } from "../Player";

export default function Video({ show, metadata, setMetadata, children, ...props }) {
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
        {playerRef && <Controls
            playerRef={playerRef}
            metadata={metadata}
            setMetadata={setMetadata}
            show={show}
        />}
        {playerRef && <Toolbar show={show} playerRef={playerRef} isVideo={true} />}
    </>;
}
