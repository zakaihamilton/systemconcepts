import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from "react";

const FixedSizeGrid = forwardRef(({
    children: Component,
    className,
    columnCount,
    columnWidth,
    rowCount,
    rowHeight,
    height,
    width,
    itemData,
    onScroll,
    initialScrollTop = 0,
    overscanRowCount = 1,
    overscanColumnCount = 0,
    style: externalStyle,
    ...props
}, ref) => {
    const [scrollTop, setScrollTop] = useState(initialScrollTop);
    const [scrollLeft, setScrollLeft] = useState(0);
    const outerRef = useRef(null);

    useImperativeHandle(ref, () => ({
        scrollTo: ({ scrollLeft: left, scrollTop: top }) => {
            if (outerRef.current) {
                if (typeof left === "number") outerRef.current.scrollLeft = left;
                if (typeof top === "number") outerRef.current.scrollTop = top;
            }
        }
    }));

    const handleScroll = useCallback((event) => {
        const { scrollTop: top, scrollLeft: left } = event.currentTarget;
        setScrollTop(top);
        setScrollLeft(left);
        if (onScroll) {
            onScroll({ scrollTop: top, scrollLeft: left, scrollUpdateWasRequested: false });
        }
    }, [onScroll]);

    // Initial scroll top
    useEffect(() => {
        if (initialScrollTop !== 0 && outerRef.current) {
            outerRef.current.scrollTop = initialScrollTop;
        }
    }, [initialScrollTop]);

    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRowCount);
    const stopRow = Math.min(rowCount - 1, Math.ceil((scrollTop + height) / rowHeight) + overscanRowCount);

    const startColumn = Math.max(0, Math.floor(scrollLeft / columnWidth) - overscanColumnCount);
    const stopColumn = Math.min(columnCount - 1, Math.ceil((scrollLeft + width) / columnWidth) + overscanColumnCount);

    const items = [];
    for (let rowIndex = startRow; rowIndex <= stopRow; rowIndex++) {
        for (let columnIndex = startColumn; columnIndex <= stopColumn; columnIndex++) {
            const style = {
                position: "absolute",
                left: columnIndex * columnWidth,
                top: rowIndex * rowHeight,
                width: columnWidth,
                height: rowHeight
            };
            items.push(
                <Component
                    key={`${rowIndex}-${columnIndex}`}
                    rowIndex={rowIndex}
                    columnIndex={columnIndex}
                    style={style}
                    data={itemData}
                />
            );
        }
    }

    const containerStyle = {
        position: "relative",
        height: rowCount * rowHeight,
        width: columnCount * columnWidth,
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
            <div style={containerStyle}>
                {items}
            </div>
        </div>
    );
});

FixedSizeGrid.displayName = "FixedSizeGrid";

export default FixedSizeGrid;
