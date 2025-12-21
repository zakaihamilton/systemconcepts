import nextConfig from "eslint-config-next";
import coreWebVitalsConfig from "eslint-config-next/core-web-vitals";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
    ...nextConfig,
    ...coreWebVitalsConfig,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2015,
                screens: "writable",
                COMPONENT: "writable",
                React: "writable",
                workbox: "writable",
                importScripts: "writable",
            },
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                allowImportExportEverywhere: true,
            }
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            "import/no-anonymous-default-export": ["error", {
                "allowArray": true,
                "allowArrowFunction": true,
                "allowAnonymousClass": true,
                "allowAnonymousFunction": true,
                "allowCallExpression": true,
                "allowLiteral": true,
                "allowObject": true
            }],
            "linebreak-style": ["error", "unix"],
            "semi": ["error", "always"],
            "react/prop-types": 0,
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",
            "react/jsx-uses-vars": "error",
        }
    },
    prettierConfig,
];