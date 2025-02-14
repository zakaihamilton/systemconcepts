import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { Store } from "pullstate";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { ContentSize } from "@components/Page/Content";
import { useContext, useEffect } from "react";

registerToolbar("Zoom");

export const ZoomStore = new Store({
    scale: 1.0
});

export default function Zoom() {
    const size = useContext(ContentSize);
    const { scale } = ZoomStore.useState();
    const translations = useTranslations();

    const zoomIn = () => {
        ZoomStore.update(s => {
            s.scale += 0.1;
        });
    };

    const zoomOut = () => {
        ZoomStore.update(s => {
            s.scale -= 0.1;
        });
    };

    useEffect(() => {
        const ref = size.ref;
        if (ref && ref.current) {
            ref.current.style.transform = `scale(${scale})`;
            ref.current.style.transformOrigin = "0% 0% 0px";
        }
        return () => {
            if (ref && ref.current) {
                ref.current.style.transform = "";
                ref.current.style.transformOrigin = "";
            }
        };
    }, [scale, size.ref]);

    const toolbarItems = [
        {
            id: "zoom_in",
            name: translations.ZOOM_IN,
            icon: <ZoomInIcon />,
            onClick: zoomIn,
            disabled: scale >= 1.4,
            location: "footer"
        },
        {
            id: "zoom_out",
            name: translations.ZOOM_OUT,
            icon: <ZoomOutIcon />,
            onClick: zoomOut,
            disabled: scale <= 0.4,
            location: "footer"
        }
    ].filter(Boolean);

    useToolbar({ id: "Zoom", items: toolbarItems, depends: [translations, scale] });
    return null;
}
