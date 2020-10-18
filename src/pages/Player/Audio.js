import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";

export default function Audio({ show, metadata, setMetadata, children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
    }, [ref.current]);
    return <>
        <audio ref={ref} {...props}>
            {children}
        </audio>
        {playerRef && <Controls
            playerRef={playerRef}
            metadata={metadata}
            setMetadata={setMetadata}
        />}
        {playerRef && <Toolbar show={show} playerRef={playerRef} />}
    </>;
}
