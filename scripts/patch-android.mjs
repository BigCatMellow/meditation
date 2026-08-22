import { readFile, writeFile } from 'node:fs/promises';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
let manifest = await readFile(manifestPath, 'utf8');
const permission = '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />';

if (!manifest.includes('android.permission.SCHEDULE_EXACT_ALARM')) {
  const manifestStart = manifest.indexOf('<manifest');
  const manifestTagEnd = manifest.indexOf('>', manifestStart);
  if (manifestStart < 0 || manifestTagEnd < 0) {
    throw new Error('Could not find the Android <manifest> root tag');
  }
  manifest = manifest.slice(0, manifestTagEnd + 1) + `\n    ${permission}` + manifest.slice(manifestTagEnd + 1);
  await writeFile(manifestPath, manifest);
  console.log('Added SCHEDULE_EXACT_ALARM permission inside <manifest>');
} else {
  console.log('Exact alarm permission already present');
}
