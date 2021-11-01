import "@fontsource/roboto";
import "../src/scss/app.scss";
import { useEffect } from "react";
import Script from "next/script";

export default function App({ Component, pageProps }) {
    useEffect(() => {
        const jssStyles = document.querySelector("#jss-server-side");
        if (jssStyles) {
            jssStyles.parentElement.removeChild(jssStyles);
        }
    }, []);

    return <>
        <Script src="noflash.js" />
        <Component {...pageProps} />
    </>;
}
