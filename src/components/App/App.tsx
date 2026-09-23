import { NoSsr } from "@ui";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React from "react";
import Head from "../Head";
import Main from "../Main";
import Theme from "../Theme";

export class AppErrorBoundary extends React.Component<
	React.PropsWithChildren,
	{ failed: boolean }
> {
	declare state: { failed: boolean };

	constructor(props: any) {
		super(props);
		this.state = { failed: false };
	}

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch() {
		document.getElementById("app-splash")?.remove();
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div role="alert" style={{ padding: "1.5rem" }}>
				<p>The app failed to load after returning to this page.</p>
				<button type="button" onClick={() => window.location.reload()}>
					Reload
				</button>
			</div>
		);
	}
}

export default function App() {
	React.useEffect(() => {
		const removeSplash = () => document.getElementById("app-splash")?.remove();
		removeSplash();
		window.addEventListener("pageshow", removeSplash);
		document.addEventListener("resume", removeSplash);
		return () => {
			window.removeEventListener("pageshow", removeSplash);
			document.removeEventListener("resume", removeSplash);
		};
	}, []);

	return (
		<React.StrictMode>
			<SpeedInsights sampleRate={0.5} />
			<Analytics />
			<Head />
			<NoSsr>
				<AppErrorBoundary>
					<Theme>
						<Main />
					</Theme>
				</AppErrorBoundary>
			</NoSsr>
		</React.StrictMode>
	);
}
