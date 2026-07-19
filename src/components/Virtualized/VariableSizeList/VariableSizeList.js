import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

const VariableSizeList = forwardRef(
	(
		{
			children: Component,
			className,
			itemCount,
			itemSize: getItemSize, // Function (index) => size
			height,
			width,
			itemData,
			onScroll,
			onItemsRendered,
			overscanCount = 2,
			outerRef: externalOuterRef,
			style: externalStyle,
			...props
		},
		ref,
	) => {
		const [scrollTop, setScrollTop] = useState(0);
		const [offsets, setOffsets] = useState([]);
		const [totalHeight, setTotalHeight] = useState(0);
		const internalOuterRef = useRef(null);
		const outerRef = externalOuterRef || internalOuterRef;

		const calculateOffsets = useCallback(() => {
			const newOffsets = new Array(itemCount);
			let currentOffset = 0;
			for (let i = 0; i < itemCount; i++) {
				newOffsets[i] = currentOffset;
				currentOffset += getItemSize(i);
			}
			setOffsets(newOffsets);
			setTotalHeight(currentOffset);
		}, [itemCount, getItemSize]);

		useEffect(() => {
			calculateOffsets();
		}, [calculateOffsets]);

		useImperativeHandle(ref, () => ({
			resetAfterIndex: (_index) => {
				// Simplified implementation: recalculate everything
				calculateOffsets();
			},
			scrollTo: (offset) => {
				if (outerRef.current) {
					const next = Math.max(0, offset);
					outerRef.current.scrollTop = next;
					setScrollTop(next);
				}
			},
			scrollToItem: (index, align = "auto") => {
				if (!outerRef.current || offsets[index] === undefined) return;

				const offset = offsets[index];
				const viewSize = height;
				const currentScroll = outerRef.current.scrollTop;
				const itemSize = getItemSize(index);
				const maxScroll = Math.max(0, totalHeight - viewSize);

				let targetOffset = currentScroll;
				if (align === "start") {
					targetOffset = offset;
				} else if (align === "end") {
					targetOffset = offset - viewSize + itemSize;
				} else if (align === "center") {
					targetOffset = offset - viewSize / 2 + itemSize / 2;
				} else if (offset < currentScroll) {
					targetOffset = offset;
				} else if (offset + itemSize > currentScroll + viewSize) {
					targetOffset = offset - viewSize + itemSize;
				}

				targetOffset = Math.max(0, Math.min(targetOffset, maxScroll));
				outerRef.current.scrollTop = targetOffset;
				setScrollTop(targetOffset);
			},
		}));

		const handleScroll = useCallback(
			(event) => {
				const top = event.currentTarget.scrollTop;
				setScrollTop(top);
				if (onScroll) {
					onScroll({ scrollOffset: top, scrollUpdateWasRequested: false });
				}
			},
			[onScroll],
		);

		// Find visible items
		// Since offsets are sorted, we could use binary search, but for small-medium lists linear search is fine.
		// Let's use binary search for better performance on large lists.
		const findIndex = (offset) => {
			let low = 0;
			let high = offsets.length - 1;
			while (low <= high) {
				const mid = Math.floor((low + high) / 2);
				const val = offsets[mid];
				if (
					val <= offset &&
					(offsets[mid + 1] === undefined || offsets[mid + 1] > offset)
				) {
					return mid;
				}
				if (val < offset) {
					low = mid + 1;
				} else {
					high = mid - 1;
				}
			}
			return 0;
		};

		const visibleStartIndex = findIndex(scrollTop);
		const visibleStopIndex = Math.min(
			itemCount - 1,
			findIndex(scrollTop + height),
		);
		const startIndex = Math.max(0, visibleStartIndex - overscanCount);
		const stopIndex = Math.min(itemCount - 1, visibleStopIndex + overscanCount);

		useEffect(() => {
			if (onItemsRendered) {
				onItemsRendered({
					visibleStartIndex,
					visibleStopIndex,
					overscanStartIndex: startIndex,
					overscanStopIndex: stopIndex,
				});
			}
		}, [
			onItemsRendered,
			visibleStartIndex,
			visibleStopIndex,
			startIndex,
			stopIndex,
		]);

		const items = [];
		for (let i = startIndex; i <= stopIndex; i++) {
			const size = getItemSize(i);
			const style = {
				position: "absolute",
				left: 0,
				top: offsets[i],
				width: "100%",
				height: size,
			};
			items.push(<Component key={i} index={i} style={style} data={itemData} />);
		}

		const containerStyle = {
			position: "relative",
			height: totalHeight,
			width: "100%",
			pointerEvents: "auto",
		};

		return (
			<div
				ref={outerRef}
				onScroll={handleScroll}
				className={className}
				style={{
					position: "relative",
					height,
					width,
					overflow: "auto",
					WebkitOverflowScrolling: "touch",
					willChange: "transform",
					...externalStyle,
				}}
				{...props}
			>
				<div style={containerStyle}>{items}</div>
			</div>
		);
	},
);

VariableSizeList.displayName = "VariableSizeList";

export default VariableSizeList;
