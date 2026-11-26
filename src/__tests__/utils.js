const fs = require("node:fs");
const path = require("node:path");

const FIXTURES_ROOT = path.resolve(__dirname, "fixtures");

// Root-level fixtures: hand-made fragments (github_pr_mergify_comment) and
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

// GitHub's rendering of a comment opening on the mention of Mergify's account
// (POST /markdown, gfm), after `lead` if any.
const renderedCommand = (command, lead = "") =>
    `<p dir="auto">${lead}<a class="user-mention notranslate" data-hovercard-type="organization" data-hovercard-url="/orgs/Mergifyio/hovercard" href="https://github.com/Mergifyio">@Mergifyio</a> ${command}</p>`;

// The report the engine rewrites a cancelled queue request into, on a
// repository without the queue's checkbox controls, as GitHub renders it: 85
// characters naming the command, no payload, and never a 👍 (MRGFY-13536).
const CANCELLED_REPORT_HTML = `<h3 dir="auto">🛑 Queue command cancelled</h3>
<p dir="auto"><strong>Hint</strong></p>
<p dir="auto">To request it again, post a <code class="notranslate">@mergifyio queue</code> comment.</p>`;

// A comment as the classic view renders it: its issuecomment-<id> on the
// group holding its author link, body and reactions.
function classicComment({ id, body, author = "/someuser", thumbsUp = false }) {
    return `
        <div class="TimelineItem js-comment-container">
            <div id="issuecomment-${id}" class="timeline-comment-group">
                <a class="author Link--primary" href="${author}">${author}</a>
                <div class="comment-body markdown-body">${body}</div>
                ${thumbsUp ? '<button class="social-reaction-summary-item" value="THUMBS_UP react">1</button>' : ""}
            </div>
        </div>`;
}

// The same comment on GitHub's Overview page (2026-11): its id on its
// <article>, the author link marked by a test id, the body a bare
// .markdown-body, and each reaction a button labelled with its emoji and count.
function overviewComment({ id, body, author = "/someuser", thumbsUp = false }) {
    return `
        <div data-testid="timeline-item"><div><article id="issuecomment-${id}">
            <a data-testid="avatar-link" href="${author}">${author}</a>
            <div class="markdown-body">${body}</div>
            ${thumbsUp ? '<button aria-label="👍 1 reaction">👍 1</button>' : ""}
        </article></div></div>`;
}

module.exports = {
    loadFixture,
    injectFixtureInDOM,
    listGitHubDomEras,
    loadEraManifest,
    listEraFixtureFiles,
    loadEraFixture,
    injectEraFixtureInDOM,
    renderedCommand,
    CANCELLED_REPORT_HTML,
    classicComment,
    overviewComment,
};
