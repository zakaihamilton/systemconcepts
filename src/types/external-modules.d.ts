declare module "pako" {
	const pako: any;
	export default pako;
}

declare module "nodemailer" {
	const nodemailer: any;
	export default nodemailer;
}

declare module "react-color" {
	import type { ComponentType } from "react";
	export const SketchPicker: ComponentType<any>;
}

interface Navigator {
	msSaveOrOpenBlob?: (blob: Blob, fileName?: string) => boolean;
}
