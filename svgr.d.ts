declare module "@icons/svg/*.svg" {
	import type {
		ForwardRefExoticComponent,
		RefAttributes,
		SVGProps,
	} from "react";

	const Icon: ForwardRefExoticComponent<
		SVGProps<SVGSVGElement> & RefAttributes<SVGSVGElement>
	>;
	export default Icon;
}
