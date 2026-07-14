function template(variables, { tpl }) {
	return tpl`
${variables.imports};
import { withIcon } from "@ui/Icon";

const ${variables.componentName} = (${variables.props}) => ${variables.jsx};

export default withIcon(${variables.componentName}, "${variables.componentName}");
`;
}

module.exports = template;
