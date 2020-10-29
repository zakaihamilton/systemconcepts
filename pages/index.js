import Head from "next/head"
import App from "@components/App";

export default function Home() {
  return <>
    <Head>
      <link rel='manifest' href='/manifest.json' />
    </Head>
    <App />
  </>;
}
