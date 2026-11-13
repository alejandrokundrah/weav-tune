// Bundles the main process and the preload script (CommonJS, as Electron loads them) into build/.
import { build } from 'esbuild';

const common = { bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], logLevel: 'info', sourcemap: false };
await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'build/main.cjs' });
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'build/preload.cjs' });
