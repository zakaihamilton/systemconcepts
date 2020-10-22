import { useEffect, useState } from "react";

export function getEmValueFromElement(element) {
    if (element.parentNode) {
        var parentFontSize = parseFloat(window.getComputedStyle(element.parentNode).fontSize);
        var elementFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        var pixelValueOfOneEm = (elementFontSize / parentFontSize) * elementFontSize;
        return pixelValueOfOneEm;
    }
};

export function useResize(ref, depends = []) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    const handleResize = () => {
        if (!ref.current) {
            return;
        }
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        let vw = window.innerWidth * 0.01;
        document.documentElement.style.setProperty('--vw', `${vw}px`);
        setTimeout(() => {
            if (!ref.current) {
                return;
            }
            const element = ref.current.parentElement;
            const { clientWidth, clientHeight } = element;
            const emPixels = getEmValueFromElement(element);
            setSize({ width: clientWidth, height: clientHeight, emPixels, ref });
        }, 0);
    };

    useEffect(() => {
        const handler = () => handleResize();
        ref && ref.current && handleResize();
        ref && ref.current && window.addEventListener("resize", handler);

        return () => {
            window.removeEventListener("resize", handler);
        };
    }, [ref, ref && ref.current, ...depends]);

    return size;
}
