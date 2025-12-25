import { useEffect, useState } from "react";

export function getEmValueFromElement(element) {
    if (element && element.parentNode) {
        var parentFontSize = parseFloat(window.getComputedStyle(element.parentNode).fontSize);
        var elementFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        var pixelValueOfOneEm = (elementFontSize / parentFontSize) * elementFontSize;
        return pixelValueOfOneEm;
    }
    return 16;
};

export function useResize(depends = []) {
    const [counter, setCounter] = useState(0);

    const handleResize = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
        let vw = window.innerWidth * 0.01;
        document.documentElement.style.setProperty("--vw", `${vw}px`);
        setCounter(counter => counter + 1);
    };

    const dependsString = JSON.stringify(depends);
    useEffect(() => {
        let rafId = null;
        let timeoutId = null;

        const debouncedHandler = () => {
            // Cancel any pending animation frame
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            // Use requestAnimationFrame to throttle updates
            rafId = requestAnimationFrame(() => {
                // Clear any pending timeout
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Debounce with a small delay to batch rapid resize events
                timeoutId = setTimeout(handleResize, 100);
            });
        };

        window.addEventListener("resize", debouncedHandler);
        const initialTimerHandle = setTimeout(handleResize, 0);

        return () => {
            window.removeEventListener("resize", debouncedHandler);
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            clearTimeout(initialTimerHandle);
        };
    }, [dependsString]);

    return counter;
}

export function useWindowSize() {
    const counter = useResize();
    const [size, setSize] = useState({ width: 0, height: 0 });

    const handleResize = () => {
        if (typeof window !== "undefined") {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        }
    };

    useEffect(() => {
        const timerHandle = setTimeout(handleResize, 0);
        return () => clearTimeout(timerHandle);
    }, [counter]);

    return size;
}

export function useSize(ref, depends = []) {
    const [size, setSize] = useState({ width: 0, height: 0, emPixels: 16 });
    const counter = useResize(depends);

    useEffect(() => {
        const handle = ref?.current;
        if (!handle) {
            return;
        }

        let rafId = null;
        let timeoutId = null;
        let lastWidth = 0;
        let lastHeight = 0;

        const updateSize = () => {
            const rect = handle.getBoundingClientRect();
            const emPixels = getEmValueFromElement(handle);
            const newWidth = rect.width;
            const newHeight = rect.height;

            // Only update if size has actually changed by a meaningful amount
            if (Math.abs(newWidth - lastWidth) > 1 || Math.abs(newHeight - lastHeight) > 1) {
                lastWidth = newWidth;
                lastHeight = newHeight;
                setSize({ width: newWidth, height: newHeight, emPixels });
            }
        };

        const debouncedUpdate = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                timeoutId = setTimeout(updateSize, 50);
            });
        };

        const resizeObserver = new ResizeObserver(entries => {
            debouncedUpdate();
        });

        updateSize();
        resizeObserver.observe(handle);

        return () => {
            resizeObserver.unobserve(handle);
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [ref, counter]);

    if (!ref || typeof window === "undefined") {
        return { width: 0, height: 0, emPixels: size.emPixels };
    }

    return { counter, ...size, ref };
}
