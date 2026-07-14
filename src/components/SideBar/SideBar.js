import { useBookmarks } from "@components/Bookmarks";
import BookmarkIcon from "@icons/svg/Bookmark.svg";
import LibraryBooksIcon from "@icons/svg/LibraryBooks.svg";
import Drawer from "@ui/Drawer";
import LinearProgress from "@ui/LinearProgress";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { setHash, useActivePages, usePages } from "@util/domain/views";
import ResearchIndexer from "@views/ResearchIndexer/ResearchIndexer";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import List from "@widgets/List";
import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import { MainStore } from "../Main";
import LibraryTree from "./LibraryTree";
import QuickAccess from "./QuickAccess";
import styles from "./SideBar.module.css";
export default function SideBar() {
	const translations = useTranslations();
	const isMobile = useDeviceType() !== "desktop";
	const { direction, showSlider, hash, libraryExpanded } = MainStore.useState();
	const bookmarks = useBookmarks();
	const activePages = useActivePages();
	const pages = usePages("sidebar");
	const isLibraryActive = !!activePages.find(
		(page) => page.id === "library" && page.custom,
	);
	const { indexing, progress } = ResearchStore.useState();

	// Auto-expand library when navigating to a library page
	useEffect(() => {
		if (isLibraryActive && !libraryExpanded) {
			MainStore.update((s) => {
				s.libraryExpanded = true;
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLibraryActive]);

	const selected = (id) => {
		return !!activePages.find((page) => page.id === id && !page.sectionIndex);
	};
	const setSelected = useCallback(
		(id) => {
			const page = pages.find((page) => page.id === id);
			if (page) {
				setHash(page.path || page.id);
			} else {
				MainStore.update((s) => {
					s.hash = id;
				});
				window.location.hash = id;
			}
		},
		[pages],
	);
	const state = [selected, setSelected];

	const closeDrawer = () => {
		MainStore.update((s) => {
			if (isMobile) {
				s.showSlider = false;
			} else {
				s.showDrawer = false;
			}
		});
	};

	const sidebarPages = pages.filter((page) => page.sidebar && !page.category);

	// Separate Library from other apps
	const apps = sidebarPages.filter(
		(page) => page.apps && page.id !== "library",
	);
	const library = sidebarPages.find((page) => page.id === "library");
	const other = sidebarPages.filter((page) => !page.apps);

	const items = [
		...apps.map((item, _index) => ({
			...item,
			divider: false,
		})),
	]
		.map((item) => {
			let target = item.path || item.id;
			if (item.id === "account") {
				const currentPath =
					hash && (hash.startsWith("#") ? hash.substring(1) : hash);
				if (
					currentPath &&
					!currentPath.startsWith("account") &&
					!currentPath.startsWith("signup") &&
					!currentPath.startsWith("signin")
				) {
					target += "?redirect=" + encodeURIComponent(currentPath);
				}
			}
			return { ...item, target };
		})
		.map((item) => {
			if (item.id === "research" && indexing) {
				return {
					...item,
					description: (
						<LinearProgress variant="determinate" value={progress} />
					),
				};
			}
			return item;
		});

	const otherItems = other.map((item) => {
		let target = item.path || item.id;
		if (item.id === "account") {
			const currentPath =
				hash && (hash.startsWith("#") ? hash.substring(1) : hash);
			if (
				currentPath &&
				!currentPath.startsWith("account") &&
				!currentPath.startsWith("signup") &&
				!currentPath.startsWith("signin")
			) {
				target += "?redirect=" + encodeURIComponent(currentPath);
			}
		}
		return { ...item, target };
	});

	if (bookmarks && bookmarks.length) {
		otherItems.push({
			id: "bookmarks",
			name: translations.BOOKMARKS,
			icon: <BookmarkIcon />,
			items: [
				...pages
					.filter((page) => page.sidebar && page.category === "bookmarks")
					.map((item) => {
						return { ...item, target: item.path || item.id };
					}),
				...bookmarks,
			],
			divider: true,
		});
	}

	const handleLibraryClick = (isOpen) => {
		MainStore.update((s) => {
			s.libraryExpanded = isOpen;
		});
	};

	const libraryItem = {
		id: "library",
		name: library?.name
			? translations[library.name] || library.name
			: translations.LIBRARY || "Library",
		icon: <LibraryBooksIcon />,
		isOpen: libraryExpanded,
		onToggle: handleLibraryClick,
		content: <LibraryTree closeDrawer={closeDrawer} isMobile={isMobile} />,
		selected: isLibraryActive && !libraryExpanded, // Maintain selection logic
		divider: true,
	};

	const mergedItems = [...items, libraryItem, ...otherItems];

	// Must declare all hooks before any conditional returns
	const rootRef = useRef(null);

	if (isMobile) {
		return (
			<Drawer
				anchor="left"
				open={showSlider}
				className={styles.mobileDrawer}
				onClose={closeDrawer}
			>
				<List onClick={closeDrawer} items={mergedItems} state={state} />
				<QuickAccess closeDrawer={closeDrawer} state={state} />
			</Drawer>
		);
	}

	const scrollToBottom = () => {
		if (rootRef.current) {
			setTimeout(() => {
				rootRef.current.scrollTo({
					top: rootRef.current.scrollHeight,
					behavior: "smooth",
				});
			}, 300);
		}
	};

	return (
		<div
			ref={rootRef}
			className={clsx(styles.root, direction === "rtl" && styles.rtl)}
		>
			<div className={styles.container}>
				<List items={mergedItems} state={state} />
				<QuickAccess
					closeDrawer={closeDrawer}
					state={state}
					onScrollToBottom={scrollToBottom}
				/>
				<ResearchIndexer />
			</div>
		</div>
	);
}
