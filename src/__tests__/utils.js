const fs = require("node:fs");
const path = require("node:path");

const FIXTURES_ROOT = path.resolve(__dirname, "fixtures");

// Root-level fixtures: hand-made fragments (github_pr_mergify_timestamp) and
// non-PR pages (searchConfig*). Full PR pages live in date-stamped era
// directories — see listGitHubDomEras.
function loadFixture(name) {
    const htmlPath = path.join(FIXTURES_ROOT, `${name}.html`);
    return fs.readFileSync(htmlPath, "utf8");
}

function injectFixtureInDOM(name) {
    document.body.innerHTML = loadFixture(name);
}

// Recorded GitHub DOM eras in directory-name order, which runs the
// date-stamped github.com captures oldest first and groups the GHES captures
// after them. An era is a directory named
// github_dom_<suffix> (a github.com capture date like github_dom_2025_02, or
// a GHES capture like github_dom_ghes_3_16) holding sanitized full-page PR
// fixtures plus a manifest.json declaring the ground truth of each page.
// Dropping a newly recorded era directory here enrolls it in the DOM contract
// suite (githubDomContract.test.js) with no test-code changes.
function listGitHubDomEras() {
    return fs
        .readdirSync(FIXTURES_ROOT, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() && entry.name.startsWith("github_dom_"),
        )
        .map((entry) => entry.name)
        .sort();
}

function loadEraManifest(era) {
    const manifestPath = path.join(FIXTURES_ROOT, era, "manifest.json");
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function listEraFixtureFiles(era) {
    return fs
        .readdirSync(path.join(FIXTURES_ROOT, era))
        .filter((name) => name.endsWith(".html"))
        .map((name) => name.replace(/\.html$/, ""))
        .sort();
}

function loadEraFixture(era, page) {
    const htmlPath = path.join(FIXTURES_ROOT, era, `${page}.html`);
    return fs.readFileSync(htmlPath, "utf8");
}

function injectEraFixtureInDOM(era, page) {
    document.body.innerHTML = loadEraFixture(era, page);
}

module.exports = {
    loadFixture,
    injectFixtureInDOM,
    listGitHubDomEras,
    loadEraManifest,
    listEraFixtureFiles,
    loadEraFixture,
    injectEraFixtureInDOM,
};
