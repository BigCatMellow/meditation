# Android build

The existing `index.html` remains the source of truth. Before an Android build, `scripts/prepare-web.mjs` copies it into Capacitor's generated `www` directory.

## Build on GitHub

1. Open the repository's **Actions** tab.
2. Open **Build Android APK**.
3. Run the workflow, or use the automatically triggered branch/PR build.
4. Open the completed workflow run.
5. Download the `meditation-guide-debug-apk` artifact.
6. Unzip it and install `app-debug.apk` on an Android device.

Android may ask you to permit installation from the app used to open the APK. This debug package is intended for personal testing, not Google Play distribution.

## Build locally

Install Node.js and Android Studio, then run:

```bash
npm install
npm run android:init
npm run android:open
```

After changing `index.html`, use:

```bash
npm run android:open
```

The app uses:

- App name: `Meditation Guide`
- Package ID: `com.bigcatmellow.meditation`
- Web source: `index.html`

## Release builds

A Google Play release requires a private signing key and a signed Android App Bundle. Do not commit signing keys or passwords to this repository.
