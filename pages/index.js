import Head from "next/head"
import dynamic from "next/dynamic";
import Loading from "@/components/Loading";

const Main = dynamic(() => import("@/components/Main"), {
  ssr: false,
  loading: ({ error }) => (<Loading error={error} />)
});

export default function Home() {
  return <>
    <Head>
      <link rel='manifest' href='/manifest.json' />
    </Head>
    <Main />
  </>;
}
