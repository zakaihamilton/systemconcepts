import MoreVertIcon from "@icons/svg/MoreVert.svg";
import { Store } from "pullstate";
export const ToolbarStore = new Store({
	sections: [],
});

const toolbarItemsRegistry = new Map();

export function clearToolbarItemsRegistry() {
	toolbarItemsRegistry.clear();
}

function setToolbarItems(id, items, visible) {
	toolbarItemsRegistry.set(id, items);
	ToolbarStore.update((s) => {
		const section = s.sections.find((item) => item.id === id);
		if (section) {
			section.visible = visible;
			section.itemsRevision = (section.itemsRevision || 0) + 1;
		}
	});
}

export function registerToolbar(id, sortKey) {
	ToolbarStore.update((s) => {
		if (!s.sections.find((item) => item.id === id)) {
			s.sections = [
				...s.sections,
				{ items: [], used: 0, visible: true, id, sortKey, itemsRevision: 0 },
			];
		}
	});
}

import { Divider } from "@ui";
import IconButton from "@ui/IconButton";
import { useDeviceType } from "@util/browser/styles";
import Tooltip from "@widgets/Tooltip";

// useTranslations is imported via require to break circular dependency
const useTranslations = () => {
	const {
		useTranslations: useTranslationsHook,
	} = require("@util/domain/translations");
	return useTranslationsHook();
};

import Menu from "@widgets/Menu";
import clsx from "clsx";
import { useEffect, useState } from "react";
import Item from "./Item";
import styles from "./Toolbar.module.css";
import { ToolbarTooltipContext } from "./ToolbarContext";

export function useToolbar({ id, items, visible = true, depends = [] }) {
	useEffect(() => {
		ToolbarStore.update((s) => {
			const section = s.sections.find((item) => item.id === id);
			if (section) {
				section.used++;
				section.visible = visible;
			}
		});
		setToolbarItems(id, items, visible);
		return () => {
			ToolbarStore.update((s) => {
				const section = s.sections.find((item) => item.id === id);
				if (section) {
					section.used--;
				}
			});
			toolbarItemsRegistry.delete(id);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => {
		setToolbarItems(id, items, visible);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...depends, visible]);
}

export function useToolbarItems({ location }) {
	const { sections } = ToolbarStore.useState();

	let toolbars = sections.filter((section) => section.used && section.visible);

	toolbars.sort((a, b) => {
		const aKey = a.sortKey || 0;
		const bKey = b.sortKey || 0;
		return aKey - bKey;
	});

	let sectionItems = toolbars
		.map((section) =>
			(toolbarItemsRegistry.get(section.id) || [])
				.filter((item) => item && item.id)
				.map((item, idx, list) => {
					item = { ...item };
					if (idx === list.length - 1) {
						item.divider = true;
					}
					return item;
				}),
		)
		.flat();
	sectionItems = sectionItems.filter((item) => {
		if (!item) {
			return false;
		}
		if (Array.isArray(location)) {
			return (
				location.includes(item.location) ||
				(!item.location && location.includes(undefined))
			);
		}
		return item.location === location || (!location && !item.location);
	});

	sectionItems.sort((a, b) => {
		const aKey = a.sortKey || 0;
		const bKey = b.sortKey || 0;
		return aKey - bKey;
	});

	return sectionItems;
}

function isDirectToolbarItem(item, isDesktop, collapsable) {
	if (item.items?.length || item.element) {
		return true;
	}
	const { menu } = item;
	if (typeof menu === "undefined") {
		return isDesktop || !collapsable;
	}
	return !menu;
}

function isOverflowMenuItem(item, isDesktop, collapsable) {
	if (item.items?.length || item.element) {
		return false;
	}
	const { menu } = item;
	if (typeof menu === "undefined") {
		return !isDesktop && collapsable;
	}
	return menu;
}

function getTooltipPlacement(location) {
	if (location === "footer" || location === "mobile") {
		return "top";
	}
	return "bottom";
}

export default function Toolbar({
	className,
	location,
	dividerBefore,
	dividerAfter,
	collapsable,
}) {
	const isDesktop = useDeviceType() === "desktop";
	const translations = useTranslations();
	const sectionItems = useToolbarItems({ location });
	const toolbarItems = sectionItems.filter((item) =>
		isDirectToolbarItem(item, isDesktop, collapsable),
	);
	const menuItems = sectionItems.filter((item) =>
		isOverflowMenuItem(item, isDesktop, collapsable),
	);
	const { MainStore } = require("@components/Main");
	const { hash } = MainStore.useState();

	const toolbarVisible = !!toolbarItems.length || !!menuItems.length;
	const tooltipPlacement = getTooltipPlacement(location);
	const [menuAnchorEl, setMenuAnchorEl] = useState(null);

	useEffect(() => {
		setMenuAnchorEl(null);
	}, [hash]);

	if (!toolbarVisible) {
		return null;
	}

	return (
		<ToolbarTooltipContext.Provider value={tooltipPlacement}>
			<div
				className={clsx(
					styles.toolbar,
					toolbarVisible && styles.visible,
					className,
				)}
			>
				{!!dividerBefore && !!(toolbarVisible || menuItems.length) && (
					<Divider
						classes={{ root: styles.divider }}
						orientation="vertical"
						flexItem
					/>
				)}
				{toolbarItems.map((item, idx) => (
					<Item
						key={item.id}
						item={item}
						idx={idx}
						count={toolbarItems.length}
						tooltipPlacement={tooltipPlacement}
					/>
				))}
				{!!menuItems.length && (
					<>
						{!!toolbarItems.length && (
							<Divider
								classes={{ root: styles.divider }}
								orientation="vertical"
								flexItem
							/>
						)}
						{menuItems.length === 1 ? (
							<Item
								key={menuItems[0].id}
								item={menuItems[0]}
								idx={0}
								count={1}
								tooltipPlacement={tooltipPlacement}
							/>
						) : (
							<>
								<Tooltip
									arrow
									title={translations.MENU}
									placement={tooltipPlacement}
								>
									<IconButton
										className={styles.menuButton}
										size="small"
										aria-label={translations.MENU}
										aria-haspopup="true"
										aria-expanded={Boolean(menuAnchorEl)}
										onClick={(event) => {
											event.stopPropagation();
											setMenuAnchorEl(event.currentTarget);
										}}
									>
										<MoreVertIcon />
									</IconButton>
								</Tooltip>
								<Menu
									items={menuItems}
									open={Boolean(menuAnchorEl)}
									anchorEl={menuAnchorEl}
									onClose={() => setMenuAnchorEl(null)}
								/>
							</>
						)}
					</>
				)}
				{!!dividerAfter && !!(toolbarVisible || menuItems.length) && (
					<Divider
						classes={{ root: styles.divider }}
						orientation="vertical"
						flexItem
					/>
				)}
			</div>
		</ToolbarTooltipContext.Provider>
	);
}
