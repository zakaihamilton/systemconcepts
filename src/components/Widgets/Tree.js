import { useMemo, useContext, useEffect, useState } from "react";
import { FixedSizeTree as Tree } from 'react-vtree';
import { ContentSize } from "@components/Page/Content";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import { importData, exportData } from "@util/importExport";
import { useTranslations } from "@util/translations";
import DataUsageIcon from '@material-ui/icons/DataUsage';
import InfoIcon from '@material-ui/icons/Info';
import Message from "@widgets/Message";
import RefreshIcon from '@material-ui/icons/Refresh';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { addPath } from "@util/pages";
import { StatusBarStore } from "@widgets/StatusBar";
import { useSearch } from "@components/Search";
import styles from "./Tree.module.scss";

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

export function iterate(root, callback, parent) {
    const items = root.items;
    callback(root, parent);
    if (items) {
        for (const item of items) {
            iterate(item, callback, root);
        }
    }
}

export function reverseIterate(root, callback, parent) {
    const items = root.items;
    if (items) {
        for (const item of items) {
            reverseIterate(item, callback, root);
        }
    }
    callback(root, parent);
}

function* treeWalker({ data, params, setEmpty, isOpenByDefault }, refresh = false) {
    const stack = [];

    const items = data && data.items;
    if (!items) {
        setEmpty(true);
        return null;
    }

    // Remember all the necessary data of the first node in the stack.
    for (const item of data.items) {
        stack.push({
            nestingLevel: 0,
            node: item
        });
    }

    let numItems = 0;

    // Walk through the tree until we have no nodes available.
    while (stack.length !== 0) {
        const {
            node,
            nestingLevel,
        } = stack.pop();

        numItems++;

        const { items = [], id, match } = node;

        if (!match) {
            continue;
        }

        // Here we are sending the information about the node to the Tree component
        // and receive an information about the openness state from it. The
        // `refresh` parameter tells us if the full update of the tree is requested;
        // basing on it we decide to return the full node data or only the node
        // id to update the nodes order.
        const isOpened = yield refresh
            ? {
                id,
                isLeaf: items.length === 0,
                isOpenByDefault,
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
        data = [],
        isOpenByDefault = false
    } = props;
    const { select } = store.useState();
    const translations = useTranslations();
    const statusBarIsActive = StatusBarStore.useState(s => s.active);
    const size = useContext(ContentSize);
    const [isEmpty, setEmpty] = useState(false);
    const search = useSearch(() => { });
    const boundTreeWalker = useMemo(() => {
        let tree = (data || []).map(item => {
            item = { ...item };
            if (mapper) {
                item = mapper(item);
            }
            item.match = !filter || filter(item, search) ? 1 : 0;
            return item;
        });

        if (builder) {
            tree = builder(tree);
        }

        reverseIterate(tree, (item, parent) => {
            if (item && item.match && parent && !parent.match) {
                parent.match = item.match + 1;
            }
        });

        iterate(tree, (item, parent) => {
            if (!item.match && parent && parent.match === 1) {
                item.match = parent.match + 1;
            }
        });
        return treeWalker.bind(this, {
            builder,
            data: tree,
            params,
            mapper,
            filter,
            search,
            setEmpty,
            isOpenByDefault
        });
    }, [select, builder, data, params, mapper, search, filter, isOpenByDefault]);

    const sizeToPixels = text => {
        const number = parseFloat(text);
        const sizeInPixels = text.trim().endsWith("em") ? number * size.emPixels : number;
        return sizeInPixels;
    }

    const loadingElement = <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />;
    const emptyElement = <Message Icon={InfoIcon} label={translations.NO_ITEMS} />;

    itemSize = sizeToPixels(itemSize);

    if (!Node) {
        return null;
    }

    const gotoSource = () => {
        addPath("editor" + source);
    };

    const toolbarItems = [
        name && onImport && {
            id: "import",
            name: translations.IMPORT,
            icon: <PublishIcon />,
            onClick: async () => {
                let body = "";
                try {
                    ({ body } = await importData());
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
            location: "header",
            menu: "true"
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
            location: "header",
            menu: "true"
        },
        refresh && {
            id: "refresh",
            name: translations.REFRESH,
            icon: <RefreshIcon />,
            onClick: refresh,
            location: "header",
            menu: "true"
        },
        source && {
            id: "editor",
            name: translations.EDITOR,
            icon: <InsertDriveFileIcon />,
            onClick: gotoSource,
            location: "header",
            menu: "true"
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
        {!loading && sizeValid && <Tree className={styles.tree} treeWalker={boundTreeWalker} itemSize={itemSize} height={height} width={size && size.width}>
            {Node}
        </Tree>}
    </>;
}
