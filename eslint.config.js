import js from "@eslint/js";

export default [
  {
    ignores: ["**/node_modules/**", "**/.data/**"],
  },
  {
    files: ["api/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...js.configs.recommended.languageOptions?.globals,
        ...Object.fromEntries(
          [
            "Buffer",
            "URL",
            "clearTimeout",
            "console",
            "fetch",
            "process",
            "setTimeout",
          ].map((name) => [name, "readonly"]),
        ),
      },
    },
  },
];
