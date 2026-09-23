function template(variables: any, { tpl }: any) {
	return tpl`
${variables.imports};
import { withIcon } from "@ui/Icon";

const ${variables.componentName} = (${variables.props}) => ${variables.jsx};

export default withIcon(${variables.componentName}, "${variables.componentName}");
`;
}

export default template;
