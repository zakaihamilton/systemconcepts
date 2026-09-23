import { MainStore } from "@components/Main/MainStore";
import { useLanguage } from "@util/domain/language";
import { useTranslations } from "@util/domain/translations";
import { useMemo } from "react";

function decodeHashSegment(item: any) {
	try {
		return decodeURIComponent(item);
	} catch {
		return item;
	}
}

export function usePathItems() {
	let { hash = "" } = MainStore.useState();
	const items = useMemo(() => {
		let h = hash;
		if (h && h.startsWith("#")) {
			h = h.substring(1);
		}
		return (h || "")
			.split("/")
			.filter(Boolean)
			.map((item: any) => decodeHashSegment(item));
	}, [hash]);
	return items;
}

export function toPath(...path: unknown[]) {
	const hash = path
		.map((item) => encodeURIComponent(String(item)).replace(/%3A/g, ":"))
		.join("/");
	return hash;
}

export function addPath(...path: unknown[]) {
	const hash =
		window.location.hash +
		"/" +
		path
			.map((item) => encodeURIComponent(String(item)).replace(/%3A/g, ":"))
			.join("/");
	setHash(hash);
}

export function setHash(hash: any) {
	MainStore.update((s) => {
		s.hash = hash;
	});
	window.location.hash = hash;
}

export function setPath(...path: unknown[]) {
	let hash = path
		.map((item) => {
			let segment = String(item);
			if (segment.startsWith("#")) {
				segment = segment.substring(1);
			}
			return encodeURIComponent(segment).replace(/%3A/g, ":");
		})
		.join("/");
	setHash(hash);
}

export function replacePath(...path: unknown[]) {
	let hash = window.location.hash;
	if (hash.startsWith("#")) {
		hash = hash.substring(1);
	}
	hash = hash.split("/").filter(Boolean).slice(0, -1).join("/");
	hash +=
		"/" +
		path
			.map((item) => encodeURIComponent(String(item)).replace(/%3A/g, ":"))
			.join("/");
	setHash(hash);
}

export function goBackPage() {
	let hash = window.location.hash;
	if (hash.startsWith("#")) {
		hash = hash.substring(1);
	}
	hash = hash.split("/").filter(Boolean).slice(0, -1).join("/");
	setHash(hash);
}

export function urlToParentPath(url: any) {
	const items = url.split("/").filter(Boolean);
	const previousItem = items[items.length - 2] || "";
	return decodeHashSegment(previousItem);
}

export function useParentPath(index = 0) {
	const { hash = "" } = MainStore.useState();
	const items = (hash || "").split("/").filter(Boolean);
	const previousItem = items[items.length - 2 - index] || "";
	return decodeHashSegment(previousItem);
}

export function useParentParams(index = 0) {
	const path = useParentPath(index);
	const [, query] = path.split("?");
	const params = Object.fromEntries(new URLSearchParams(query));
	return params;
}

export function getPagesFromHash({ hash, translations, pages }: any) {
	let results: any = [];
	hash = typeof hash === "string" ? hash : "";
	if (hash.startsWith("#")) {
		hash = hash.substring(1);
	}
	const items = hash.split("/").filter(Boolean);
	const root = pages.find((page: any) => page.root);
	if (root) {
		if (items[0] && items[0].startsWith("?")) {
			items[0] = root.id + items[0];
		} else if (!items[0] || !items[0].startsWith(root.id)) {
			items.unshift(root.id);
		}
	}
	let path = "";
	items.forEach((item: any) => {
		item = decodeHashSegment(item);
		const sections = item.split("/");
		let sectionPath = "";
		const pageId = (sections[0] || "").split("?")[0];
		let subPath = "";
		sections.map((section: any, sectionIndex: any) => {
			const [sectionId, query] = section.split("?");
			if (path) {
				path += "/";
			}
			if (sectionIndex) {
				if (sectionPath) {
					sectionPath += "/";
				}
				sectionPath += sectionId;
				subPath += "/";
			}
			subPath += section;
			const previousPage: any = results[results.length - 1];
			let page = null;
			const isContained = previousPage && previousPage.contained;
			let isAllowed = false;
			const baseSectionId = sectionId.split("?")[0];
			if (Array.isArray(isContained)) {
				isAllowed = isContained.includes(baseSectionId);
			}

			if (isContained && !isAllowed) {
				page = { ...previousPage };
				const prefix = previousPage.path ? previousPage.path + "/" : "";
				sectionPath = prefix + sectionId;
			} else if (isContained && isAllowed) {
				page = pages.find((page: any) => page.id === baseSectionId);
			} else {
				page = pages.find((page: any) => {
					const matchId = path + subPath;
					if (!page.custom) {
						return page.id === matchId;
					}
					const match = matchId.match(page.id);
					return match;
				});
				if (!page) {
					page = pages.find((page: any) => page.id === pageId);
				}
			}
			if (!page) {
				return null;
			}
			let params: Record<string, any> = {};
			if (query) {
				params = Object.fromEntries(new URLSearchParams(query));
			}
			if (page.root) {
				subPath = subPath.substring(pageId.length);
			}
			if (isAllowed && params.name) {
				const prefix = previousPage.path ? previousPage.path + "/" : "";
				sectionPath = prefix + params.name;
				page.useParentName = 1;
			}
			const url =
				(page.section ? null : page.path) || path + encodeURIComponent(subPath);
			const name = page.name;
			page = Object.assign({}, page, params);
			if (typeof page.section === "function") {
				const result = page.section({
					sectionIndex,
					id: sectionId,
					translations,
					path: sectionPath,
					...params,
				});
				if (!result) {
					return null;
				}
				page = Object.assign({}, page, result);
			}
			const parentPath = urlToParentPath(url);
			const result = {
				...page,
				url,
				path: sectionPath,
				sectionIndex,
				subPath,
				parentPath,
			};
			if (name !== result.name && !result.tooltip) {
				result.tooltip = name;
			}
			results.push(result);
		});
		if (subPath) {
			path += encodeURIComponent(subPath);
		}
	});
	return results;
}

export function useActivePages(depends: unknown[] = []) {
	let { hash = "" } = MainStore.useState();
	const translations = useTranslations();
	const pages = usePages();
	const dependsHash = (depends || []).join(",");
	const activePages = useMemo(() => {
		return getPagesFromHash({ hash, translations, pages });
	}, [hash, translations, pages, dependsHash]); // eslint-disable-line react-hooks/exhaustive-deps
	return activePages;
}

export function usePages(modeId?: string) {
	const translations = useTranslations();
	const language = useLanguage();
	const pageList = require("@data/views").default;
	const pages = useMemo(() => {
		const mapText = (text: any) => {
			if (typeof text === "object") {
				text = text[language];
			} else if (typeof text === "string") {
				text = translations[text] || text;
			}
			return text;
		};
		return pageList
			.filter((page: any) => {
				let visible = page.visible;
				if (typeof visible === "function") {
					visible = visible(page);
				}
				if (typeof visible === "undefined") {
					visible = true;
				}
				return visible;
			})
			.map((page: any) => {
				let { name, label, tooltip, ...props } = page;
				let { Icon } = page;
				if (modeId) {
					Icon = (page[modeId] && page[modeId].Icon) || Icon;
					name = (page[modeId] && page[modeId].name) || name;
					label = (page[modeId] && page[modeId].label) || label;
				}
				return {
					...props,
					icon: !!Icon && <Icon />,
					name: mapText(name),
					label: mapText(label),
					tooltip: mapText(tooltip),
				};
			});
	}, [translations, language, modeId]);
	return pages;
}

export function useCurrentPage() {
	const pages = useActivePages();
	const activePage = pages[pages.length - 1];
	const page = pages[pages.length - 1 - (activePage.useParentName || 0)];
	return page;
}

export function useCurrentPageTitle() {
	const page = useCurrentPage();
	if (page && !page.root) {
		return page.label || page.name;
	}
	return "";
}

export function reloadPage() {
	window.location.reload();
}

export function getOrigin() {
	return window.location.origin;
}
