import { registerToolbar, useToolbar } from "@components/Toolbar";
import SaveIcon from "@mui/icons-material/Save";
import { useTranslations } from "@util/translations";
import Progress from "@widgets/Progress";

registerToolbar("Save");

export default function Save({ onClick, visible, saving }) {
    const translations = useTranslations();

    const toolbarItems = [
        visible && {
            id: "save",
            name: saving ? translations.SAVING : translations.SAVE,
            icon: saving ? <Progress size={24} /> : <SaveIcon />,
            location: "header",
            onClick: !saving && onClick
        }
    ].filter(Boolean);

    useToolbar({ id: "Save", items: toolbarItems, depends: [visible, translations, saving, onClick] });
    return null;
}
