import { useEffect, useState } from "react";

export function useResize(ref, depends = []) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    const handleResize = () => {
        setTimeout(() => {
            requestAnimationFrame(() => {
                if (!ref.current) {
                    return;
                }
                const { clientWidth, clientHeight } = ref.current;
                setSize({ width: clientWidth, height: clientHeight });
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
