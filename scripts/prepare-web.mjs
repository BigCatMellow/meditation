import { copyFile, mkdir, rm } from 'node:fs/promises';

const source = new URL('../index.html', import.meta.url);
const outputDir = new URL('../www/', import.meta.url);
const output = new URL('../www/index.html', import.meta.url);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await copyFile(source, output);

console.log('Prepared www/index.html from the source index.html');
