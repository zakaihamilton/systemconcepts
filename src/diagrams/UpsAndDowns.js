import { useState } from "react";
import styles from "./UpsAndDowns.module.scss";
import { useTerms } from "@/util/terms";
import Tooltip from '@material-ui/core/Tooltip';
import clsx from "clsx";
import { MainStore } from "@/components/Main";
import Term from "@/widgets/Term";

function Worlds({ children, total }) {
    let offset = 0;
    const elements = React.Children.map(children, child => {
        const { props = {} } = child;
        const row = props.row || offset;
        const size = props.size || 1;
        offset += size;
        return React.cloneElement(child, { row, total });
    });
    return <div className={styles.root}>
        {elements}
    </div>
}

function World({ id, total, row, style = {} }) {
    const terms = useTerms();
    const term = terms[id];
    let phase = null;
    if (typeof term.phase !== "undefined") {
        phase = terms["phase." + term.phase];
    }
    const size = 2;
    const start = row * size;
    const gridRow = `${start + 1}/${start + size + 1}`;
    const gridColumn = `1/${total}`;
    const backgroundColor = phase && phase.fill;
    style = { gridRow, gridColumn, ...style };
    return <>
        <div className={styles.world} style={{ ...style, backgroundColor }} />
        <div className={styles.worldInfo} style={{ ...style, gridColumn: 1 }} >
            <Term id={id} />
        </div>
    </>
}

function Divider({ id, row, style, total }) {
    const terms = useTerms();
    const term = terms[id];
    const gridRow = `${row}/${row + 1}`;
    const gridColumn = `1/${total}`;
    style = { gridRow, gridColumn, ...style };
    return <>
        <div className={styles.divider} style={style} />
        <div className={styles.dividerInfo} style={{ ...style, gridColumn: total - 1 }}>
            <Term id={id} />
        </div>
    </>
}

function Item({ className, style, start, end, column, term, type, selected, ...props }) {
    const { darkMode } = MainStore.useState();
    const gridRow = `${start + 1}/${end + 1}`;
    const gridColumn = `${column + 1}/${column + 2}`;
    style = { gridRow, gridColumn, ...style };
    return <div className={clsx(styles.face, className, selected && styles.selected, darkMode && styles.darkMode)} style={style} {...props}>
        {term && <Term id={term} />}
        {type && <div className={clsx(styles.itemType, selected && styles.selected)}>
            <Term id={type} />
        </div>}
    </div>;
}

function Face({ id, headStart, headEnd = headStart + 1, bodyStart = headEnd, bodyEnd = bodyStart + 1, column }) {
    const terms = useTerms();
    const [selected, setSelected] = useState(0);

    const onClickHead = () => {
        setSelected(0);
    };

    const onClickBody = () => {
        setSelected(1);
    };

    return <>
        <Item
            id={terms.faceHead}
            start={headStart}
            end={headEnd}
            column={column}
            term={id}
            type={"faceHead"}
            className={styles.head}
            onClick={onClickHead}
            selected={selected === 0}
        />
        <Item
            id={terms.faceBody}
            start={bodyStart}
            end={bodyEnd}
            column={column}
            type={"faceBody"}
            className={styles.body}
            onClick={onClickBody}
            selected={selected === 1}
        />
    </>;
}

export default function UpsAndDowns() {
    const total = 8;
    return <Worlds total={total}>
        <World id="world.primordialman" />
        <World id="world.emanation" />
        <World id="world.creation" />
        <World id="world.formation" />
        <World id="world.action" />
        <World id="world.thisworld" />
        <Divider id="chest" row={4} />
        <Divider id="chest" row={8} />
        <Divider id="chest" row={12} />
        <Face id="face.creator" headStart={2} bodyEnd={3} column={5} />
        <Face id="face.israel" headStart={3} bodyStart={4} bodyEnd={7} column={4} />
        <Face id="face.gentiles" headStart={4} headEnd={7} bodyEnd={10} column={3} />
        <Face id="face.animal" headStart={7} headEnd={10} bodyEnd={11} column={2} />
        <Face id="face.body" headStart={10} headEnd={11} bodyStart={11} column={1} />
    </Worlds >
}
