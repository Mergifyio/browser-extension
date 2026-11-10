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
// overruns the CI worker's heap as eras accumulate. Only the merge-box and
// command-posting tests mutate the DOM, and both revert what they change.
const {
    injectEraFixtureInDOM,
    listEraFixtureFiles,
    listGitHubDomEras,
    loadEraManifest,
} = require("./utils");
const {
    MERGE_BOX_ROW_ATTR,
    OVERVIEW_CARD_ATTR,
    deriveQueueButtonState,
    findCommentComposer,
    getBaseRef,
    injectRowIntoMergeBox,
    isMergeQueueBatchPr,
    isMergifyEnabledOnTheRepo,
    isPullRequestAuthoredByMergify,
    isPullRequestDraft,
    isPullRequestOpen,
    isPullRequestQueued,
    postCommand,
    readPrStatusFromDocument,
    resetQueueState,
    wasMergedByMergify,
} = require("../mergify");
const { findLatestStatusCommentSync } = require("../mqPayload");

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
                `[${MERGE_BOX_ROW_ATTR}], [${OVERVIEW_CARD_ATTR}]`,
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

        // The reader behind isPullRequestOpen/isPullRequestDraft. It must
        // resolve the real state on every era, not just the one carrying
        // data-status.
        it("reads the pull request state from the page scope", () => {
            expect(readPrStatusFromDocument(document)).toBe(expected.state);
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

        // GitHub rarely materializes a comment's edit textarea, so the payload
        // poll usually picks the comment to fetch from the rendered timeline:
        // the latest status report, by its heading, else the latest Mergify
        // comment it can fetch.
        it("picks the status comment the payload poll fetches", () => {
            const textareas = Array.from(
                document.querySelectorAll("textarea"),
                (ta) => [ta, ta.parentNode, ta.nextSibling],
            );
            for (const [ta] of textareas) ta.remove();
            try {
                expect(findLatestStatusCommentSync()?.commentId ?? null).toBe(
                    expected.statusCommentId,
                );
            } finally {
                for (const [ta, parent, next] of textareas.reverse()) {
                    parent.insertBefore(ta, next);
                }
            }
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

        // Every command button posts through the page's new-comment composer;
        // without one, a click silently posts nothing.
        it("posts a command through the page's comment composer", () => {
            const composer = findCommentComposer();
            if (!expected.postsCommand) {
                expect(composer).toBeNull();
                expect(postCommand("refresh")).toBe(false);
                return;
            }
            expect(composer).not.toBeNull();
            const { field, submit } = composer;
            const recorded = {
                value: field.value,
                fieldDisabled: field.getAttribute("disabled"),
                submitDisabled: submit.getAttribute("disabled"),
            };
            const inputs = [];
            const clicks = [];
            const onInput = (event) => inputs.push(event.target);
            // Capture phase, default prevented: jsdom must not submit the
            // classic form.
            const onClick = (event) => {
                clicks.push(event.target);
                event.preventDefault();
            };
            document.addEventListener("input", onInput, true);
            document.addEventListener("click", onClick, true);
            try {
                expect(postCommand("refresh")).toBe(true);
                expect(field.value).toBe("@mergifyio refresh");
                expect(inputs).toEqual([field]);
                expect(clicks).toEqual([submit]);
            } finally {
                document.removeEventListener("input", onInput, true);
                document.removeEventListener("click", onClick, true);
                field.value = recorded.value;
                for (const [el, disabled] of [
                    [field, recorded.fieldDisabled],
                    [submit, recorded.submitDisabled],
                ]) {
                    if (disabled !== null)
                        el.setAttribute("disabled", disabled);
                }
            }
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
