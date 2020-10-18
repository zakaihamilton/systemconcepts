import { useRef, useState, useEffect } from "react";
import Controls from "./Controls";
import Toolbar from "./Toolbar";

export default function Video({ show, metadata, setMetadata, children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
    }, [ref.current]);
    return <>
        <video ref={ref} {...props}>
            {children}
        </video>
        {playerRef && <Controls
            playerRef={playerRef}
            metadata={metadata}
            setMetadata={setMetadata}
        />}
        {playerRef && <Toolbar show={show} playerRef={playerRef} isVideo={true} />}
    </>;
}
