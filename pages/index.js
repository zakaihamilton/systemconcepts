import dynamic from "next/dynamic";
import Loading from "@/components/Loading";

const Main = dynamic(() => import("@/components/Main"), {
  ssr: false,
  loading: () => (<Loading />)
});

export default function Home() {
  return <Main />;
}
