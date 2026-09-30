function getSessionListId(session: any) {
	return session?.id || session?.key;
}

export function collectSessionIds(sessions: any) {
	const ids = new Set<any>();
	for (const session of sessions) {
		const id = getSessionListId(session);
		if (id) {
			ids.add(id);
		}
	}
	return ids;
}

export function hasNewSessionId(previousIds: any, nextIds: any) {
	for (const id of nextIds) {
		if (!previousIds.has(id)) {
			return true;
		}
	}
	return false;
}

export function getSessionDateLocale() {
	if (typeof navigator === "undefined") {
		return undefined;
	}
	return navigator.languages?.[0] || navigator.language;
}
