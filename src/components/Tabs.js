import { useCallback } from "react";
import TabsWidget from "@widgets/Tabs";
import styles from "./Tabs.module.scss";
import { useActivePages } from "@util/pages";
import { MainStore } from "@components/Main";

export default function Tabs() {
    const setHash = useCallback(hash => {
        MainStore.update(s => {
            s.hash = hash;
        });
        window.location.hash = hash;
    }, []);
    const { hash } = MainStore.useState();
    const pageState = [hash, setHash];
    const activePages = useActivePages();
    const page = activePages.reverse().find(page => page.tabs);

    const Container = useCallback(function Container({ children }) {
        return <TabsWidget state={pageState}>
            {children}
        </TabsWidget>;
    });

    if (!page) {
        return null;
    }
    const Tabs = page.tabs;

    return <div className={styles.root}>
        <Tabs Container={Container} />
    </div>;
}
