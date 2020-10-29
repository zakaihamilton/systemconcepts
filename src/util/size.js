import { useEffect, useState } from "react";

export function getEmValueFromElement(element) {
    if (element.parentNode) {
        var parentFontSize = parseFloat(window.getComputedStyle(element.parentNode).fontSize);
        var elementFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        var pixelValueOfOneEm = (elementFontSize / parentFontSize) * elementFontSize;
        return pixelValueOfOneEm;
    }
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

        return () => {
            window.removeEventListener("resize", handler);
        };
    }, [...depends]);

    return counter;
}

export function useSize(ref, depends = []) {
    const counter = useResize(depends);
    const [size, setSize] = useState({ width: 0, height: 0 });

    const handleResize = () => {
        if (!ref || !ref.current) {
            if (window) {
                setSize({ width: window.innerWidth, height: window.innerHeight });
            }
            return;
        }
        const element = ref.current.parentElement;
        const { clientWidth, clientHeight } = element;
        const emPixels = getEmValueFromElement(element);
        setSize({ width: clientWidth, height: clientHeight, emPixels, ref });
    };

    useEffect(() => {
        handleResize();
    }, [counter, ref && ref.current]);

    return size;
}
