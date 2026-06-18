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
the workflow: it asserts the three assets are present, then exits.
The release is immutable from this point on.

## After publishing (manual)

Publishing does **not** push to the stores or notarize. As today,
once the release is published:

- **Chrome Web Store** — upload `mergify-chrome-<tag>.zip` via the
  Web Store Developer Dashboard.
- **Firefox Add-ons** — upload `mergify-firefox-<tag>.zip` via AMO.
- **Safari** — notarize and staple the pkg:
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

The release is already published and immutable. The assert job only
fails when artifacts are missing — i.e. the release was created
outside the workflow. Delete the release and re-run stage 1 with the
same tag.
