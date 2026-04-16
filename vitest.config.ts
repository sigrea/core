import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			thresholds: {
				statements: 84,
				branches: 88,
				functions: 89,
				lines: 84,
			},
		},
		passWithNoTests: true,
	},
});
