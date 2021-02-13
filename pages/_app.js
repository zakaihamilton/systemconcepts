import '@fontsource/roboto';
import '../src/scss/app.scss';
import { useEffect } from "react";

export default function App({ Component, pageProps }) {
    useEffect(() => {
        const jssStyles = document.querySelector('#jss-server-side');
        if (jssStyles) {
            jssStyles.parentElement.removeChild(jssStyles);
        }
    }, []);

    return <Component {...pageProps} />
}
