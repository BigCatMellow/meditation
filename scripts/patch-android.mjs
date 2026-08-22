import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
let manifest = await readFile(manifestPath, 'utf8');
const permission = '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />';
if (!manifest.includes('android.permission.SCHEDULE_EXACT_ALARM')) {
  const close = manifest.indexOf('>');
  manifest = manifest.slice(0, close + 1) + `\n    ${permission}` + manifest.slice(close + 1);
  await writeFile(manifestPath, manifest);
  console.log('Added SCHEDULE_EXACT_ALARM permission');
} else {
  console.log('Exact alarm permission already present');
}
