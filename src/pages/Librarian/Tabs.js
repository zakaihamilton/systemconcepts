import { useTranslations } from "@util/translations";
import { usePathItems, useParentParams, toPath } from "@util/pages";
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import LocalOfferIcon from '@material-ui/icons/LocalOffer';
import Tab from "@components/Widgets/Tabs/Tab";

export default function Tabs({ Container }) {
    const translations = useTranslations();
    const items = usePathItems();
    const baseIndex = items.findIndex(path => {
        const [id] = path.split("?");
        return id === "librarian";
    });
    const parentIndex = items.length - baseIndex - 2;
    const params = useParentParams(parentIndex) || {};

    const basePath = "#" + toPath(...items.slice(0, baseIndex + 1));

    const tabs = [
        {
            label: translations.LIBRARIAN,
            icon: <LibraryBooksIcon />,
            value: basePath
        },
        {
            label: translations.TAGS,
            icon: <LocalOfferIcon />,
            value: basePath + "/" + encodeURIComponent("tags")
        }
    ].filter(Boolean).map(item => {
        return <Tab key={item.label} {...item} />;
    });

    return <Container>
        {tabs}
    </Container>;
}