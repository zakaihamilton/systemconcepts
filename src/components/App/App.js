import { NoSsr } from "@ui";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React from "react";
import Head from "../Head";
import Main from "../Main";
import Theme from "../Theme";

export default function App() {
	return (
		<React.StrictMode>
			<SpeedInsights />
			<Analytics />
			<Head />
			<NoSsr>
				<Theme>
					<Main />
				</Theme>
			</NoSsr>
		</React.StrictMode>
	);
}
