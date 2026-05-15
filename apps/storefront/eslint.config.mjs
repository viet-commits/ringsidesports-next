import baseConfig from "@ringsidesports/eslint-config/next";

export default [
  ...baseConfig,
  {
    ignores: [".next/**", "out/**", "public/**"],
  },
];
