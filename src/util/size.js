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
        const handler = () => handleResize();
        window.addEventListener("resize", handler);
        const timerHandle = setTimeout(handleResize, 0);
        return () => {
            window.removeEventListener("resize", handler);
            clearTimeout(timerHandle);
        };
    }, [dependsString]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const updateSize = () => {
            const rect = handle.getBoundingClientRect();
            const emPixels = getEmValueFromElement(handle);
            setSize({ width: rect.width, height: rect.height, emPixels });
        };
        const resizeObserver = new ResizeObserver(entries => {
            updateSize();
        });
        updateSize();
        resizeObserver.observe(handle);
        return () => {
            resizeObserver.unobserve(handle);
        };
    }, [ref, counter]);

    if (!ref || typeof window === "undefined") {
        return { width: 0, height: 0, emPixels: size.emPixels };
    }

    return { counter, ...size, ref };
}
