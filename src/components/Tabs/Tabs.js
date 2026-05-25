import { MainStore } from "@components/Main";
import { useActivePages } from "@util/domain/views";
import TabsWidget from "@widgets/Tabs";
import { useCallback } from "react";
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

	const Container = useCallback(
		function Container({ children }) {
			const pageState = [hash, setHash];
			return (
				<div className={styles.root}>
					<TabsWidget state={pageState}>{children}</TabsWidget>
				</div>
			);
		},
		[hash, setHash],
	);

	if (!page) {
		return null;
	}
	const Tabs = page.tabs;

	return <Tabs Container={Container} />;
}
