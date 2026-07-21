import React, { useCallback, useEffect, useMemo } from "react";

export function useTableScroll({ store, loading, resetScrollDeps }) {
	const listRef = React.useRef();
	const gridRef = React.useRef();
	const hasRestoredScrollRef = React.useRef(false);
	const lastResetDepsRef = React.useRef(resetScrollDeps);

	const { scrollOffset = 0 } = store.useState((s) => ({
		scrollOffset: s.scrollOffset,
	}));

	useEffect(() => {
		if (!loading && scrollOffset > 0 && !hasRestoredScrollRef.current) {
			const timer = setTimeout(() => {
				if (listRef.current) {
					listRef.current.scrollTo(scrollOffset);
				}
				if (gridRef.current) {
					gridRef.current.scrollTo({ scrollTop: scrollOffset });
				}
				hasRestoredScrollRef.current = true;
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [loading, scrollOffset]);

	useEffect(() => {
		const depsChanged =
			JSON.stringify(lastResetDepsRef.current) !==
			JSON.stringify(resetScrollDeps);
		lastResetDepsRef.current = resetScrollDeps;

		if (depsChanged && resetScrollDeps.length > 0 && !loading) {
			if (listRef.current) {
				listRef.current.scrollTo(0);
			}
			if (gridRef.current) {
				gridRef.current.scrollTo({ scrollTop: 0 });
			}
			store.update((s) => {
				s.scrollOffset = 0;
			});
			hasRestoredScrollRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...resetScrollDeps, loading]);

	const saveScrollPosition = useCallback(
		(offset) => {
			store.update((s) => {
				s.scrollOffset = offset;
			});
		},
		[store],
	);

	const debouncedSaveScroll = useMemo(() => {
		let timeoutId;
		return (offset) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => saveScrollPosition(offset), 300);
		};
	}, [saveScrollPosition]);

	const handleScrollState = useCallback(
		(offset) => {
			debouncedSaveScroll(offset);
		},
		[debouncedSaveScroll],
	);

	return {
		listRef,
		gridRef,
		scrollOffset,
		handleScrollState,
	};
}
