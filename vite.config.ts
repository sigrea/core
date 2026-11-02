import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		useTabs: true,
		printWidth: 80,
		ignorePatterns: ["**/*.md", "**/*.yml", "**/*.yaml"],
	},
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		options: { typeAware: true, typeCheck: true },
	},
	pack: {
		entry: ["index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		outExtensions: ({ format }) => ({
			js: format === "es" ? ".mjs" : ".cjs",
			dts: format === "es" ? ".d.ts" : ".d.cts",
		}),
		attw: { profile: "strict", level: "error" },
	},
	test: {
		coverage: {
			include: ["index.ts", "packages/**/*.{ts,tsx}"],
			exclude: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
			thresholds: { statements: 84, branches: 88, functions: 89, lines: 84 },
		},
	},
	staged: { "*.{ts,tsx,js,jsx,json}": "vp check --fix" },
});
