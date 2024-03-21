import React from "react";
import Theme from "./Theme";
import Head from "./Head";
import Main from "./Main";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
    return <React.StrictMode>
        <SpeedInsights />
        <Analytics />
        <Head />
        <Theme>
            <Main />
        </Theme>
    </React.StrictMode>;
}
