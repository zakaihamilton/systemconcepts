import dynamic from "next/dynamic";
import PageLoad from "@components/PageLoad";
const UpsAndDowns = dynamic(() => import("@diagrams/UpsAndDowns"), { loading: () => <PageLoad /> });

const diagrams = [
    {
        id: "upsanddowns",
        name: {
            eng: "Ups and Downs",
            heb: "עליות וירידות",
            "pt-br": "Subidas e Descidas"
        },
        Component: UpsAndDowns
    }
];

export default diagrams;