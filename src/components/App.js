import Theme from "./Theme";
import Head from "./Head";
import Main from "./Main";

export default function App() {
    return <>
        <Head />
        <Theme>
            <Main />
        </Theme>
    </>;
}
