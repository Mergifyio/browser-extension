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
//
// Parse each page once per describe, never per test: jsdom retains every tree
// it parses (a cleared body does not free it), so memory grows with the number
// of parses, not with the number of pages held at once. Re-injecting a ~500KB
// page for each assertion below costs ~22MB that is never returned, which
// overruns the CI worker's heap as eras accumulate. Only the merge-box test
// mutates the DOM, and it reverts itself in afterEach.
const {
    injectEraFixtureInDOM,
    listEraFixtureFiles,
    listGitHubDomEras,
    loadEraManifest,
} = require("./utils");
const {
    MERGE_BOX_ROW_ATTR,
    deriveQueueButtonState,
    getBaseRef,
    injectRowIntoMergeBox,
    isMergeQueueBatchPr,
    isMergifyEnabledOnTheRepo,
    isPullRequestAuthoredByMergify,
    isPullRequestDraft,
    isPullRequestOpen,
    isPullRequestQueued,
    readPrStatusFromDocument,
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
        beforeAll(() => {
            injectEraFixtureInDOM(era, page);
        });

        afterAll(() => {
            document.body.innerHTML = "";
        });

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
        });

        afterEach(() => {
            // Return the shared page to its recorded state: the merge-box test
            // is the only one that writes to it.
            for (const row of document.querySelectorAll(
                `[${MERGE_BOX_ROW_ATTR}]`,
            )) {
                row.remove();
            }
            resetQueueState();
            localStorage.clear();
        });

        it(`detects the pull request as ${expected.state}`, () => {
            expect(isPullRequestOpen()).toBe(
                ["open", "draft"].includes(expected.state),
            );
            expect(isPullRequestDraft()).toBe(expected.state === "draft");
        });

        it("resolves the data-status pill (null on eras that predate it)", () => {
            expect(readPrStatusFromDocument(document)).toBe(
                expected.dataStatusPillState,
            );
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

        // The rendered outcome of the detectors above: "batch" is what keeps
        // the command buttons off a merge-queue batch PR, where posting a
        // Mergify command would invalidate the running batch.
        it("derives the queue button state the page calls for", () => {
            expect(deriveQueueButtonState()).toBe(expected.queueButtonState);
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
