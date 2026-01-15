# AI Agent Build Guide: ZapArc Mobile (Android)

This guide contains critical configuration details for rebuilding the ZapArc Mobile application on Windows. Follow these steps exactly to avoid known native build failures.

## ⚠️ Critical: Project Location (MAX_PATH)

Due to deep nesting in the Breez SDK (`node_modules/@breeztech/...`), the project **MUST** be located in a very short root path.

- **Recommended Path**: `D:\za`
- **Failure Symptom**: `ninja: error: mkdir(...): No such file or directory` during `:breeztech_breez-sdk-spark-react-native:buildCMakeRelWithDebInfo`.

## 🛠️ Environment Prerequisites

- **Java**: **JDK 17** is mandatory. (JDK 21+ will cause Gradle/Native build crashes).
  - Location: `C:\Users\Haker\scoop\apps\openjdk17\current`
- **Android SDK**: `C:\Users\Haker\scoop\apps\android-clt\current`
- **NDK Version**: `27.1.12297006`
- **CMake Version**: `3.22.1`

## 🏗️ Rebuild Procedure

### 1. Set Environment Variables

Always set `JAVA_HOME` in the current terminal session before building:

```bash
export JAVA_HOME="/c/Users/Haker/scoop/apps/openjdk17/current"
```

### 2. Prepare `android/local.properties`

Use **forward slashes** to avoid Windows volume label syntax errors:

```properties
sdk.dir=C:/Users/Haker/scoop/apps/android-clt/current
ndk.dir=C:/Users/Haker/scoop/apps/android-clt/current/ndk/27.1.12297006
```

### 3. Breez SDK Ninja Patch

If `node_modules` is reinstalled, the path resolution in the Breez SDK might fail on Windows. Manually ensure the following in `node_modules/@breeztech/breez-sdk-spark-react-native/android/CMakeLists.txt`:

```cmake
# Replace the node-based lookup with a hardcoded path if it fails
set(UNIFFI_BINDGEN_PATH "D:/za/node_modules/uniffi-bindgen-react-native")
```

### 4. Build Commands

From the project root (`D:\za`):

**Clean Build:**

```bash
cd android && ./gradlew clean
```

**Generate Release APK:**

```bash
cd android && ./gradlew assembleRelease --no-daemon
```

## 📍 Output Location

Final APK: `D:\za\android\app\build\outputs\apk\release\app-release.apk`
