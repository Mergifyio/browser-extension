#!/bin/bash

set -e
set -o pipefail

APPLE_TEAM_ID=995U2925WN

inzipfile=$1
outzipfile=${inzipfile%.zip}-signed.zip


unzip $inzipfile -d tmp-safari-sign

cleanup() { rm -rf tmp-safari-sign; }
trap cleanup EXIT

# Sign the app
codesign --deep --force --options runtime --timestamp \
    --sign "Developer ID Application: Mergify ($APPLE_TEAM_ID)" \
    tmp-safari-sign/mergify.app

# Zip the signed app
ditto -c -k --sequesterRsrc --keepParent \
    tmp-safari-sign/mergify.app \
    $outzipfile

# Push the signed zip to Apple
xcrun notarytool submit $outzipfile --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_ID_APP_SPECIFIC_PASSWORD" \
    --wait

# Do Apple verification locally
xcrun stapler staple tmp-safari-sign/mergify.app
