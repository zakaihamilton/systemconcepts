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
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        let vw = window.innerWidth * 0.01;
        document.documentElement.style.setProperty('--vw', `${vw}px`);
        setCounter(counter => counter + 1);
    };

    useEffect(() => {
        const handler = () => handleResize();
        window.addEventListener("resize", handler);
        handleResize();
        return () => {
            window.removeEventListener("resize", handler);
        };
    }, depends);

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
        handleResize();
    }, [counter]);

    return size;
}

export function useSize(ref, depends = []) {
    const [, setObserverCounter] = useState(0);
    const counter = useResize(depends);
    const emPixels = getEmValueFromElement(ref && ref.current);

    useEffect(() => {
        const handle = ref?.current;
        if (!handle) {
            return;
        }
        const resizeObserver = new ResizeObserver(entries => {
            setObserverCounter(counter => counter + 1);
        });
        resizeObserver.observe(handle);
        return () => {
            resizeObserver.unobserve(handle);
        }
    }, [ref]);

    const rect = ref?.current?.getBoundingClientRect() || {};
    const width = rect.width, height = rect.height;

    console.log("ref", ref.current, "width", width, "height", height);

    if (!ref || typeof window === "undefined") {
        return { width: 0, height: 0, emPixels };
    }

    return { counter, width, height, emPixels, ref };
}
