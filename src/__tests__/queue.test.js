const { formatEta } = require("../queue");

const NOW = new Date("2026-05-29T10:35:00Z").getTime();

describe("formatEta", () => {
    test("returns ~Nm for deltas >= 60s", () => {
        const eta = new Date(NOW + 7 * 60 * 1000).toISOString();
        expect(formatEta(eta, NOW)).toBe("~7m");
    });

    test("rounds minute values", () => {
        const eta = new Date(NOW + 90 * 1000).toISOString();
        expect(formatEta(eta, NOW)).toBe("~2m");
    });

    test("returns ~Ns for deltas in (5s, 60s)", () => {
        const eta = new Date(NOW + 40 * 1000).toISOString();
        expect(formatEta(eta, NOW)).toBe("~40s");
    });

    test('returns "any moment" for deltas in (0, 5s]', () => {
        const eta = new Date(NOW + 3 * 1000).toISOString();
        expect(formatEta(eta, NOW)).toBe("any moment");
    });

    test('returns "overdue by Nm" for negative deltas', () => {
        const eta = new Date(NOW - 2 * 60 * 1000).toISOString();
        expect(formatEta(eta, NOW)).toBe("overdue by 2m");
    });

    test("returns empty string when eta is null", () => {
        expect(formatEta(null, NOW)).toBe("");
    });

    test("returns empty string when eta is invalid", () => {
        expect(formatEta("not a date", NOW)).toBe("");
    });
});

const { formatDurationMinutes } = require("../queue");

describe("formatDurationMinutes", () => {
    test.each([
        [0, "0m"],
        [42, "42m"],
        [59, "59m"],
        [60, "1h"],
        [61, "1h 1m"],
        [822, "13h 42m"], // the case the user hit on PR #522
        [1439, "23h 59m"],
        [1440, "1d"],
        [1500, "1d 1h"],
        [2880, "2d"],
        [-5, "0m"], // clamps negatives
    ])("formats %i minutes as %s", (mins, expected) => {
        expect(formatDurationMinutes(mins)).toBe(expected);
    });

    test("rounds fractional minutes", () => {
        expect(formatDurationMinutes(0.4)).toBe("0m");
        expect(formatDurationMinutes(0.5)).toBe("1m");
        expect(formatDurationMinutes(59.7)).toBe("1h");
    });
});

const {
    renderConditionsBlock,
    buildMergifyRow,
    MERGE_BOX_ROW_ATTR,
} = require("../queue");

function leaf(description, match) {
    return { description, match, subconditions: [] };
}
function group(description, match, subconditions) {
    return { description, match, subconditions };
}

describe("renderConditionsBlock", () => {
    test("returns null for empty array", () => {
        expect(renderConditionsBlock([])).toBeNull();
    });

    test("shows only unmet leaves; met ones are omitted from the rendered list", () => {
        const block = renderConditionsBlock([
            leaf("base=main", true),
            leaf("approved-reviews-by≥1", true),
            leaf("check-success=ci/test", false),
        ]);
        expect(block.querySelector("h4").textContent).toContain(
            "Blocking the merge",
        );
        const rows = block.querySelectorAll("[data-mergify-condition]");
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain("check-success=ci/test");
        expect(rows[0].querySelector(".pending")).not.toBeNull();
    });

    test("when every condition is met, the heading shows an 'all met' marker and no rows are rendered", () => {
        const block = renderConditionsBlock([
            leaf("base=main", true),
            leaf("approved-reviews-by≥1", true),
        ]);
        expect(block.querySelector("h4").textContent).toContain(
            "All required conditions met",
        );
        expect(block.querySelectorAll("[data-mergify-condition]")).toHaveLength(
            0,
        );
    });

    test("heading shows the blocker count when multiple things are blocking", () => {
        const block = renderConditionsBlock([
            leaf("ci/test", false),
            leaf("ci/lint", false),
            leaf("base=main", true),
        ]);
        expect(block.querySelector("h4").textContent).toContain("(2)");
        expect(block.querySelectorAll("[data-mergify-condition]")).toHaveLength(
            2,
        );
    });

    test("met groups are skipped entirely; unmet 'all of' groups flatten transparently", () => {
        // The matching "all of" group should not produce any row; the
        // non-matching "all of" group at the second slot flattens its unmet
        // children directly without a wrapper label.
        const block = renderConditionsBlock([
            group("all of", true, [
                leaf("base=main", true),
                leaf("repo=acme", true),
            ]),
            group("all of", false, [
                leaf("check-success=ci/test", false),
                leaf("check-success=ci/lint", true),
            ]),
        ]);
        const rows = block.querySelectorAll("[data-mergify-condition]");
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain("check-success=ci/test");
    });

    test("unmet 'any of' groups render inline so the disjunction is visible", () => {
        const block = renderConditionsBlock([
            group("any of", false, [
                leaf("label=hotfix", false),
                leaf("urgency=high", false),
            ]),
        ]);
        const rows = block.querySelectorAll("[data-mergify-condition]");
        expect(rows).toHaveLength(1);
        const text = rows[0].textContent;
        expect(text).toContain("any of");
        expect(text).toContain("label=hotfix");
        expect(text).toContain("urgency=high");
    });

    test("met groups don't contribute rows; unmet leaves at top level still appear", () => {
        const block = renderConditionsBlock([
            group("all of", true, [leaf("a", true), leaf("b", true)]),
            leaf("c", false),
        ]);
        const rows = block.querySelectorAll("[data-mergify-condition]");
        expect(rows).toHaveLength(1);
        expect(rows[0].textContent).toContain("c");
    });
});

const { buildRichRow } = require("../queue");

function payload(overrides = {}) {
    return {
        version: 1,
        state: "checking",
        queue_rule_name: "default",
        queued_at: "2026-05-29T10:20:00Z",
        estimated_time_of_merge: "2026-05-29T10:42:00Z",
        speculative_check_pr: 12345,
        required_conditions: [
            { description: "base=main", match: true, subconditions: [] },
        ],
        ...overrides,
    };
}

describe("buildRichRow", () => {
    beforeEach(() => {
        // jsdom doesn't allow replacing window.location; use replaceState to
        // change pathname so getPullRequestData() returns the expected org/repo.
        window.history.replaceState({}, "", "/acme/widget/pull/42");
    });

    afterEach(() => {
        // deriveQueueButtonStateFromPayload reads the page DOM (draft status),
        // so clear it between tests — otherwise a draft span set by one test
        // would leak into the next and flip its expected button state.
        document.body.innerHTML = "";
    });

    test("renders checking state with pill, ETA, draft-PR link, and conditions block", () => {
        const row = buildRichRow(payload({ state: "checking" }));
        expect(row.dataset.mergifyShape).toBe("rich");
        const pill = row.querySelector("[data-mergify-state-pill]");
        expect(pill.textContent).toContain("Checking");
        expect(row.querySelector("[data-mergify-eta]")).not.toBeNull();
        const draft = row.querySelector("[data-mergify-spec-pr]");
        expect(draft.getAttribute("href")).toBe("/acme/widget/pull/12345");
        expect(row.querySelector("[data-mergify-conditions]")).not.toBeNull();
    });

    test("waiting state hides conditions block and shows grey pill", () => {
        const row = buildRichRow(
            payload({ state: "waiting", required_conditions: [] }),
        );
        expect(
            row.querySelector("[data-mergify-state-pill]").textContent,
        ).toContain("Waiting");
        expect(row.querySelector("[data-mergify-conditions]")).toBeNull();
    });

    test("frozen state shows amber pill and surfaces draft-PR link", () => {
        const row = buildRichRow(payload({ state: "frozen" }));
        const pill = row.querySelector("[data-mergify-state-pill]");
        expect(pill.textContent).toContain("Frozen");
        expect(pill.getAttribute("data-state")).toBe("frozen");
        expect(row.querySelector("[data-mergify-spec-pr]")).not.toBeNull();
    });

    test("bisecting state shows red pill and surfaces draft-PR link", () => {
        const row = buildRichRow(payload({ state: "bisecting" }));
        const pill = row.querySelector("[data-mergify-state-pill]");
        expect(pill.textContent).toContain("Bisecting");
        expect(pill.getAttribute("data-state")).toBe("bisecting");
        expect(row.querySelector("[data-mergify-spec-pr]")).not.toBeNull();
    });

    test("merged state hides buttons and shows easter-egg message", () => {
        const row = buildRichRow(
            payload({
                state: "merged",
                required_conditions: [],
                speculative_check_pr: null,
            }),
        );
        expect(row.querySelector("[data-mergify-queue-btn]")).toBeNull();
        expect(row.querySelector("[data-mergify-merged-msg]")).not.toBeNull();
    });

    test("dequeued state shows red pill and add-to-queue button", () => {
        const row = buildRichRow(
            payload({
                state: "dequeued",
                required_conditions: [],
                speculative_check_pr: null,
            }),
        );
        const pill = row.querySelector("[data-mergify-state-pill]");
        expect(pill.textContent).toContain("Dequeued");
        const btn = row.querySelector("[data-mergify-queue-btn]");
        expect(btn.getAttribute("data-mergify-queue-btn")).toBe("unqueued");
    });

    test("draft PR renders a disabled add-to-queue button", () => {
        document.body.innerHTML = '<span data-status="draft">Draft</span>';
        const row = buildRichRow(
            payload({
                state: "dequeued",
                required_conditions: [],
                speculative_check_pr: null,
            }),
        );
        const btn = row.querySelector("[data-mergify-queue-btn]");
        expect(btn.getAttribute("data-mergify-queue-btn")).toBe("draft");
        expect(btn.getAttribute("aria-disabled")).toBe("true");
    });

    test("does not render draft-PR link when speculative_check_pr is null", () => {
        const row = buildRichRow(payload({ speculative_check_pr: null }));
        expect(row.querySelector("[data-mergify-spec-pr]")).toBeNull();
    });

    test("does not render draft-PR link when speculative_check_pr is not a positive integer", () => {
        const row = buildRichRow(
            payload({ speculative_check_pr: "12345; alert(1)" }),
        );
        expect(row.querySelector("[data-mergify-spec-pr]")).toBeNull();
    });
});

const { buildQueueButton } = require("../queue");

describe("buildQueueButton", () => {
    test("draft state is greyed out via aria-disabled, keeps its tooltip, and ignores clicks", () => {
        const btn = buildQueueButton("draft");
        expect(btn.getAttribute("data-mergify-queue-btn")).toBe("draft");
        // aria-disabled (not the `disabled` attribute) so the explanatory
        // title tooltip still shows on hover — disabled controls suppress it.
        expect(btn.getAttribute("aria-disabled")).toBe("true");
        expect(btn.hasAttribute("disabled")).toBe(false);
        expect(btn.getAttribute("title")).toContain("Draft pull requests");
        expect(btn.style.opacity).toBe("0.5");
        expect(btn.style.cursor).toBe("not-allowed");
        expect(btn.textContent).toBe("Add to merge queue");

        // Clicking must not post an @mergifyio queue command.
        const field = document.createElement("input");
        field.id = "new_comment_field";
        document.body.appendChild(field);
        btn.onclick(new MouseEvent("click"));
        expect(field.value).toBe("");
        document.body.innerHTML = "";
    });

    test("unqueued state is an enabled add-to-queue button", () => {
        const btn = buildQueueButton("unqueued");
        expect(btn.getAttribute("data-mergify-queue-btn")).toBe("unqueued");
        expect(btn.hasAttribute("disabled")).toBe(false);
        expect(btn.textContent).toBe("Add to merge queue");
    });

    test("queued state offers a remove button", () => {
        const btn = buildQueueButton("queued");
        expect(btn.getAttribute("data-mergify-queue-btn")).toBe("queued");
        expect(btn.hasAttribute("disabled")).toBe(false);
        expect(btn.textContent).toBe("Remove from merge queue");
    });
});

describe("buildMergifyRow dispatcher", () => {
    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        jest.resetModules();
    });

    test("renders legacy shape when mqPayload has no payload", () => {
        // No payload available → buildLegacyRow path.
        const row = buildMergifyRow();
        expect(row.dataset.mergifyShape).toBe("legacy");
        expect(row.getAttribute(MERGE_BOX_ROW_ATTR)).toBe("default");
    });

    test("renders rich shape when mqPayload has a payload", () => {
        jest.isolateModules(() => {
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () => ({
                    source: "payload",
                    payload: {
                        version: 1,
                        state: "checking",
                        queue_rule_name: null,
                        queued_at: null,
                        estimated_time_of_merge: null,
                        speculative_check_pr: null,
                        required_conditions: [],
                    },
                }),
            }));
            const queue = require("../queue");
            const row = queue.buildMergifyRow();
            expect(row.dataset.mergifyShape).toBe("rich");
            expect(
                row.querySelector("[data-mergify-state-pill]").textContent,
            ).toContain("Checking");
        });
    });

    test("draft PR row swaps its disabled button for an enabled one when the PR becomes ready", () => {
        jest.isolateModules(() => {
            // No engine payload → legacy row path, where draft status drives
            // the button.
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () => null,
            }));
            const queue = require("../queue");

            // Draft PR → legacy row with a greyed (aria-disabled) draft button.
            document.body.innerHTML = '<span data-status="draft">Draft</span>';
            const row = queue.buildMergifyRow();
            document.body.appendChild(row);
            let btn = row.querySelector("[data-mergify-queue-btn]");
            expect(btn.getAttribute("data-mergify-queue-btn")).toBe("draft");
            expect(btn.getAttribute("aria-disabled")).toBe("true");

            // PR marked ready for review → status flips to open.
            document
                .querySelector("span[data-status]")
                .setAttribute("data-status", "pullOpened");
            queue.updateAllMergifyRows();

            btn = row.querySelector("[data-mergify-queue-btn]");
            expect(btn.getAttribute("data-mergify-queue-btn")).toBe("unqueued");
            expect(btn.hasAttribute("aria-disabled")).toBe(false);

            document.body.innerHTML = "";
        });
    });

    test("rows carry MERGE_BOX_ROW_ATTR with the requested variant so multiple instances can coexist", () => {
        const a = buildMergifyRow("default");
        const b = buildMergifyRow("sidebar");
        document.body.appendChild(a);
        document.body.appendChild(b);
        expect(
            document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`),
        ).toHaveLength(2);
        expect(a.getAttribute(MERGE_BOX_ROW_ATTR)).toBe("default");
        expect(b.getAttribute(MERGE_BOX_ROW_ATTR)).toBe("sidebar");
        expect(a.id).toBe(""); // no id collision possible
        expect(b.id).toBe("");
    });
});

describe("updateMergifyRow rich-row idempotency (freeze regression #34031)", () => {
    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        jest.resetModules();
    });

    function mockPayloadState(getState) {
        jest.doMock("../mqPayload", () => ({
            ...jest.requireActual("../mqPayload"),
            getCurrent: () => ({
                source: "payload",
                payload: {
                    version: 1,
                    state: getState(),
                    queue_rule_name: "default",
                    queued_at: "2026-05-29T10:20:00Z",
                    estimated_time_of_merge: "2026-05-29T10:42:00Z",
                    speculative_check_pr: 12345,
                    required_conditions: [],
                },
            }),
        }));
    }

    // The freeze: _tryInject calls updateAllMergifyRows() on every body
    // MutationObserver tick. If the rich path swaps the row's children on each
    // call, replaceChildren is itself a tree mutation → re-fires the observer →
    // self-sustaining rAF loop that pegs the main thread and destroys the row's
    // buttons mid-click. An unchanged payload must be a DOM no-op.
    test("repeated calls with an unchanged payload produce no DOM mutations", () => {
        jest.isolateModules(() => {
            mockPayloadState(() => "checking");
            const queue = require("../queue");
            const row = queue.buildMergifyRow();
            document.body.appendChild(row);
            expect(row.dataset.mergifyShape).toBe("rich");

            const firstChildBefore = row.firstChild;
            // Observe exactly what the body MutationObserver in mergify.js
            // observes; takeRecords() returns synchronously whatever would have
            // re-triggered the loop.
            const observer = new MutationObserver(() => {});
            observer.observe(document.body, { childList: true, subtree: true });

            queue.updateMergifyRow(row);
            queue.updateMergifyRow(row);

            const records = observer.takeRecords();
            observer.disconnect();

            // No tree mutation → the orchestrator's observer would not re-fire.
            expect(records).toHaveLength(0);
            // And the existing buttons survive (a click can complete on them).
            expect(row.firstChild).toBe(firstChildBefore);
        });
    });

    test("still rebuilds when the payload state actually changes", () => {
        jest.isolateModules(() => {
            let state = "checking";
            mockPayloadState(() => state);
            const queue = require("../queue");
            const row = queue.buildMergifyRow();
            document.body.appendChild(row);
            expect(
                row.querySelector("[data-mergify-state-pill]").textContent,
            ).toContain("Checking");

            state = "frozen";
            queue.updateMergifyRow(row);
            expect(
                row.querySelector("[data-mergify-state-pill]").textContent,
            ).toContain("Frozen");
        });
    });
});

const { startEtaTicker, stopEtaTicker } = require("../queue");

describe("ETA ticker", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
    });
    afterEach(() => {
        stopEtaTicker();
        jest.useRealTimers();
    });

    test("updates [data-mergify-eta] text every second while mounted", () => {
        const payload = {
            version: 1,
            state: "checking",
            queue_rule_name: null,
            queued_at: "2026-05-29T10:20:00Z",
            estimated_time_of_merge: new Date(Date.now() + 90000).toISOString(),
            speculative_check_pr: null,
            required_conditions: [],
        };
        const row = buildRichRow(payload);
        document.body.appendChild(row);
        startEtaTicker(payload);
        const meta = row.querySelector("[data-mergify-eta]");
        const before = meta.innerHTML;

        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(1000);
        const after = meta.innerHTML;
        expect(after).not.toBe(before);
    });

    test("stopEtaTicker clears the interval", () => {
        const payload = {
            version: 1,
            state: "checking",
            queue_rule_name: null,
            queued_at: null,
            estimated_time_of_merge: new Date(Date.now() + 60000).toISOString(),
            speculative_check_pr: null,
            required_conditions: [],
        };
        const row = buildRichRow(payload);
        document.body.appendChild(row);
        startEtaTicker(payload);
        stopEtaTicker();
        const meta = row.querySelector("[data-mergify-eta]");
        const before = meta.innerHTML;
        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(2000);
        expect(meta.innerHTML).toBe(before);
    });

    test("stops ticker when the row is removed from the DOM", () => {
        const payload = {
            version: 1,
            state: "checking",
            queue_rule_name: null,
            queued_at: null,
            estimated_time_of_merge: new Date(Date.now() + 90000).toISOString(),
            speculative_check_pr: null,
            required_conditions: [],
        };
        const row = buildRichRow(payload);
        document.body.appendChild(row);
        startEtaTicker(payload);
        const meta = row.querySelector("[data-mergify-eta]");
        row.remove();
        const before = meta.innerHTML;
        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(2000);
        expect(meta.innerHTML).toBe(before);
    });

    test("stopEtaTicker on a row that was removed from the DOM does not keep ticking", () => {
        const payload = {
            version: 1,
            state: "checking",
            queue_rule_name: null,
            queued_at: null,
            estimated_time_of_merge: new Date(Date.now() + 90000).toISOString(),
            speculative_check_pr: null,
            required_conditions: [],
        };
        const richRow = buildRichRow(payload);
        document.body.appendChild(richRow);
        startEtaTicker(payload);
        const meta = richRow.querySelector("[data-mergify-eta]");
        const before = meta.innerHTML;
        // Simulate the row being torn out from under us (shape-flip / SPA nav).
        richRow.remove();
        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(2000);
        // The detached meta should not be updated, and the ticker should
        // self-stop once no rows remain in the document.
        expect(meta.innerHTML).toBe(before);
    });

    test("startEtaTicker is a no-op when payload has no estimated_time_of_merge", () => {
        const payload = {
            version: 1,
            state: "waiting",
            queue_rule_name: null,
            queued_at: null,
            estimated_time_of_merge: null,
            speculative_check_pr: null,
            required_conditions: [],
        };
        const row = buildRichRow(payload);
        document.body.appendChild(row);
        startEtaTicker(payload);
        const meta = row.querySelector("[data-mergify-eta]");
        const before = meta.innerHTML;
        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(2000);
        expect(meta.innerHTML).toBe(before);
    });

    test("regression: ticker updates every mounted row, not just one", () => {
        // The bottom mergebox and the side peek both host a row. A single
        // startEtaTicker call must update [data-mergify-eta] on every one.
        const payload = {
            version: 1,
            state: "checking",
            queue_rule_name: null,
            queued_at: null,
            estimated_time_of_merge: new Date(Date.now() + 90000).toISOString(),
            speculative_check_pr: null,
            required_conditions: [],
        };
        const a = buildRichRow(payload);
        const b = buildRichRow(payload);
        document.body.appendChild(a);
        document.body.appendChild(b);
        startEtaTicker(payload);
        const metaA = a.querySelector("[data-mergify-eta]");
        const metaB = b.querySelector("[data-mergify-eta]");
        const beforeA = metaA.innerHTML;
        const beforeB = metaB.innerHTML;
        jest.setSystemTime(new Date(Date.now() + 60000));
        jest.advanceTimersByTime(1000);
        expect(metaA.innerHTML).not.toBe(beforeA);
        expect(metaB.innerHTML).not.toBe(beforeB);
    });
});

const { scheduleQueueStatePoll, QUEUE_POLL_INTERVAL } = require("../queue");

describe("scheduleQueueStatePoll", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: false, text: () => Promise.resolve("") }),
        );
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test("regression: poll callback runs without ReferenceError (isGitHubPullRequestPage import survives)", async () => {
        // The scheduled callback dereferences isGitHubPullRequestPage from
        // ./dom.js — if the import is dropped (as happened during the
        // PR #494 reconcile) the timer fires a ReferenceError 15s later
        // and the legacy fallback poll is permanently broken.
        scheduleQueueStatePoll();
        await jest.advanceTimersByTimeAsync(QUEUE_POLL_INTERVAL + 100);
        // Pass iff no exception escapes.
    });
});

const {
    getBaseRef,
    isMergeQueueBatchPr,
    getMergeQueueLink,
} = require("../queue");

// Minimal PR-page DOM: a status pill (draft/closed), the header-meta author
// link, and the classic base-ref span. Any argument left undefined is omitted
// so a test can exercise a single missing piece.
function setPrDom({ draft, closed, author, baseRef } = {}) {
    const parts = [];
    if (draft) parts.push('<span class="State" title="Status: Draft"></span>');
    else if (closed)
        parts.push('<span class="State" title="Status: Closed"></span>');
    if (author) {
        const href = author === "mergify" ? "/apps/mergify" : `/${author}`;
        parts.push(
            `<div class="gh-header-meta"><a class="author" href="${href}">${author}</a></div>`,
        );
    }
    if (baseRef) {
        parts.push(
            `<span class="commit-ref css-truncate base-ref" title="acme/widget:${baseRef}"><a href="/acme/widget/tree/${baseRef}">acme:${baseRef}</a></span>`,
        );
    }
    document.body.innerHTML = parts.join("");
}

describe("batch-PR queue link", () => {
    beforeEach(() => {
        // Clear DOM up front too: sibling blocks above leave rows in the body,
        // and a test that reads the DOM without first overwriting it would
        // otherwise inherit stale nodes.
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
    });
    afterEach(() => {
        document.body.innerHTML = "";
    });

    describe("getBaseRef", () => {
        test("reads the branch from the base-ref span title", () => {
            setPrDom({ baseRef: "develop" });
            expect(getBaseRef()).toBe("develop");
        });

        test("keeps slashes in the branch name", () => {
            setPrDom({ baseRef: "release/2.0" });
            expect(getBaseRef()).toBe("release/2.0");
        });

        test("returns null when the base-ref span title is malformed (no colon)", () => {
            document.body.innerHTML =
                '<span class="commit-ref base-ref" title="develop"></span>';
            expect(getBaseRef()).toBeNull();
        });

        test("returns null when no base-ref span is present", () => {
            document.body.innerHTML = "";
            expect(getBaseRef()).toBeNull();
        });
    });

    describe("isMergeQueueBatchPr", () => {
        test("true for a draft PR authored by the Mergify App", () => {
            setPrDom({ draft: true, author: "mergify" });
            expect(isMergeQueueBatchPr()).toBe(true);
        });

        test("false for a draft PR authored by a human", () => {
            setPrDom({ draft: true, author: "octocat" });
            expect(isMergeQueueBatchPr()).toBe(false);
        });

        test("false for a Mergify-authored PR that is not a draft (e.g. config update)", () => {
            setPrDom({ author: "mergify" });
            expect(isMergeQueueBatchPr()).toBe(false);
        });
    });

    describe("getMergeQueueLink", () => {
        test("deep-links to the batch peek drawer via batch_pr, using the base ref as branch", () => {
            setPrDom({ draft: true, author: "mergify", baseRef: "develop" });
            expect(getMergeQueueLink()).toBe(
                "https://dashboard.mergify.com/orgs/acme/repos/widget/queues/status?branch=develop&batch_pr=42",
            );
        });

        test("url-encodes a slashed base ref in the branch param", () => {
            setPrDom({
                draft: true,
                author: "mergify",
                baseRef: "release/2.0",
            });
            expect(getMergeQueueLink()).toContain("branch=release%2F2.0");
            expect(getMergeQueueLink()).toContain("batch_pr=42");
        });

        test("omits branch (dashboard falls back) when the base ref can't be read", () => {
            setPrDom({ draft: true, author: "mergify" });
            expect(getMergeQueueLink()).toBe(
                "https://dashboard.mergify.com/orgs/acme/repos/widget/queues/status?batch_pr=42",
            );
        });

        test("non-batch PR keeps the branch-scoped queue link", () => {
            setPrDom({ baseRef: "develop" });
            expect(getMergeQueueLink()).toBe(
                "https://dashboard.mergify.com/orgs/acme/repos/widget/queues?branch=main&pull-request-number=42",
            );
        });
    });
});

const { deriveQueueButtonState } = require("../queue");

function commandButtonsOf(row) {
    return [...row.querySelectorAll("button")].filter(
        (b) => !b.hasAttribute("data-mergify-queue-btn"),
    );
}

describe("batch-PR row treatment", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
    });
    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("deriveQueueButtonState returns 'batch' for an open batch PR", () => {
        setPrDom({ draft: true, author: "mergify", baseRef: "main" });
        expect(deriveQueueButtonState()).toBe("batch");
    });

    test("renders no queue or command buttons at all (legacy shape)", () => {
        jest.isolateModules(() => {
            // Pin the legacy path: a mqPayload mock left behind by an earlier
            // suite would otherwise leak a rich payload into this row.
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () => null,
            }));
            const queue = require("../queue");
            setPrDom({ draft: true, author: "mergify", baseRef: "main" });
            for (const variant of ["default", "sidebar"]) {
                const row = queue.buildMergifyRow(variant);
                expect(row.querySelectorAll("button").length).toBe(0);
                // The row stays informational: the queue link is still there.
                const links = [...row.querySelectorAll("a")].map((a) =>
                    a.textContent.trim(),
                );
                expect(links).toContain("queue");
            }
        });
    });

    test("renders no queue or command buttons at all (rich shape)", () => {
        jest.isolateModules(() => {
            // A "checking" payload maps to the queued (dequeue) button on a
            // normal PR — the strongest case that batch must override it.
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () => ({
                    source: "payload",
                    payload: { state: "checking" },
                }),
            }));
            const queue = require("../queue");
            setPrDom({ draft: true, author: "mergify", baseRef: "main" });
            for (const variant of ["default", "sidebar"]) {
                const row = queue.buildMergifyRow(variant);
                expect(row.dataset.mergifyShape).toBe("rich");
                expect(row.querySelectorAll("button").length).toBe(0);
                // The row stays informational: the queue link is still there.
                const links = [...row.querySelectorAll("a")].map((a) =>
                    a.textContent.trim(),
                );
                expect(links).toContain("queue");
            }
        });
    });

    test("a normal draft PR keeps its queue and command buttons", () => {
        setPrDom({ draft: true, author: "octocat", baseRef: "main" });
        const row = buildMergifyRow();
        expect(row.querySelector("[data-mergify-queue-btn]")).not.toBeNull();
        const buttons = commandButtonsOf(row);
        expect(buttons.map((b) => b.textContent)).toEqual([
            "Refresh",
            "Rebase",
            "Update",
        ]);
        for (const b of buttons) {
            expect(b.hasAttribute("aria-disabled")).toBe(false);
        }
    });
});

describe("batch-PR informational links", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
    });
    afterEach(() => {
        document.body.innerHTML = "";
    });

    // The informational-link labels ("queue"/"logs"), excluding the Mergify
    // brand anchor (whose textContent carries the inlined logo SVG).
    function linkLabels(row) {
        return [...row.querySelectorAll("a")]
            .map((a) => a.textContent.trim())
            .filter((t) => t === "queue" || t === "logs");
    }
    function hrefOf(row, label) {
        return [...row.querySelectorAll("a")]
            .find((a) => a.textContent.trim() === label)
            ?.getAttribute("href");
    }

    const BATCH_ACTIVITY_LOG_HREF =
        "https://dashboard.mergify.com/orgs/acme/repos/widget/activity-log?batch_pull=42&preset=Past1month";

    test("open batch PR: queue link deep-links via batch_pr, logs link via batch_pull", () => {
        setPrDom({ draft: true, author: "mergify", baseRef: "develop" });
        const row = buildMergifyRow();
        expect(linkLabels(row)).toEqual(["queue", "logs"]);
        expect(hrefOf(row, "queue")).toBe(
            "https://dashboard.mergify.com/orgs/acme/repos/widget/queues/status?branch=develop&batch_pr=42",
        );
        expect(hrefOf(row, "logs")).toBe(BATCH_ACTIVITY_LOG_HREF);
    });

    test("closed batch PR: no queue link, logs link via batch_pull", () => {
        setPrDom({ closed: true, author: "mergify" });
        const row = buildMergifyRow();
        expect(linkLabels(row)).toEqual(["logs"]);
        expect(hrefOf(row, "logs")).toBe(BATCH_ACTIVITY_LOG_HREF);
    });

    test("open non-batch PR keeps both the queue and per-PR activity-log links", () => {
        setPrDom({ author: "octocat", baseRef: "develop" });
        const row = buildMergifyRow();
        expect(linkLabels(row)).toEqual(["queue", "logs"]);
        expect(hrefOf(row, "queue")).toContain("pull-request-number=42");
        expect(hrefOf(row, "logs")).toBe(
            "https://dashboard.mergify.com/orgs/acme/repos/widget/activity-log?pull_request=42&preset=Past1month",
        );
    });

    test("closed human PR is unaffected — keeps both links", () => {
        setPrDom({ closed: true, author: "octocat" });
        const row = buildMergifyRow();
        expect(linkLabels(row)).toEqual(["queue", "logs"]);
    });
});
