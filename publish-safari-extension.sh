#!/bin/bash

set -e
set -o pipefail

APPLE_TEAM_ID=995U2925WN
APPLE_CONNECT_ISSUER_ID=5f50b8cc-d123-4ae0-817f-33cf0d40f209
APPLE_CONNECT_KEY_ID=ASA5Z72QVK
APPLE_CONNECT_KEY_PATH=private_keys/AuthKey_${APPLE_CONNECT_KEY_ID}.p8

outfile=$1

# Push the signed pkg to Apple
xcrun notarytool submit $outfile \
    --team-id "$APPLE_TEAM_ID" \
    --key "$APPLE_CONNECT_KEY_PATH" \
    --key-id "$APPLE_CONNECT_KEY_ID" \
    --issuer "$APPLE_CONNECT_ISSUER_ID" \
    --wait
xcrun stapler staple $outfile
