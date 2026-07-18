const { injectFixtureInDOM, LEGACY_ERA, CURRENT_ERA } = require("./utils");
const {
    isPullRequestOpen,
    isPullRequestDraft,
    wasMergedByMergify,
} = require("../queue.js");

const APP_AVATAR = 'img[src^="https://avatars.githubusercontent.com/in/10562"]';
const isMergifyAppShown = () => document.querySelector(APP_AVATAR) !== null;

// GitHub A/B-tests its PR page markup, so the extension's detection spans DOM
// eras (legacy span.State / .gh-header-meta beside current data-status / React
// header). The same checks run against every recorded era so a regression on
// either path fails here. The two eras were captured from different PRs, so a
// fixture's exact state can differ across eras — hence per-era expected values.
// isPullRequestOpen / isPullRequestDraft are the dual-selector functions this
// most directly exercises.
const EXPECTED = {
    [LEGACY_ERA]: {
        github_pr_opened: {
            open: true,
            draft: true,
            merged: false,
            mergify: true,
        },
        github_pr_merged: {
            open: false,
            draft: false,
            merged: false,
            mergify: false,
        },
        github_pr_no_timeline_actions: {
            open: true,
            draft: true,
            merged: false,
            mergify: true,
        },
        github_pr_no_mergify: {
            open: true,
            draft: false,
            merged: false,
            mergify: false,
        },
    },
    [CURRENT_ERA]: {
        github_pr_opened: {
            open: true,
            draft: false,
            merged: false,
            mergify: true,
        },
        github_pr_merged: {
            open: false,
            draft: false,
            merged: true,
            mergify: true,
        },
        github_pr_no_timeline_actions: {
            open: false,
            draft: false,
            merged: false,
            mergify: false,
        },
        github_pr_no_mergify: {
            open: true,
            draft: false,
            merged: false,
            mergify: false,
        },
    },
};

describe.each([
    LEGACY_ERA,
    CURRENT_ERA,
])("fixture DOM detection — %s", (era) => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    test.each(Object.keys(EXPECTED[era]))("%s", (name) => {
        injectFixtureInDOM(name, era);
        const exp = EXPECTED[era][name];
        expect(isPullRequestOpen()).toBe(exp.open);
        expect(isPullRequestDraft()).toBe(exp.draft);
        expect(wasMergedByMergify()).toBe(exp.merged);
        expect(isMergifyAppShown()).toBe(exp.mergify);
    });
});
