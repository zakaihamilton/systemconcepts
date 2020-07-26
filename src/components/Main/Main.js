import Head from "next/head"
import AppBar from "../AppBar/AppBar";
import StatusBar from "../StatusBar/StatusBar";
import SideBar from "../SideBar/SideBar";
import styles from "./Main.module.scss";
import clsx from "clsx";
import { useSlot } from "@/util/slots";

export default function Main() {
    const [slot] = useSlot({
        key: "main",
        showMenu: false
    });

    const className = slot.showMenu ? styles.rootWithMenu : styles.root;

    return <>
        <Head>
            <title>System Concepts</title>
            <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className={className}>
            <AppBar />
            <SideBar />
            <main className={styles.main}></main>
            <StatusBar />
        </div>
    </>
}
