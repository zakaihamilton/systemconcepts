import React from "react";
import Theme from "./Theme";
import Head from "./Head";
import Main from "./Main";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function App() {
    return <React.StrictMode>
        <SpeedInsights />
        <Head />
        <Theme>
            <Main />
        </Theme>
    </React.StrictMode>;
}
