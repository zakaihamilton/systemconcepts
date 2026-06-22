import CssBaseline from "@mui/material/CssBaseline";
import { useResize } from "@util/browser/size";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useLanguage } from "@util/domain/language";
import clsx from "clsx";
import { Store } from "pullstate";
import { useEffect } from "react";
import Bookmarks from "../Bookmarks";
import Head from "../Head";
import Page from "../Page";
import SideBar from "../SideBar";
import Sync from "../Sync";
import Title from "../Title";
import styles from "./Main.module.css";

export const MainStoreDefaults = {
	fontSize: "16",
	direction: "ltr",
	language: "auto",
	showSideBar: true,
	showDrawer: false,
	speedToolbar: "top",
	showLibrarySideBar: true,
	libraryExpanded: false,
};

export const MainStore = new Store(MainStoreDefaults);

export default function Main() {
	const _counter = useResize();
	const language = useLanguage();
	const isMobile = useDeviceType() !== "desktop";
	const { direction, showSideBar, libraryExpanded } = MainStore.useState();
	useLocalStorage("MainStore", MainStore);

	useEffect(() => {
		MainStore.update((s) => {
			s.hash = window.location.hash;
		});
		window.onhashchange = function () {
			MainStore.update((s) => {
				if (s.hash !== window.location.hash) {
					s.hash = window.location.hash;
				}
			});
		};
		return () => {
			window.onhashchange = null;
		};
	}, []);

	useEffect(() => {
		MainStore.update((s) => {
			s.direction = language === "heb" ? "rtl" : "ltr";
			document.getElementsByTagName("html")[0].setAttribute("dir", s.direction);
		});
	}, [language]);

	const className = clsx(
		styles.root,
		showSideBar && !isMobile && styles.sidebar,
		isMobile && styles.mobile,
		direction === "rtl" && styles.rtl,
		libraryExpanded && styles.libraryExpanded,
	);

	return (
		<>
			<Head />
			<CssBaseline />
			<div className={className}>
				<Title />
				<Sync>
					<Bookmarks />
					<SideBar />
					<div className={clsx(styles.main, isMobile && styles.mobile)}>
						<Page />
					</div>
				</Sync>
			</div>
		</>
	);
}
