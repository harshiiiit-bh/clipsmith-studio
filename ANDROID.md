# ClipSmith Studio for Android

The Android app is built from the same ClipSmith editor source using Capacitor. The editor assets are bundled into the APK; it is not merely a shortcut to the hosted website.

## Install the APK
Use the **Download APK** button in the website header or open the stable GitHub Release asset:
https://github.com/harshiiiit-bh/clipsmith-studio/releases/download/android-latest/ClipSmith-Android.apk

Android may ask you to permit installation from the browser or file manager used to open the APK. Only install builds linked from this repository's releases.

## Local Memory Vault
Project state and editing settings are saved locally. Tap **Save memory now** in Creator to keep the currently imported video on the device too (one remembered source video, up to 300 MB). The video is stored in local IndexedDB; it is not uploaded. If phone storage is full, session state still falls back to localStorage and the current edit can continue until the app is closed. Use **Forget saved video** to release the remembered media file.

## Build
The `.github/workflows/build-android.yml` workflow builds the Android debug APK on GitHub Actions and publishes the stable release asset. It can also be run manually from the Actions tab. The public APK is debug-signed for sideloading; it is not a Play Store release signing configuration.

Capacitor references:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/android
