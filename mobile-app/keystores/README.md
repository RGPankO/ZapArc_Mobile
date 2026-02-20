# Keystores

This directory stores Android signing keystores.

## Files

- `debug.keystore` — **committed to git** and shared across the team.
  - Used for local debug/dev builds.
  - Keeping this stable prevents SHA fingerprint drift (important for Firebase / Google Sign-In).

- `release.keystore` — **NEVER commit this file**.
  - Used for Play Store release signing.
  - This file must stay private and is gitignored.

## Debug keystore flow

`expo prebuild --clean` regenerates `android/`, so `android/app/debug.keystore` gets replaced.

After prebuild, run:

```bash
sh scripts/post-prebuild.sh
```

(or use `npm run prebuild`) to copy:

- `keystores/debug.keystore` -> `android/app/debug.keystore`

This keeps all developers on the same debug certificate.
