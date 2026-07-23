import { useSync } from "@sync/sync";
import { useResize } from "@util/browser/size";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useLanguage } from "@util/domain/language";
import clsx from "clsx";
import { Store } from "pullstate";
import { useEffect, useLayoutEffect } from "react";
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

// Persist UI prefs only. The URL hash is the source of truth for navigation —
// restoring a stale hash from localStorage can clobber deep links like
// #library/id/<articleId> on startup.
export const MAIN_STORE_PERSISTED_FIELDS = [
	"fontSize",
	"direction",
	"language",
	"showSideBar",
	"showDrawer",
	"speedToolbar",
	"showLibrarySideBar",
	"libraryExpanded",
];

export const MainStore = new Store(MainStoreDefaults);

function syncHashFromWindow() {
	MainStore.update((s) => {
		s.hash = window.location.hash;
	});
}

export default function Main() {
	// Keep automatic sync alive independently of the currently open route.
	useSync({ schedule: true });
	const _counter = useResize();
	const language = useLanguage();
	const isMobile = useDeviceType() !== "desktop";
	const { direction, showSideBar, libraryExpanded } = MainStore.useState();
	useLocalStorage("MainStore", MainStore, MAIN_STORE_PERSISTED_FIELDS);

	// Read the URL hash before paint so deep links win over any transient store
	// state and the first painted route matches the address bar.
	useLayoutEffect(() => {
		syncHashFromWindow();
	}, []);

	useEffect(() => {
		syncHashFromWindow();
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
