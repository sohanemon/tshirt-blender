import { defineConfig } from 'tsdown';

export default defineConfig({
	platform: 'node',
	format: ['esm'],
	dts: true,
	minify: true,
	treeshake: true,
	external: ['bun'],
	entry: ['./src/cli.ts'],
	deps: { skipNodeModulesBundle: true },
	exports: {
		bin: {
			cli: './src/cli.ts',
			'cli-template': './src/cli.ts',
		},
	},
});
