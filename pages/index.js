import Head from "next/head"
import App from "@components/App";

export default function Home() {
  return <>
    <Head>
      <link rel='manifest' href='/manifest.json' />
      <meta name="theme-color" content="#013459" />
    </Head>
    <App />
  </>;
}
