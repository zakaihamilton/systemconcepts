import Header from "./Header";
import Footer from "./Footer";
import Tabs from "./Tabs";
import Content from "./Page/Content";
import { useDeviceType } from "@util/styles";

export default function Page() {
    const isPhone = useDeviceType() === "phone";
    return <>
        <Header />
        {!isPhone && <Tabs />}
        <Content />
        <Footer />
        {isPhone && <Tabs />}
    </>;
}
