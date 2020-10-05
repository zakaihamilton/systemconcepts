import { useRef, useState, useEffect } from "react";
import VideoControls from "./Video/VideoControls";

export default function Video({ path, metadata, setMetadata, group = "", year = "", name = "", children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
    }, [ref.current]);
    return <>
        <video ref={ref} {...props}>
            {children}
        </video>
        {ref && ref.current && <VideoControls
            playerRef={playerRef}
            metadata={metadata}
            setMetadata={setMetadata}
            group={group}
            year={year}
            name={name}
            path={path}
        />}
    </>;
}
