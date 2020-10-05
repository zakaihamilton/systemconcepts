import { useRef, useState, useEffect } from "react";
import AudioControls from "./Audio/AudioControls";

export default function Audio({ path, metadata, setMetadata, group = "", year = "", name = "", children, ...props }) {
    const ref = useRef();
    const [playerRef, setPlayerRef] = useState(null);
    useEffect(() => {
        setPlayerRef(ref.current);
    }, [ref.current]);
    return <>
        <audio ref={ref} {...props}>
            {children}
        </audio>
        {ref && ref.current && <AudioControls
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
