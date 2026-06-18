import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "scratch/**", "src-tauri/target/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.mjs", "scripts/**/*.mjs", "vite.config.ts"],
    languageOptions: {
      globals: {
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        MouseEvent: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
        },
      ],
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "no-control-regex": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
);
