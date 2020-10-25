import { useMemo, useContext } from "react";
import { FixedSizeTree as Tree } from 'react-vtree';
import { PageSize } from "@components/Page";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import { importData, exportData } from "@util/importExport";
import { useTranslations } from "@util/translations";

registerToolbar("Tree");

function* treeWalker(tree, mapper, refresh = false) {
    const stack = [];

    if (!tree || tree.length === 0) {
        return null;
    }

    // Remember all the necessary data of the first node in the stack.
    stack.push({
        nestingLevel: 0,
        node: tree,
    });

    // Walk through the tree until we have no nodes available.
    while (stack.length !== 0) {
        const {
            node,
            nestingLevel,
        } = stack.pop();

        if (mapper) {
            node = mapper(node);
        }

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
}

export default function TreeWidget({ Node, mapper, refresh, itemSize = "4em", onImport, onExport, name, data = [] }) {
    const translations = useTranslations();
    const size = useContext(PageSize);
    const boundTreeWalker = useMemo(() => {
        return treeWalker.bind(this, data, mapper);
    }, [data, mapper]);

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }

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

    useToolbar({ id: "Tree", items: toolbarItems, depends: [data, name, translations] });

    return <Tree treeWalker={boundTreeWalker} itemSize={itemSize} height={size.height} width={size.width}>
        {Node}
    </Tree>;
}
