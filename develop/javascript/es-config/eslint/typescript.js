const config = {
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: ["plugin:@typescript-eslint/recommended"],
      plugins: ["@typescript-eslint"],
      parser: "@typescript-eslint/parser",
      rules: {
        "@typescript-eslint/no-floating-promises": "warn", // A genuine source of bugs
        "@typescript-eslint/no-non-null-assertion": "off", // Useful language feature
        "@typescript-eslint/no-shadow": "warn",
        "no-shadow": "off", // There is a bug with this rule for typescript files, replaced by above
        "@typescript-eslint/no-explicit-any": "off", // useful language feature
        "@typescript-eslint/no-empty-interface": "off", // useful for readability
        "@typescript-eslint/no-empty-function": "off", // useful for readability
        "@typescript-eslint/no-unused-vars": [
          "warn",
          {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
          },
        ],
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": [
          "error",
          {
            functions: false,
            ignoreTypeReferences: true,
          },
        ],
      },
    },
    {
      files: ["*.test.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off", // Allow ava test context to be unused
      },
    },
  ],
};

module.exports = config;
