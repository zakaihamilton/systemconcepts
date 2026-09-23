import base from "./svgr.config.ts";
import template from "./svgr-template.ts";

const svgrWebpackConfig = {
	...base,
	runtimeConfig: false,
	template,
};

export default svgrWebpackConfig;
