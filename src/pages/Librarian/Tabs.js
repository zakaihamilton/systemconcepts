import { useTranslations } from "@util/translations";
import { usePathItems, toPath } from "@util/pages";
import LibraryBooksIcon from "@material-ui/icons/LibraryBooks";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import StyleIcon from "@material-ui/icons/Style";
import Tab from "@components/Widgets/Tabs/Tab";

export default function Tabs({ Container }) {
    const translations = useTranslations();
    const items = usePathItems();
    const baseIndex = items.findIndex(path => {
        const [id] = path.split("?");
        return id === "librarian";
    });

    const currentPage = items[items.length - 1];
    const basePath = "#" + toPath(...items.slice(0, baseIndex + 1));

    const tabItems = [
        {
            id: "articles",
            label: translations.ARTICLES,
            icon: <LibraryBooksIcon />,
            value: basePath + "/" + encodeURIComponent("articles")
        },
        {
            id: "types",
            label: translations.TYPES,
            icon: <StyleIcon />,
            value: basePath + "/" + encodeURIComponent("types")
        },
        {
            id: "tags",
            label: translations.TAGS,
            icon: <LocalOfferIcon />,
            value: basePath + "/" + encodeURIComponent("tags")
        }
    ];

    const tabElements = tabItems.filter(Boolean).map(item => {
        return <Tab key={item.label} {...item} />;
    });

    if (!tabItems.find(item => currentPage.startsWith(item.id))) {
        return null;
    }

    return <Container>
        {tabElements}
    </Container>;
}