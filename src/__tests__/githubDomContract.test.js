// Contract over recorded GitHub DOM eras: for every era directory under
// fixtures/ (github_dom_*), every detector must derive the ground truth its
// manifest.json declares for each captured page. GitHub ships different DOMs
// at once — A/B rollouts on github.com, older generations on GHES — so the
// same invariants run against every recorded generation. Recording a new era
// (see DEVELOPMENT.md) enrolls it here with no test-code changes.
//
// Keep every test body synchronous: importing ../mergify starts the page
// orchestrator (MutationObserver + requestAnimationFrame), and only async
// bodies would let its background work interleave with assertions.
const {
    injectEraFixtureInDOM,
    listEraFixtureFiles,
    listGitHubDomEras,
    loadEraManifest,
} = require("./utils");
const {
    MERGE_BOX_ROW_ATTR,
    getBaseRef,
    injectRowIntoMergeBox,
    isMergeQueueBatchPr,
    isMergifyEnabledOnTheRepo,
    isPullRequestAuthoredByMergify,
    isPullRequestDraft,
    isPullRequestOpen,
    isPullRequestQueued,
    resetQueueState,
    wasMergedByMergify,
} = require("../mergify");

describe.each(listGitHubDomEras())("%s", (era) => {
    const manifest = loadEraManifest(era);

    it("declares exactly the fixture files present in the era directory", () => {
        expect(Object.keys(manifest.pages).sort()).toEqual(
            listEraFixtureFiles(era),
        );
    });

    describe.each(Object.entries(manifest.pages))("%s", (page, expected) => {
        beforeEach(() => {
            localStorage.clear();
            resetQueueState();
            // Benign fetch: the orchestrator's background config lookup must
            // never reject between tests.
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve("<html></html>"),
            });
            // Bypass the pushState patch installed by ../mergify so setting
            // the URL does not itself schedule an injection pass.
            History.prototype.pushState.call(
                window.history,
                {},
                "",
                expected.path,
            );
            injectEraFixtureInDOM(era, page);
        });

        afterEach(() => {
            document.body.innerHTML = "";
            resetQueueState();
            localStorage.clear();
        });

        it(`detects the pull request as ${expected.state}`, () => {
            expect(isPullRequestOpen()).toBe(
                ["open", "draft"].includes(expected.state),
            );
            expect(isPullRequestDraft()).toBe(expected.state === "draft");
        });

        it("detects Mergify from the page alone when the page carries the signal", () => {
            expect(isMergifyEnabledOnTheRepo(false)).toBe(
                expected.mergifyDetectableFromPage,
            );
        });

        it("classifies Mergify authorship and merge-queue batch PRs", () => {
            expect(isPullRequestAuthoredByMergify()).toBe(
                expected.authoredByMergify,
            );
            expect(isMergeQueueBatchPr()).toBe(
                expected.state === "draft" && expected.authoredByMergify,
            );
        });

        it("detects whether Mergify merged the pull request", () => {
            expect(wasMergedByMergify()).toBe(expected.mergedByMergify);
        });

        it("detects whether the pull request is in the merge queue", () => {
            expect(isPullRequestQueued()).toBe(expected.queued);
        });

        it("reads the base branch", () => {
            expect(getBaseRef()).toBe(expected.baseRef);
        });

        it("injects the merge-box row into the era's anchors, idempotently", () => {
            expect(injectRowIntoMergeBox()).toBe(
                expected.mergeBoxRowVariants.length > 0,
            );
            const variants = Array.from(
                document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`),
            ).map((row) => row.getAttribute(MERGE_BOX_ROW_ATTR));
            expect(variants.sort()).toEqual(
                [...expected.mergeBoxRowVariants].sort(),
            );

            injectRowIntoMergeBox();
            expect(
                document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`).length,
            ).toBe(expected.mergeBoxRowVariants.length);
        });
    });
});
