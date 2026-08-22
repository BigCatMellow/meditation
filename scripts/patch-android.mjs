import { mkdir, readFile, writeFile } from 'node:fs/promises';

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

// Android 8+ notification-channel sounds must be bundled in res/raw.
// Generate a short two-tone PCM WAV so the project remains self-contained.
const rawDir = new URL('../android/app/src/main/res/raw/', import.meta.url);
const alarmPath = new URL('../android/app/src/main/res/raw/shoulder_alarm.wav', import.meta.url);
await mkdir(rawDir, { recursive: true });

const sampleRate = 22050;
const duration = 0.9;
const sampleCount = Math.floor(sampleRate * duration);
const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);

wav.write('RIFF', 0, 4, 'ascii');
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8, 4, 'ascii');
wav.write('fmt ', 12, 4, 'ascii');
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36, 4, 'ascii');
wav.writeUInt32LE(dataSize, 40);

for (let i = 0; i < sampleCount; i++) {
  const t = i / sampleRate;
  const freq = t < 0.3 ? 880 : t < 0.6 ? 660 : 880;
  const attack = Math.min(1, t / 0.02);
  const release = Math.min(1, (duration - t) / 0.06);
  const envelope = Math.max(0, Math.min(attack, release));
  const value = Math.round(Math.sin(2 * Math.PI * freq * t) * 0.35 * 32767 * envelope);
  wav.writeInt16LE(value, 44 + i * 2);
}

await writeFile(alarmPath, wav);
console.log('Generated res/raw/shoulder_alarm.wav');
