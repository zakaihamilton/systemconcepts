import local from "@/storage/local";
import remote from "@/storage/remote";

export default [
    {
        id: "local",
        name: "LOCAL",
        ...local
    },
    {
        id: "remote",
        name: "REMOTE",
        ...remote
    }
];