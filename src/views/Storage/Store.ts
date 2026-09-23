import { createStore } from "@util/browser/store";

export const StorageStoreDefaults = {
	mode: "",
	type: "",
	name: "",
	placeholder: "",
	icon: null,
	tooltip: null,
	editing: false,
	select: null,
	counter: 1,
	onDone: null,
	onValidate: null,
	item: null,
	destination: "",
	order: "desc",
	offset: 0,
	orderBy: "",
	scrollOffset: 0,
};

export const StorageStore = createStore({
	viewMode: "list",
	...StorageStoreDefaults,
});
