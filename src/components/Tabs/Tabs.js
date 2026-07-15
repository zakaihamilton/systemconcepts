import { MainStore } from "@components/Main";
import { useActivePages } from "@util/domain/views";
import TabsWidget from "@widgets/Tabs";
import { useCallback, useRef } from "react";
import styles from "./Tabs.module.css";

export default function Tabs() {
	const setHash = useCallback((hash) => {
		MainStore.update((s) => {
			s.hash = hash;
		});
		window.location.hash = hash;
	}, []);
	const { hash } = MainStore.useState();
	const activePages = useActivePages();
	const page = [...activePages].reverse().find((page) => page.tabs);
	const tabStateRef = useRef([hash, setHash]);
	tabStateRef.current = [hash, setHash];

	const Container = useCallback(function Container({ children }) {
		return (
			<div className={styles.root}>
				<TabsWidget state={tabStateRef.current}>{children}</TabsWidget>
			</div>
		);
	}, []);

	if (!page) {
		return null;
	}
	const Tabs = page.tabs;

	return <Tabs Container={Container} />;
}
