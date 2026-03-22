import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";

const FixedSizeList = forwardRef(({
    children: Component,
    className,
    height,
    width,
    itemCount,
    itemSize,
    itemData,
    layout = "vertical",
    onScroll,
    onItemsRendered,
    initialScrollOffset = 0,
    overscanCount = 2,
    outerRef: externalOuterRef,
    innerElementType: InnerElement = "div",
    style: externalStyle,
    ...props
}, ref) => {
    const isVertical = layout === "vertical";
    const [scrollOffset, setScrollOffset] = useState(initialScrollOffset);
    const internalOuterRef = useRef(null);
    const outerRef = externalOuterRef || internalOuterRef;

    useImperativeHandle(ref, () => ({
        scrollTo: (offset) => {
            if (outerRef.current) {
                if (isVertical) {
                    outerRef.current.scrollTop = offset;
                } else {
                    outerRef.current.scrollLeft = offset;
                }
            }
        },
        scrollToItem: (index, align = "auto") => {
            if (outerRef.current) {
                const offset = index * itemSize;
                const viewSize = isVertical ? height : width;
                const currentScroll = isVertical ? outerRef.current.scrollTop : outerRef.current.scrollLeft;

                let targetOffset = currentScroll;
                if (align === "start") {
                    targetOffset = offset;
                } else if (align === "end") {
                    targetOffset = offset - viewSize + itemSize;
                } else if (align === "center") {
                    targetOffset = offset - viewSize / 2 + itemSize / 2;
                } else {
                    // auto
                    if (offset < currentScroll) {
                        targetOffset = offset;
                    } else if (offset + itemSize > currentScroll + viewSize) {
                        targetOffset = offset - viewSize + itemSize;
                    }
                }

                if (isVertical) {
                    outerRef.current.scrollTop = targetOffset;
                } else {
                    outerRef.current.scrollLeft = targetOffset;
                }
            }
        }
    }));

    const handleScroll = useCallback((event) => {
        const offset = isVertical ? event.currentTarget.scrollTop : event.currentTarget.scrollLeft;
        setScrollOffset(offset);
        if (onScroll) {
            onScroll({ scrollOffset: offset, scrollUpdateWasRequested: false });
        }
    }, [isVertical, onScroll]);

    // Initial scroll offset
    useEffect(() => {
        if (initialScrollOffset !== 0 && outerRef.current) {
            if (isVertical) {
                outerRef.current.scrollTop = initialScrollOffset;
            } else {
                outerRef.current.scrollLeft = initialScrollOffset;
            }
        }
    }, [initialScrollOffset, isVertical]);

    const viewSize = isVertical ? height : width;
    
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemSize) - overscanCount);
    const stopIndex = Math.min(itemCount - 1, Math.ceil((scrollOffset + viewSize) / itemSize) + overscanCount);

    useEffect(() => {
        if (onItemsRendered) {
            onItemsRendered({
                visibleStartIndex: Math.floor(scrollOffset / itemSize),
                visibleStopIndex: Math.floor((scrollOffset + viewSize) / itemSize),
                overscanStartIndex: startIndex,
                overscanStopIndex: stopIndex
            });
        }
    }, [onItemsRendered, scrollOffset, itemSize, viewSize, startIndex, stopIndex]);

    const items = [];
    for (let i = startIndex; i <= stopIndex; i++) {
        const style = {
            position: "absolute",
            left: isVertical ? 0 : i * itemSize,
            top: isVertical ? i * itemSize : 0,
            width: isVertical ? "100%" : itemSize,
            height: isVertical ? itemSize : "100%"
        };
        items.push(
            <Component key={i} index={i} style={style} data={itemData} />
        );
    }

    const totalSize = itemCount * itemSize;

    const containerStyle = {
        position: "relative",
        height: isVertical ? totalSize : height,
        width: isVertical ? width : totalSize,
        pointerEvents: "auto"
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
                ...externalStyle
            }}
            {...props}
        >
            <InnerElement style={containerStyle}>
                {items}
            </InnerElement>
        </div>
    );
});

FixedSizeList.displayName = "FixedSizeList";

export default FixedSizeList;
