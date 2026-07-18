const fs = require("node:fs");
const path = require("node:path");

// GitHub A/B-tests its PR page DOM, so the extension carries selectors for more
// than one era at once. Full-page PR fixtures are kept per capture era under
// github_dom_<era>/ and both are exercised. Pass the era to load one of those;
// fixtures with no era (searchConfig*, the mergify_timestamp fragment) are read
// from the flat fixtures dir.
const LEGACY_ERA = "github_dom_2025_02";
const CURRENT_ERA = "github_dom_2026_07";

function loadFixture(name, era) {
    const rel = era
        ? `./fixtures/${era}/${name}.html`
        : `./fixtures/${name}.html`;
    const htmlPath = path.resolve(__dirname, rel);
    return fs.readFileSync(htmlPath, "utf8");
}

function injectFixtureInDOM(name, era) {
    document.body.innerHTML = loadFixture(name, era);
}

module.exports = {
    loadFixture,
    injectFixtureInDOM,
    LEGACY_ERA,
    CURRENT_ERA,
};
