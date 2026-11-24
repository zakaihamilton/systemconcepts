import {
	copyFile,
	copyFolder,
	exportFolder,
	exportFolderAsZip,
	importFolder,
	moveFile,
	moveFolder,
} from "./storage/archive";
import {
	callMethod,
	getRecursiveList,
	storageMethods,
} from "./storage/dispatch";
import { useFile, useListing } from "./storage/hooks";

export { callMethod, useFile, useListing };

const storageApi: Record<string, any> = {
	...storageMethods,
	exportFolder,
	exportFolderAsZip,
	importFolder,
	copyFolder,
	copyFile,
	moveFile,
	moveFolder,
	getRecursiveList,
	resetLocalFileSystem: () => storageMethods.resetLocalFileSystem(),
};

export default storageApi;
