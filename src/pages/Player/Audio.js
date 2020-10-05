import { useRef } from "react";
import AudioControls from "./Audio/AudioControls";

export default function Audio({ metadata, setMetadata, group = "", year = "", name = "", children, ...props }) {
    const ref = useRef();
    return <>
        <audio ref={ref} {...props}>
            {children}
        </audio>
        {ref && ref.current && <AudioControls
            playerRef={ref.current}
            metadata={metadata}
            setMetadata={setMetadata}
            group={group}
            year={year}
            name={name}
        />}
    </>;
}
