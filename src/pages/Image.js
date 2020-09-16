import styles from "./Image.module.scss";
import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { getPreviousPath } from "@/util/pages";
import storage from "@/util/storage";
import Progress from "@/widgets/Progress";
import { useSync } from "@/util/sync";
import { PageSize } from "@/components/Page";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import { useTranslations } from "@/util/translations";
import { exportData } from "@/util/importExport";

registerToolbar("Image");

export default function ImagePage({ name }) {
    const translations = useTranslations();
    const size = useContext(PageSize);
    const [syncCounter] = useSync();
    const path = (getPreviousPath() + "/" + name).split("/").slice(1).join("/");
    const busyRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState(null);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(null);
    const readFile = useCallback(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setLoading(true);
        try {
            const content = await storage.readFile(path, "image");
            setContent(content);
            setLoading(false);
        }
        catch (err) {
            console.error(err);
            setError(err);
            setContent(null);
            setLoading(false);
        }
        busyRef.current = false;
    }, []);
    useEffect(() => {
        readFile();
    }, []);

    useEffect(() => {
        readFile();
    }, [syncCounter]);

    useEffect(() => {
        if (content) {
            var reader = new FileReader();
            reader.addEventListener("load", () => {
                setSrc(reader.result);
            }, false);
            reader.readAsDataURL(content);
        }
    }, [content]);

    const menuItems = [
        !loading && {
            id: "export",
            name: translations.EXPORT,
            icon: <GetAppIcon />,
            onClick: async () => {
                exportData(content, name);
            }
        }
    ].filter(Boolean);

    useToolbar({ id: "Image", items: menuItems, depends: [loading] });

    const style = { height: size.height - 22, width: size.width - 22 };

    return <>
        {!loading && <img className={styles.img} style={style} src={src} />}
        {loading && <Progress />}
    </>;
}
