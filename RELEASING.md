# Releasing the browser extension

Two-stage flow keyed off the immutable-releases policy on
`Mergifyio/*` — once a release is published, its asset list is
locked. So the firefox/chrome/safari artifacts are attached to the
release **as a draft**, before the maintainer clicks Publish.

Versions are explicit semver (`X.Y.Z`). The web stores need
monotonic version numbers, so pick the next version by hand; there
is no auto-compute.

## Stage 1 — build the draft

1. Go to **Actions** → **Release** → **Run workflow** (top right of
   the workflow page).
2. Enter **tag**: the semver version to release, e.g. `1.4.2`. It is
   used as the git tag, the release title, and the `VERSION` stamped
   into the build (artifact names and manifest).
3. Leave **target_commitish** empty unless you're cherry-picking a
   release commit off an older branch.
4. Click **Run workflow**.

The workflow builds and signs the three artifacts on `macos-15`
(Xcode is needed for the Safari `.pkg`) and runs
`gh release create <tag> --draft --generate-notes` to create the
release with the assets attached and notes auto-generated from PRs
merged since the previous tag. Takes ~10 minutes.

## Stage 2 — review and publish

1. Go to **Releases** → the new draft.
2. Review the auto-generated notes; edit if needed (drafts are
   mutable).
3. Confirm all three asset names are listed:
   - `mergify-firefox-<tag>.zip`
   - `mergify-chrome-<tag>.zip`
   - `mergify-safari-<tag>.pkg`
4. Click **Publish release**.

Publishing fires `release: published`, which runs the second half of
the workflow. It first asserts the three assets are present, then
pushes those exact reviewed bytes to the three stores from three
independent jobs (no rebuild). The release is immutable from this
point on.

## What publishing pushes to the stores

The store jobs run only on Publish (never on the draft stage) and
only for full releases — a release marked **pre-release** is skipped,
so you can stage one without shipping it to the stores.

- **Chrome Web Store** — `chrome-webstore-upload-cli` uploads
  `mergify-chrome-<tag>.zip` and publishes it immediately.
- **Firefox Add-ons (AMO)** — `web-ext sign --channel listed` submits
  `mergify-firefox-<tag>.zip` to Mozilla's review queue. The job exits
  as soon as the version is queued; Mozilla approval is asynchronous
  and happens later on AMO. (web-ext can only sign a source directory,
  so the job unzips the reviewed asset and web-ext repackages the same
  files: identical contents, fresh archive container.)
- **Safari** — `publish-safari-extension.sh` notarizes the pkg with
  `notarytool --wait` and staples it. **Tradeoff:** notarization runs
  *after* Publish, so the stapled pkg can't replace the asset already
  attached to the now-immutable release. The GitHub `.pkg` stays
  unstapled; what persists is the Apple-side notarization (Gatekeeper
  verifies it via an online check, so the unstapled pkg still passes
  on a machine with network access). Stapling here is only a no-op
  belt-and-suspenders.

The three jobs are independent: if one store fails (e.g. an expired
token, a rejected version), the others still ship and the failed job
goes red so you know exactly which store to retry. To retry a single
store after a fix, re-run that one job from the Actions run.

## Required store secrets

These are repo **Actions secrets** (Settings → Secrets and variables →
Actions). The release won't reach a store until its secrets are set;
a missing secret just fails that one store's job.

| Secret | Used by | What it is |
| --- | --- | --- |
| `BROWSER_EXT_GOOGLE_EXTENSION_ID` | Chrome | The extension's ID in the Web Store. |
| `BROWSER_EXT_GOOGLE_CLIENT_ID` | Chrome | OAuth2 client ID for the Web Store API. |
| `BROWSER_EXT_GOOGLE_CLIENT_SECRET` | Chrome | OAuth2 client secret. |
| `BROWSER_EXT_GOOGLE_REFRESH_TOKEN_SILEHT` | Chrome | OAuth2 refresh token for the publishing account. |
| `BROWSER_EXT_MOZILLA_ISSUER` | Firefox | AMO API key (JWT issuer), from addons.mozilla.org → Manage API Keys. |
| `BROWSER_EXT_MOZILLA_JWT_SECRET` | Firefox | AMO API secret (JWT secret) for that key. |
| `BROWSER_EXT_APPLE_CONNECT_KEY_P8` | Safari | Base64 of the App Store Connect API key `AuthKey_ASA5Z72QVK.p8`. Generate with `base64 -i AuthKey_ASA5Z72QVK.p8 \| pbcopy`. |

The Apple **signing** secrets used by stage 1 (`APPLE_CERTIFICATE_P12`,
`APPLE_CERTIFICATE_PASSWORD`) are unchanged. The team id, issuer id and
key id are hardcoded in `publish-safari-extension.sh`; only the `.p8`
key itself comes from the secret above.

## Manual fallback

If you need to push a store by hand (e.g. a job is red and you'd
rather not re-run it), the original manual paths still work:

- **Chrome Web Store** — upload `mergify-chrome-<tag>.zip` via the
  Web Store Developer Dashboard.
- **Firefox Add-ons** — upload `mergify-firefox-<tag>.zip` via AMO.
- **Safari** — notarize and staple the pkg locally:
  ```
  ./publish-safari-extension.sh ./mergify-safari-<tag>.pkg
  ```

## Do not

- **Don't click "Draft a new release" in the Releases UI.** That
  path creates a draft without the build artifacts; once you publish
  it the release is immutable and the stage-2 assertion will fail. To
  recover you'd have to delete the release and re-run stage 1 with the
  same tag.
- **Don't run `gh release create` from your laptop.** The workflow
  does this so the artifacts are built and signed reproducibly on CI.

## If stage 2 fails

The release is already published and immutable, so what you do depends
on *which* job went red.

- **`assert artifacts attached` failed** — the release has no build
  artifacts, i.e. it was created outside the workflow (e.g. straight
  from the Releases UI). The store jobs are gated on this assert, so
  they didn't run. Delete the release and re-run stage 1 with the same
  tag.
- **A store job failed** (`publish to Chrome Web Store`, `publish to
  Firefox Add-ons (AMO)`, `notarize and staple the Safari pkg`) — the
  release itself is fine; only that one store didn't get the new
  version. Usually a bad/expired secret or a store-side rejection. Fix
  the cause, then **re-run just that job** from the Actions run (or use
  the manual fallback above). Do **not** delete the release — the other
  stores already shipped and the bytes are immutable.
