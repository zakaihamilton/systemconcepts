import { useRef, useState, useEffect } from "react";
import VideoControls from "./Video/VideoControls";
import PlayerToolbar from "./PlayerToolbar";

export default function Video({ show, path, metadata, setMetadata, group = "", year = "", name = "", children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
    }, [ref.current]);
    return <>
        <video ref={ref} {...props}>
            {children}
        </video>
        {playerRef && <VideoControls
            playerRef={playerRef}
            metadata={metadata}
            setMetadata={setMetadata}
            group={group}
            year={year}
            name={name}
            path={path}
        />}
        {playerRef && <PlayerToolbar show={show} playerRef={playerRef} isVideo={true} />}
    </>;
}
