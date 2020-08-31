import styles from "./UpsAndDowns.module.scss";
import { useTerms } from "@/util/terms";
import PublicIcon from '@material-ui/icons/Public';
import FaceIcon from '@material-ui/icons/Face';
import Tooltip from '@material-ui/core/Tooltip';
import clsx from "clsx";

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

function World({ id, total, row, style = {} }) {
    const terms = useTerms();
    const term = terms[id];
    const size = 2;
    const start = row * size;
    const gridRow = `${start + 1}/${start + size + 1}`;
    const gridColumn = `1/${total}`;
    const backgroundColor = term.fill;
    style = { gridRow, gridColumn, ...style };
    return <>
        <div className={styles.world} style={{ ...style, backgroundColor }} />
        <div className={styles.worldInfo} style={{ ...style, gridColumn: 1 }} >
            <Tooltip arrow title={terms.world.name}>
                <PublicIcon />
            </Tooltip>
            <div className={styles.worldLabel}>
                <div className={styles.worldName}>
                    <span>{term.name}</span>
                </div>
                <div className={styles.worldExplanation}>
                    {term.explanation}
                </div>
            </div>
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
            {term.name}
        </div>
    </>
}

function Item({ className, style, start, end, column, icon, name, tooltip, subHeading, type }) {
    const gridRow = `${start + 1}/${end + 1}`;
    const gridColumn = `${column + 1}/${column + 2}`;
    style = { gridRow, gridColumn, ...style };
    return <div className={clsx(styles.face, className)} style={style}>
        {name && <div className={styles.itemRow}>
            {icon && <Tooltip arrow title={tooltip}>
                {icon}
            </Tooltip>}
            <div className={style.itemLabel}>
                <div className={styles.itemName}>
                    {name}
                </div>
                {subHeading && <div className={styles.itemSubHeading}>
                    {subHeading}
                </div>}
            </div>
        </div>}
        {type && <div className={styles.itemType}>
            {type}
        </div>}
    </div>;
}

function Face({ id, headStart, headEnd = headStart + 1, bodyStart = headEnd, bodyEnd = bodyStart + 1, column }) {
    const terms = useTerms();
    return <>
        <Item
            id={terms.faceHead}
            start={headStart}
            end={headEnd}
            column={column}
            icon={<FaceIcon />}
            tooltip={terms.face.name}
            name={terms[id].name}
            type={terms.faceHead.name}
            subHeading={terms[id].explanation}
            className={styles.head}
        />
        <Item
            id={terms.faceBody}
            start={bodyStart}
            end={bodyEnd}
            column={column}
            type={terms.faceBody.name}
            className={styles.body}
        />
    </>;
}

export default function UpsAndDowns() {
    const total = 8;
    return <Worlds>
        <World id="world_primordialman" total={total} />
        <World id="world_emanation" total={total} />
        <World id="world_creation" total={total} />
        <World id="world_formation" total={total} />
        <World id="world_action" total={total} />
        <World id="world_thisworld" total={total} />
        <Divider id="chest" row={4} total={total} />
        <Divider id="chest" row={8} total={total} />
        <Divider id="chest" row={12} total={total} />
        <Face id="face_creator" headStart={2} bodyEnd={3} column={5} />
        <Face id="face_israel" headStart={3} bodyStart={4} bodyEnd={7} column={4} />
        <Face id="face_gentiles" headStart={4} headEnd={7} bodyEnd={10} column={3} />
        <Face id="face_animal" headStart={7} headEnd={10} bodyEnd={11} column={2} />
        <Face id="face_body" headStart={10} headEnd={11} bodyStart={11} column={1} />
    </Worlds >
}
