import styles from "./UpsAndDowns.module.scss";
import { useTerms } from "@/util/terms";

function Worlds({ children }) {
    let offset = 0;
    const elements = React.Children.map(children, child => {
        const { props = {} } = child;
        const row = props.row || offset;
        const size = props.size || 1;
        offset += size;
        return React.cloneElement(child, { row });
    });
    return <div className={styles.root}>
        {elements}
    </div>
}

function World({ id, children, total, row, style = {} }) {
    const elements = React.Children.map(children, (child, index) => {
        return React.cloneElement(child, { row, index });
    });
    const terms = useTerms();
    const term = terms[id];
    const size = 2;
    const start = row * size;
    const gridRow = `${start + 1}/${start + size + 1}`;
    const gridColumn = `1/${total}`;
    style = { gridRow, gridColumn, ...style };
    return <div className={styles.world} style={style}>
        {term.name}
        {elements}
    </div>
}

function Divider({ id, row, style, total }) {
    const terms = useTerms();
    const term = terms[id];
    const gridRow = `${row}/${row + 1}`;
    const gridColumn = `1/${total}`;
    style = { gridRow, gridColumn, ...style };
    return <div className={styles.divider} style={style}>
        {term.name}
    </div>
}

function Item({ className, style, start, end, column, label, content }) {
    const gridRow = `${start + 1}/${end + 1}`;
    const gridColumn = `${column + 1}/${column + 2}`;
    style = { gridRow, gridColumn, ...style };
    return <div className={className} style={style}>
        {<div className={styles.itemLabel}>
            {label}
        </div>}
        <div className={styles.itemContent}>
            {content}
        </div>
    </div>;
}

function Face({ id, start, end = start + 1, column }) {
    const terms = useTerms();
    const half = parseInt((end - start) / 2) + 1;
    return <>
        <Item
            id={terms.faceHead}
            start={start}
            end={start + half}
            column={column}
            label={terms[id].name}
            content={terms.faceHead.name}
            className={styles.head}
        />
        <Item
            id={terms.faceBody}
            start={start + half}
            end={end + 1}
            column={column}
            content={terms.faceBody.name}
            className={styles.body}
        />
    </>;
}

export default function UpsAndDowns() {
    const total = 16;
    return <Worlds>
        <World id="world_primordialman" total={total}>

        </World>
        <World id="world_emanation" total={total}>
        </World>
        <World id="world_creation" total={total}>
        </World>
        <World id="world_formation" total={total}>
        </World>
        <World id="world_action" total={total}>

        </World>
        <World id="world_thisworld" total={total}>

        </World>
        <Divider id="chest" row={4} total={total} />
        <Divider id="chest" row={8} total={total} />
        <Face id="face_creator" start={2} column={11} />
        <Face id="face_israel" start={3} end={4} column={9} />
        <Face id="face_gentiles" start={4} end={9} column={7} />
        <Face id="face_animal" start={8} end={10} column={5} />
        <Face id="face_body" start={10} end={11} column={3} />
    </Worlds >
}
