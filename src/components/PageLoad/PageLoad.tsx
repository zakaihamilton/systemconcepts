import { useTimeout } from "@util/browser/timers";
import Progress from "@widgets/Progress";
import { useState } from "react";

export default function PageLoad() {
	const [showProgress, setShowProgress] = useState(false);
	useTimeout(() => setShowProgress(true), 250, []);

	return <>{showProgress && <Progress />}</>;
}
