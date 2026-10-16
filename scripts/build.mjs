// Bundles the TypeScript game into a static site under docs/ (GitHub Pages source folder).
// All asset references are relative ("./"), so the site works from any sub-directory.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs');
const watch = process.argv.includes('--watch');

function copyStatic() {
  mkdirSync(join(out, 'assets'), { recursive: true });
  cpSync(join(root, 'web', 'index.html'), join(out, 'index.html'));
  cpSync(join(root, 'web', 'style.css'), join(out, 'assets', 'style.css'));
  writeFileSync(join(out, '.nojekyll'), '');
}

const ctx = await esbuild.context({
  entryPoints: [join(root, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  outfile: join(out, 'assets', 'game.js'),
  logLevel: 'info',
  legalComments: 'none',
});

if (existsSync(out)) {
  // Only refresh generated files; keep docs/ itself (it is the published folder).
  rmSync(join(out, 'assets', 'game.js'), { force: true });
}
copyStatic();

if (watch) {
  await ctx.watch();
  console.log('[build] watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('[build] done -> docs/');
}
