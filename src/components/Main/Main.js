import { useSync } from "@sync/sync";
import { useResize } from "@util/browser/size";
import { useLocalStorage } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useLanguage } from "@util/domain/language";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef } from "react";
import Bookmarks from "../Bookmarks";
import Head from "../Head";
import Page from "../Page";
import SideBar from "../SideBar";
import Sync from "../Sync";
import Title from "../Title";
import styles from "./Main.module.css";

import { MAIN_STORE_PERSISTED_FIELDS, MainStore } from "./MainStore";

function syncHashFromWindow() {
	MainStore.update((s) => {
		s.hash = window.location.hash;
	});
}

function openedOnSyncPage() {
	if (typeof window === "undefined") return false;
	return window.location.hash.replace(/^#/, "").split("/")[0] === "sync";
}

export default function Main() {
	const openedOnSyncPageRef = useRef(openedOnSyncPage());
	// Opening Sync is an explicit, manual workflow. Do not start a normal sync
	// against an existing local database before the user can choose Full Sync.
	useSync({ schedule: !openedOnSyncPageRef.current });
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
