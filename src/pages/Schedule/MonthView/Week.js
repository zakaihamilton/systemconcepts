import styles from "./Week.module.scss";
import Day from "./Day";

export default function Week({ row }) {
    const numDays = 7;
    const days = new Array(numDays).fill(0).map((_, index) => {
        return <Day column={index + 1} row={row} />;
    });
    return <>
        {days}
    </>
}