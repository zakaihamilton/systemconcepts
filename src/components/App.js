import React from "react";
import Theme from "./Theme";
import Head from "./Head";
import Main from "./Main";

export default function App() {
    return <>
        <React.StrictMode>
            <Head />
            <Theme>
                <Main />
            </Theme>
        </React.StrictMode>
    </>;
}
