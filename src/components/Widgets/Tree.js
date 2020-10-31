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
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { addPath } from "@util/pages";
import { StatusBarStore } from "@widgets/StatusBar";

registerToolbar("Tree");

export function flatten(root) {
    let results = [];
    const items = root.items;

    results.push(root);

    if (items) {
        for (const item of items) {
            results.push(...flatten(item));
        }
    }

    return results;
}

function* treeWalker({ builder, data, params, mapper, filter, setEmpty }, refresh = false) {
    const stack = [];

    if (builder) {
        data = builder(data);
    }

    if (!data || !data.items) {
        setEmpty(true);
        return null;
    }

    // Remember all the necessary data of the first node in the stack.
    for (const item of data.items) {
        stack.push({
            nestingLevel: 0,
            node: item,
        });
    }

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

        const { items = [], id } = node;

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
                item: node,
                nestingLevel,
                ...params
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

export default function TreeWidget(props) {
    let {
        Node,
        builder,
        params,
        mapper,
        store,
        filter,
        loading,
        source,
        statusBar,
        refresh,
        itemSize = "4em",
        statusBarHeight = "4em",
        onImport,
        onExport,
        name,
        data = []
    } = props;
    const { select } = store.useState();
    const translations = useTranslations();
    const statusBarIsActive = StatusBarStore.useState(s => s.active);
    const size = useContext(PageSize);
    const [isEmpty, setEmpty] = useState(false);
    const boundTreeWalker = useMemo(() => {
        return treeWalker.bind(this, { builder, data, params, mapper, filter, setEmpty });
    }, [select, builder, data, params, mapper, filter]);

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

    const gotoSource = () => {
        addPath("editor" + source);
    };

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
        },
        source && {
            id: "editor",
            name: translations.EDITOR,
            icon: <InsertDriveFileIcon />,
            onClick: gotoSource,
            location: "advanced"
        }
    ].filter(Boolean);

    useEffect(() => {
        if (loading) {
            setEmpty(false);
        }
    }, [loading]);

    useToolbar({ id: "Tree", items: toolbarItems, depends: [data, name, translations] });

    const sizeValid = size && size.width && size.height;
    const statusBarVisible = !loading && !!statusBar;
    const height = size.height - (!!statusBarIsActive && sizeToPixels(statusBarHeight));

    return <>
        {!!loading && loadingElement}
        {!!isEmpty && !loading && emptyElement}
        {!!statusBarVisible && statusBar}
        {!loading && sizeValid && <Tree treeWalker={boundTreeWalker} itemSize={itemSize} height={height} width={size && size.width}>
            {Node}
        </Tree>}
    </>;
}