"use client";

import { useEffect, useRef } from "react";
import { useVisitoring } from "visitoring";

function getCurrentScreen() {
	const hash = window.location.hash.replace(/^#/, "");
	const screen = hash.split(/[/?]/, 1)[0];
	return screen || "home";
}

export default function VisitoringRouteTracker() {
	const { track } = useVisitoring();
	const lastScreen = useRef<string | null>(null);

	useEffect(() => {
		const trackScreenView = () => {
			const screen = getCurrentScreen();
			if (screen === lastScreen.current) return;
			lastScreen.current = screen;
			track("screen_view", { screen });
		};

		trackScreenView();
		window.addEventListener("hashchange", trackScreenView);
		return () => window.removeEventListener("hashchange", trackScreenView);
	}, [track]);

	return null;
}
