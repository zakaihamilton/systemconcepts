import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowDownwardIcon from "@icons/svg/ArrowDownward.svg";
import ArrowUpwardIcon from "@icons/svg/ArrowUpward.svg";
import SearchIcon from "@icons/svg/Search.svg";
import InputBase from "@ui/InputBase";
import { createStore } from "@util/browser/store";
import { useDeviceType } from "@util/browser/styles";
import { useTimeout } from "@util/browser/timers";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Search.module.css";

registerToolbar("Search", 200);

export const SearchStore = createStore({
	search: {},
});

export function SearchWidget({
	isDesktop,
	placeholder,
	value,
	onChange,
	onEnter,
}: any) {
	const [focused, setFocused] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	// Update expanded class via DOM to avoid recreating the element
	useEffect(() => {
		if (containerRef.current) {
			if (isDesktop || focused) {
				containerRef.current.classList.add(styles.searchExpanded);
			} else {
				containerRef.current.classList.remove(styles.searchExpanded);
			}
		}
	}, [isDesktop, focused]);

	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	const handleClick = useCallback(() => {
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, []);

	const onKeyDown = useCallback(
		(event: any) => {
			if (event.keyCode === 13 && onEnter) {
				onEnter();
			}
		},
		[onEnter],
	);

	return (
		<div
			ref={containerRef}
			className={clsx(styles.search, isDesktop && styles.searchExpanded)}
			onClick={handleClick}
		>
			<div className={styles.searchIcon}>
				<SearchIcon />
			</div>
			<InputBase
				inputRef={inputRef}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				onKeyDown={onKeyDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
				type="search"
				classes={{
					root: styles.inputRoot,
				}}
				inputProps={{ "aria-label": "search" }}
			/>
		</div>
	);
}

export function useSearch(
	name: any,
	updateCallback?: ((value: string) => void) | null,
	visible = true,
	options: {
		prevMatch?: () => void;
		nextMatch?: () => void;
		prevName?: string;
		nextName?: string;
		matchesCount?: number;
		matchElement?: React.ReactNode;
		onEnter?: () => void;
		toolbarId?: string;
	} = {},
) {
	const {
		prevMatch,
		nextMatch,
		prevName,
		nextName,
		matchesCount = 0,
		matchElement,
		onEnter,
		toolbarId = "Search",
	} = options;
	const deviceType = useDeviceType();
	const isPhone = deviceType === "phone";
	const isDesktop = deviceType === "desktop";
	let effectiveName = name;
	let effectiveUpdateCallback = updateCallback;
	if (typeof effectiveName === "function") {
		effectiveUpdateCallback = effectiveName;
		effectiveName = "default";
	}
	effectiveName = effectiveName || "default";
	const { search } = SearchStore.useState();
	const searchTerm = search[effectiveName] || "";
	const [value, setValue] = useState(searchTerm);
	const translations = useTranslations();

	useEffect(() => {
		setValue(searchTerm);
	}, [searchTerm]);

	useTimeout(
		() => {
			SearchStore.update((s) => {
				s.search[effectiveName] = value;
			});
			effectiveUpdateCallback && effectiveUpdateCallback(value);
		},
		1000,
		[value],
	);

	const onChangeText = useCallback((event: any) => {
		setValue(event.target.value);
	}, []);

	// Wrap the search UI in a component so that we don't pass refs directly through the ToolbarStore.
	// This prevents Pullstate/Immer from freezing the ref objects.
	const searchElement = useMemo(
		() => (
			<SearchWidget
				isDesktop={isDesktop}
				placeholder={translations.SEARCH + "…"}
				value={value}
				onChange={onChangeText}
				onEnter={onEnter}
			/>
		),
		[isDesktop, value, onChangeText, translations.SEARCH, onEnter],
	);

	const toolbarItems = useMemo(
		() =>
			[
				{
					id: "search",
					menu: false,
					sortKey: -1,
					location: isPhone && "header",
					element: searchElement,
				},
				matchesCount > 0 &&
					prevMatch && {
						id: "prevMatch",
						name: prevName || translations.PREVIOUS_MATCH,
						icon: <ArrowUpwardIcon />,
						sortKey: -1,
						onClick: prevMatch,
						location: isPhone && "header",
					},
				matchesCount > 0 &&
					matchElement && {
						id: "matchElement",
						element: matchElement,
						location: isPhone && "header",
					},
				matchesCount > 0 &&
					nextMatch && {
						id: "nextMatch",
						name: nextName || translations.NEXT_MATCH,
						icon: <ArrowDownwardIcon />,
						sortKey: -1,
						onClick: nextMatch,
						location: isPhone && "header",
					},
			].filter(Boolean),
		[
			isPhone,
			searchElement,
			matchesCount,
			prevMatch,
			nextMatch,
			translations,
			matchElement,
			prevName,
			nextName,
		],
	);

	useToolbar({
		id: toolbarId,
		items: toolbarItems,
		visible,
		depends: [isPhone, deviceType, toolbarItems],
	});

	return searchTerm;
}
