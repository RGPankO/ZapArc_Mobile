# Local Development Setup

This guide covers setting up local iOS and Android development environments for building and testing the app without cloud services (EAS).

---

## iOS Development (macOS only)

### Prerequisites

1. **Xcode** (from App Store)
   ```bash
   # Verify installation
   xcode-select -p
   # Should return: /Applications/Xcode.app/Contents/Developer
   
   # If not installed, install command line tools
   xcode-select --install
   ```

2. **CocoaPods**
   ```bash
   sudo gem install cocoapods
   pod --version
   ```

3. **Watchman** (file watcher for Metro bundler)
   ```bash
   brew install watchman
   ```

4. **Node.js 18+**
   ```bash
   node --version
   ```

### First-Time iOS Setup

```bash
cd mobile-app

# Install dependencies
npm install

# Install iOS pods
cd ios && pod install && cd ..

# Build and run on simulator (first build takes 5-10 min)
npx expo run:ios
```

### Daily Development (Fast Reloads)

After the first native build, use Expo's dev server for instant reloads:

```bash
cd mobile-app

# Start Metro bundler (connects to existing native build)
npx expo start --ios

# The app will launch in the simulator with hot reload enabled
```

### Selecting a Simulator

```bash
# List available simulators
xcrun simctl list devices available

# Run on specific device
npx expo run:ios --device "iPhone 17 Pro"
```

### Troubleshooting iOS

| Issue | Solution |
|-------|----------|
| Pod install fails | `cd ios && pod deintegrate && pod install` |
| Build fails after Xcode update | `cd ios && rm -rf Pods Podfile.lock && pod install` |
| Simulator won't start | `xcrun simctl shutdown all && xcrun simctl boot "iPhone 17 Pro"` |
| Metro bundler stuck | Kill with `Ctrl+C`, then `npx expo start --clear` |

---

## iOS Automation with Appium (Optional)

For automated UI testing or AI-driven development, set up Appium with XCUITest.

### Install Appium

```bash
# Install Appium globally
npm install -g appium

# Install iOS driver
appium driver install xcuitest

# Verify
appium --version
appium driver list --installed
```

### Start Appium Server

```bash
appium --port 4723
```

### Create Appium Session

```bash
# Get simulator UDID
xcrun simctl list devices booted

# Create session (replace UDID and bundleId)
curl -X POST http://localhost:4723/session \
  -H "Content-Type: application/json" \
  -d '{
    "capabilities": {
      "alwaysMatch": {
        "platformName": "iOS",
        "appium:automationName": "XCUITest",
        "appium:udid": "YOUR-SIMULATOR-UDID",
        "appium:bundleId": "com.yourapp.bundleid",
        "appium:noReset": true
      }
    }
  }'
```

### Common Appium Commands

```bash
SESSION_ID="your-session-id"
BASE_URL="http://localhost:4723/session/$SESSION_ID"

# Take screenshot
curl -s "$BASE_URL/screenshot" | jq -r '.value' | base64 -d > screenshot.png

# Get page source (for finding elements)
curl -s "$BASE_URL/source" | jq -r '.value'

# Find element by accessibility ID
curl -s -X POST "$BASE_URL/element" \
  -H "Content-Type: application/json" \
  -d '{"using": "accessibility id", "value": "Button Text"}'

# Click element
curl -s -X POST "$BASE_URL/element/ELEMENT_ID/click"

# Type text
curl -s -X POST "$BASE_URL/element/ELEMENT_ID/value" \
  -H "Content-Type: application/json" \
  -d '{"text": "your text"}'

# Tap by coordinates
curl -s -X POST "$BASE_URL/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [{
      "type": "pointer",
      "id": "finger1",
      "parameters": {"pointerType": "touch"},
      "actions": [
        {"type": "pointerMove", "duration": 0, "x": 200, "y": 400},
        {"type": "pointerDown", "button": 0},
        {"type": "pause", "duration": 100},
        {"type": "pointerUp", "button": 0}
      ]
    }]
  }'
```

### Appium Tips for AI Agents

- **Get page source first** to find element accessibility IDs
- **Use accessibility ID** over XPath when possible (more stable)
- **Coordinate system**: Appium uses app window coords, not screen coords
- **Element staleness**: Re-find elements after navigation/animations
- **Screenshots**: Use `xcrun simctl io booted screenshot /path/to/file.png` for faster screenshots

---

## Android Development

### Prerequisites

1. **Android Studio** (includes SDK)
   - Download from https://developer.android.com/studio
   - Run setup wizard to install SDK and emulator

2. **Java 17**
   ```bash
   brew install openjdk@17
   ```

3. **Environment Variables** (add to `~/.zshrc` or `~/.bashrc`)
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
   export JAVA_HOME=$(/usr/libexec/java_home -v 17)
   ```

### Create Android Emulator

```bash
# List available system images
sdkmanager --list | grep system-images

# Install a system image (API 34 recommended)
sdkmanager "system-images;android-34;google_apis_playstore;arm64-v8a"

# Create AVD
avdmanager create avd -n Pixel_7_API_34 -k "system-images;android-34;google_apis_playstore;arm64-v8a" -d pixel_7

# List AVDs
emulator -list-avds
```

### Run on Android Emulator

```bash
# Start emulator (in background)
emulator -avd Pixel_7_API_34 &

# Wait for boot, then run app
cd mobile-app
npx expo run:android
```

### Daily Development

```bash
# Start emulator
emulator -avd Pixel_7_API_34 &

# Start Metro with Android
cd mobile-app
npx expo start --android
```

### Troubleshooting Android

| Issue | Solution |
|-------|----------|
| `ANDROID_HOME` not set | Add to shell profile and restart terminal |
| Emulator won't start | Run Android Studio → AVD Manager → Cold Boot |
| Gradle build fails | `cd android && ./gradlew clean` |
| "SDK not found" | Ensure `local.properties` has correct `sdk.dir` |

---

## Running Both Platforms

```bash
# Terminal 1: Start Metro bundler
cd mobile-app
npx expo start

# The bundler shows options:
# › Press a │ open Android
# › Press i │ open iOS simulator
# › Press w │ open web
```

---

## Environment-Specific Notes

### Apple Silicon (M1/M2/M3)

- Android emulator works natively with `arm64-v8a` images
- iOS simulator is native, no Rosetta needed
- Use `arch -arm64` prefix if you have issues with native modules

### CI/CD Considerations

For automated builds without Xcode/Android Studio UI:

```bash
# iOS: Build from command line
xcodebuild -workspace ios/YourApp.xcworkspace \
  -scheme YourApp \
  -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# Android: Build APK
cd android && ./gradlew assembleRelease
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install deps | `cd mobile-app && npm install` |
| iOS first build | `npx expo run:ios` |
| iOS dev mode | `npx expo start --ios` |
| Android first build | `npx expo run:android` |
| Android dev mode | `npx expo start --android` |
| Clear cache | `npx expo start --clear` |
| List iOS simulators | `xcrun simctl list devices available` |
| List Android AVDs | `emulator -list-avds` |
| iOS screenshot | `xcrun simctl io booted screenshot screen.png` |
