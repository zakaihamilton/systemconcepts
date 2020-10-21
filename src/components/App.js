import Theme from "./Theme";
import Head from "./Head";
import Main from "./Main";

export default function App() {
    console.log("App");
    return <Theme>
        <Head />
        <Main />
    </Theme>;
}
