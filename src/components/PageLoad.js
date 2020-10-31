import Progress from "@widgets/Progress";
import { useState } from "react";
import { useTimeout } from "@util/timers";

export default function PageLoad() {
    const [showProgress, setShowProgress] = useState(false);
    useTimeout(() => setShowProgress(true), 250, []);

    return <>
        {showProgress && <Progress />}
    </>;
}