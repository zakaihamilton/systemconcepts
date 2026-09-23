import React, { useCallback, useEffect, useMemo } from "react";

export function useTableScroll({ store, loading, resetScrollDeps }: any) {
	const listRef = React.useRef<any>(null);
	const gridRef = React.useRef<any>(null);
	const hasRestoredScrollRef = React.useRef(false);
	const lastResetDepsRef = React.useRef(resetScrollDeps);

	const { scrollOffset = 0 } = store.useState((s: any) => ({
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
			store.update((s: any) => {
				s.scrollOffset = 0;
			});
			hasRestoredScrollRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...resetScrollDeps, loading]);

	const saveScrollPosition = useCallback(
		(offset: any) => {
			store.update((s: any) => {
				s.scrollOffset = offset;
			});
		},
		[store],
	);

	const debouncedSaveScroll: any = useMemo(() => {
		let timeoutId: any;
		return (offset: any) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => saveScrollPosition(offset), 300);
		};
	}, [saveScrollPosition]);

	const handleScrollState = useCallback(
		(offset: any) => {
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
