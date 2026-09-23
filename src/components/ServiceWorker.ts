"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
	useEffect(() => {
		if (
			process.env.NODE_ENV !== "production" ||
			!("serviceWorker" in navigator)
		)
			return;
		const register = () => {
			navigator.serviceWorker.register("/sw.js").catch(() => {});
		};
		// Defer until load so mobile browsers do not race IndexedDB on revisit.
		if (document.readyState === "complete") {
			register();
			return;
		}
		window.addEventListener("load", register);
		return () => window.removeEventListener("load", register);
	}, []);
	return null;
}
