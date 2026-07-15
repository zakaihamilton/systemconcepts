import { MainStore } from "@components/Main";
import { useDirection } from "@util/data/direction";
import { useEffect } from "react";
import useDarkMode from "use-dark-mode";

export default function Theme({ children }) {
	const direction = useDirection();
	const darkMode = useDarkMode(false);
	const { fontSize } = MainStore.useState((s) => ({
		fontSize: s.fontSize,
	}));

	useEffect(() => {
		document.body.style.fontSize = `${fontSize}px`;
	}, [fontSize]);

	useEffect(() => {
		document.documentElement.setAttribute(
			"data-theme",
			darkMode.value ? "dark" : "light",
		);
	}, [darkMode.value]);

	useEffect(() => {
		document.documentElement.setAttribute("dir", direction);
	}, [direction]);

	return children;
}
