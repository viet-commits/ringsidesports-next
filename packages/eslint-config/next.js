import base from "@ringsidesports/eslint-config/base";

export default [
  ...base,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
