import { useEffect, useState } from "react";

function getEmValueFromElement(element) {
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
        setTimeout(() => {
            requestAnimationFrame(() => {
                if (!ref.current) {
                    return;
                }
                const { clientWidth, clientHeight } = ref.current.parentElement;
                const emPixels = getEmValueFromElement(ref.current);
                setSize({ width: clientWidth, height: clientHeight, emPixels });
            });
        }, 0);
    };

    useEffect(() => {
        const handler = () => handleResize(true);
        ref && ref.current && handleResize();
        ref && ref.current && window.addEventListener("resize", handler);

        return () => {
            window.removeEventListener("resize", handler);
        };
    }, [ref, ref && ref.current, ...depends]);

    return size;
}
