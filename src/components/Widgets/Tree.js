import { useMemo, useContext, useEffect, useState } from "react";
import { FixedSizeTree as Tree } from 'react-vtree';
import { PageSize } from "@components/Page";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import { importData, exportData } from "@util/importExport";
import { useTranslations } from "@util/translations";
import DataUsageIcon from '@material-ui/icons/DataUsage';
import WarningIcon from '@material-ui/icons/Warning';
import Message from "@widgets/Message";
import RefreshIcon from '@material-ui/icons/Refresh';

registerToolbar("Tree");

function* treeWalker({ builder, data, mapper, filter, setEmpty }, refresh = false) {
    const stack = [];

    if (builder) {
        data = builder(data);
        console.log("data", data);
    }

    if (!data || !data.id) {
        setEmpty(true);
        return null;
    }

    // Remember all the necessary data of the first node in the stack.
    stack.push({
        nestingLevel: 0,
        node: data,
    });

    let numItems = 0;

    // Walk through the tree until we have no nodes available.
    while (stack.length !== 0) {
        const {
            node,
            nestingLevel,
        } = stack.pop();

        if (mapper) {
            node = mapper(node);
        }

        if (filter) {
            if (!filter(node)) {
                continue;
            }
        }

        numItems++;

        const { items = [], id, ...props } = node;

        // Here we are sending the information about the node to the Tree component
        // and receive an information about the openness state from it. The
        // `refresh` parameter tells us if the full update of the tree is requested;
        // basing on it we decide to return the full node data or only the node
        // id to update the nodes order.
        const isOpened = yield refresh
            ? {
                id,
                isLeaf: items.length === 0,
                isOpenByDefault: true,
                ...props,
                nestingLevel,
            }
            : id;

        // Basing on the node openness state we are deciding if we need to render
        // the child nodes (if they exist).
        if (items.length !== 0 && isOpened) {
            // Since it is a stack structure, we need to put nodes we want to render
            // first to the end of the stack.
            for (let i = items.length - 1; i >= 0; i--) {
                stack.push({
                    nestingLevel: nestingLevel + 1,
                    node: items[i],
                });
            }
        }
    }

    setEmpty(!numItems);
}

export default function TreeWidget({ Node, builder, mapper, store, filter, loading, refresh, itemSize = "4em", onImport, onExport, name, data = [] }) {
    const { select } = store.useState();
    const translations = useTranslations();
    const size = useContext(PageSize);
    const [isEmpty, setEmpty] = useState(false);
    const boundTreeWalker = useMemo(() => {
        return treeWalker.bind(this, { builder, data, mapper, filter, setEmpty });
    }, [select, builder, data, mapper, filter]);

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }

    const loadingElement = <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />;
    const emptyElement = <Message Icon={WarningIcon} label={translations.NO_ITEMS} />;

    itemSize = sizeToPixels(itemSize);

    if (!Node) {
        return null;
    }

    const toolbarItems = [
        data && name && onImport && {
            id: "import",
            name: translations.IMPORT,
            icon: <PublishIcon />,
            onClick: async () => {
                let body = "";
                try {
                    body = await importData();
                }
                catch (err) {
                    if (err) {
                        console.error(err);
                    }
                    return;
                }
                try {
                    await onImport(JSON.parse(body));
                }
                catch (err) {
                    console.error(err);
                }
            },
            location: "advanced"
        },
        data && name && {
            id: "export",
            name: translations.EXPORT,
            icon: <GetAppIcon />,
            onClick: async () => {
                let body = null;
                if (onExport) {
                    body = await onExport();
                }
                else {
                    body = JSON.stringify({ [name]: data }, null, 4);
                }
                exportData(body, name, "application/json");
            },
            location: "advanced"
        },
        refresh && {
            id: "refresh",
            name: translations.REFRESH,
            icon: <RefreshIcon />,
            onClick: refresh,
            location: "advanced"
        }
    ].filter(Boolean);

    useEffect(() => {
        if (loading) {
            setEmpty(false);
        }
    }, [loading]);

    useToolbar({ id: "Tree", items: toolbarItems, depends: [data, name, translations] });

    return <>
        {!!loading && loadingElement}
        {!!isEmpty && !loading && emptyElement}
        {!loading && <Tree treeWalker={boundTreeWalker} itemSize={itemSize} height={size.height} width={size.width}>
            {Node}
        </Tree>}
    </>;
}
