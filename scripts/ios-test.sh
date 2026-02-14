#!/bin/bash
# ZapArc Mobile - iOS Build & Test Script
# Usage: ./ios-test.sh [build|test|full]

set -e

PROJECT_DIR="/Users/bvg/Repositories/ZapArc_Mobile/mobile-app"
BUNDLE_ID="com.zaparcmobile.mobileapp"
SIMULATOR="iPhone 17 Pro"
APPIUM_PORT=4723
SCREENSHOTS_DIR="$PROJECT_DIR/../test-screenshots"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[ZapArc]${NC} $1"; }
warn() { echo -e "${YELLOW}[ZapArc]${NC} $1"; }
error() { echo -e "${RED}[ZapArc]${NC} $1"; }

# Get booted simulator UDID
get_simulator_udid() {
    xcrun simctl list devices booted --json | python3 -c "
import sys,json
d=json.load(sys.stdin)
devs=[x for v in d['devices'].values() for x in v if x['state']=='Booted']
print(devs[0]['udid'] if devs else '')
"
}

# Start Appium if not running
start_appium() {
    if ! curl -s http://localhost:$APPIUM_PORT/status > /dev/null 2>&1; then
        log "Starting Appium server..."
        appium --port $APPIUM_PORT --relaxed-security --session-override \
               --default-capabilities '{"appium:newCommandTimeout": 300}' &
        sleep 5
    else
        log "Appium already running"
    fi
}

# Create Appium session
create_session() {
    local UDID=$(get_simulator_udid)
    if [ -z "$UDID" ]; then
        error "No booted simulator found"
        exit 1
    fi
    
    log "Creating Appium session for $UDID..."
    SESSION=$(curl -s -X POST http://localhost:$APPIUM_PORT/session \
        -H "Content-Type: application/json" \
        -d "{
            \"capabilities\": {
                \"alwaysMatch\": {
                    \"platformName\": \"iOS\",
                    \"appium:automationName\": \"XCUITest\",
                    \"appium:udid\": \"$UDID\",
                    \"appium:bundleId\": \"$BUNDLE_ID\",
                    \"appium:noReset\": true,
                    \"appium:newCommandTimeout\": 300
                }
            }
        }" | python3 -c "import sys,json; print(json.load(sys.stdin)['value']['sessionId'])")
    
    echo "$SESSION"
}

# Find element by various strategies
find_element() {
    local SESSION=$1
    local STRATEGY=$2
    local VALUE=$3
    
    curl -s -X POST "http://localhost:$APPIUM_PORT/session/$SESSION/element" \
        -H "Content-Type: application/json" \
        -d "{\"using\": \"$STRATEGY\", \"value\": \"$VALUE\"}" | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d['value']['ELEMENT'] if 'value' in d and d['value'] and 'ELEMENT' in d['value'] else '')"
}

# Click element
click_element() {
    local SESSION=$1
    local ELEMENT=$2
    
    curl -s -X POST "http://localhost:$APPIUM_PORT/session/$SESSION/element/$ELEMENT/click" \
        -H "Content-Type: application/json" -d '{}'
}

# Take screenshot
screenshot() {
    local NAME=$1
    mkdir -p "$SCREENSHOTS_DIR"
    xcrun simctl io booted screenshot "$SCREENSHOTS_DIR/${NAME}-$(date +%H%M%S).png"
    log "Screenshot: $NAME"
}

# Build iOS app
build_ios() {
    log "Building iOS app..."
    cd "$PROJECT_DIR"
    
    export LANG=en_US.UTF-8
    export LC_ALL=en_US.UTF-8
    
    # Run prebuild if ios folder doesn't exist
    if [ ! -d "ios" ]; then
        log "Running expo prebuild..."
        npx expo prebuild --platform ios --no-install
    fi
    
    # Install pods
    log "Installing CocoaPods..."
    cd ios && pod install && cd ..
    
    # Build and run
    log "Building and launching..."
    npx expo run:ios --device "$SIMULATOR"
}

# Test: Create new wallet
test_create_wallet() {
    log "Testing: Create New Wallet flow"
    local SESSION=$(create_session)
    
    if [ -z "$SESSION" ]; then
        error "Failed to create session"
        return 1
    fi
    
    log "Session: $SESSION"
    screenshot "01-start"
    
    # Step 1: Tap "Create New Wallet"
    log "Step 1: Tapping Create New Wallet..."
    local BTN=$(find_element "$SESSION" "accessibility id" "Create New Wallet")
    if [ -n "$BTN" ]; then
        click_element "$SESSION" "$BTN"
        sleep 2
        screenshot "02-create-wallet"
    else
        warn "Create New Wallet button not found (might already have wallet)"
        screenshot "02-existing-state"
        return 0
    fi
    
    # Step 2: Generate Recovery Phrase
    log "Step 2: Generating recovery phrase..."
    local GEN=$(find_element "$SESSION" "accessibility id" "Generate Recovery Phrase")
    if [ -n "$GEN" ]; then
        click_element "$SESSION" "$GEN"
        sleep 2
        screenshot "03-phrase-generated"
    fi
    
    # Step 3: Check "I have written down" and Continue
    log "Step 3: Confirming backup..."
    local CHECK=$(find_element "$SESSION" "accessibility id" "I have written down my recovery phrase")
    if [ -n "$CHECK" ]; then
        click_element "$SESSION" "$CHECK"
        sleep 0.5
    fi
    
    local CONT=$(find_element "$SESSION" "xpath" "//XCUIElementTypeButton[@name='button']")
    if [ -n "$CONT" ]; then
        click_element "$SESSION" "$CONT"
        sleep 2
        screenshot "04-verify-phrase"
    fi
    
    log "Test complete - manual verification needed for Step 3 onwards"
    screenshot "05-final"
    
    # Cleanup session
    curl -s -X DELETE "http://localhost:$APPIUM_PORT/session/$SESSION"
    
    log "Screenshots saved to: $SCREENSHOTS_DIR"
}

# Main
case "${1:-full}" in
    build)
        build_ios
        ;;
    test)
        start_appium
        test_create_wallet
        ;;
    full)
        build_ios
        start_appium
        sleep 5
        test_create_wallet
        ;;
    *)
        echo "Usage: $0 [build|test|full]"
        exit 1
        ;;
esac

log "Done!"
