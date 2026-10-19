const { loadFixture } = require("./utils");
const { TextDecoder, TextEncoder } = require("node:util");

// jsdom has neither; the browser the extension runs in has both.
global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder;
const {
    buildMergifyRow,
    fetchQueueState,
    resetQueueState,
    updateAllMergifyRows,
} = require("../queue");
const { parseQueueConditionsPage } = require("../queueConditions");
const { placeQueueConditionsSection } = require("../queueConditionsSection");

const RUN_URL = "/acme/widget/runs/999";
const CHECKS_HTML = `<a href="?check_run_id=999"><span>Mergify Merge Queue</span></a>`;
// One queue rule with two merge protection rules, as the engine's payload
// writes it (see the fixture's header).
const PROTECTIONS_RUN_HTML = loadFixture("mergify_merge_queue_run_payload");
const WAITING_TITLE = "Waiting for queue conditions to match";
const READY_TITLE = "Merge queue is ready";

// A payload condition from a compact spec: a leaf is a string, a group is
// [header, ...children]. "✓" first marks a match; a header is "all of",
// "any of" or "not", with an optional " [note]" for a payload that names its
// groups.
function payloadNode(spec) {
    const head = typeof spec === "string" ? spec : spec[0];
    const match = head.startsWith("✓");
    const text = match ? head.slice(1) : head;
    if (typeof spec === "string")
        return { description: text, match, subconditions: [] };
    const m = /^(all of|any of|not)(?: \[(.*)\])?$/.exec(text);
    const node = {
        description: m ? m[1] : text,
        match,
        subconditions: spec.slice(1).map(payloadNode),
    };
    if (m?.[2]) node.note = m[2];
    return node;
}

function encode(json) {
    const bytes = new TextEncoder().encode(JSON.stringify(json));
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// A check page as GitHub renders it, its summary ending with the payload span.
function checkPage(requiredConditions, { title = WAITING_TITLE } = {}) {
    const payload = {
        version: 1,
        state: "waiting",
        queue_rule_name: null,
        queued_at: null,
        estimated_time_of_merge: null,
        speculative_check_pr: null,
        required_conditions: requiredConditions.map(payloadNode),
    };
    return `<h2>${title}</h2><div class="markdown-body"><p dir="auto">Conditions.</p><p dir="auto"><span itemprop="mergify.v1.${encode(payload)}"></span></p></div>`;
}

const REQUIREMENTS = ["✓-closed", "✓-conflict", "✓-draft"];

// The engine's top level: the "any of" over the queue rules, then the
// requirements every rule shares.
function entry(rules, requirements = REQUIREMENTS) {
    return [["any of", ...rules], ...requirements];
}

const rule = (...items) => ["all of", ...items];

function parsed(requiredConditions) {
    return parseQueueConditionsPage(checkPage(requiredConditions), RUN_URL);
}

function mockCheckRun(runHtml, { runOk = true } = {}) {
    global.fetch = jest.fn((url) => {
        const u = String(url);
        if (u.includes("/checks")) {
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(CHECKS_HTML),
            });
        }
        if (u.includes("/runs/")) {
            return Promise.resolve({
                ok: runOk,
                status: runOk ? 200 : 500,
                text: () => Promise.resolve(runHtml),
            });
        }
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") });
    });
}

describe("parseQueueConditionsPage", () => {
    test("reads the payload span off the check page, as the engine writes it", () => {
        const conditions = parseQueueConditionsPage(
            PROTECTIONS_RUN_HTML,
            RUN_URL,
        );

        expect(conditions.met).toBe(false);
        expect(conditions.runUrl).toBe(RUN_URL);
        expect(conditions.entry).toHaveLength(6);
        const [protectionsCheck, rules] = conditions.entry;
        expect(protectionsCheck).toMatchObject({ op: "or", match: false });
        expect(rules.children[0].children.map((c) => c.label)).toEqual([
            "label = ready-to-queue",
            "all of",
            "all of",
            "base = main",
        ]);
        expect(rules.children[0].children[2].children[1]).toEqual({
            op: "leaf",
            match: true,
            label: "#changes-requested-reviews-by = 0",
            desc: "",
            children: [],
        });
    });

    test("keeps quotes, accents and angle brackets byte for byte", () => {
        const conditions = parsed(entry([rule('label = "prêt" <à> merger')]));

        expect(conditions.entry[0].children[0].children[0].label).toBe(
            'label = "prêt" <à> merger',
        );
    });

    test("reads a group's name when the payload notes it", () => {
        const conditions = parsed([
            [
                "any of [🔀 queue conditions]",
                [
                    "all of [📌 queue conditions of queue rule `default`]",
                    "label = a",
                ],
            ],
        ]);

        expect(conditions.entry[0].desc).toBe("🔀 queue conditions");
    });

    test("without the span, still says the pull request waits", () => {
        expect(
            parseQueueConditionsPage(
                `<h2>${WAITING_TITLE}</h2><div class="markdown-body"><p>…</p></div>`,
                RUN_URL,
            ),
        ).toEqual({ met: false, entry: null, runUrl: RUN_URL });
    });

    test("a span that is not a payload reads as no tree", () => {
        expect(
            parseQueueConditionsPage(
                `<h2>${WAITING_TITLE}</h2><div class="markdown-body"><span itemprop="mergify.v1.%%%"></span></div>`,
                RUN_URL,
            ).entry,
        ).toBeNull();
    });

    test("reads a check that says the queue is ready", () => {
        expect(
            parseQueueConditionsPage(
                checkPage(entry([rule("✓label = a")]), { title: READY_TITLE }),
                RUN_URL,
            ).met,
        ).toBe(true);
    });

    test("ignores the check a dequeued pull request keeps", () => {
        // Its body may quote the waiting step; its title is the dequeue.
        expect(
            parseQueueConditionsPage(
                "<h2>Dequeued — checks failed</h2><p>Waiting for queue conditions was the step before.</p>",
                RUN_URL,
            ),
        ).toBeNull();
        expect(parseQueueConditionsPage(null)).toBeNull();
    });
});

// GitHub's merge box, with the rows it draws itself around ours.
function mergeBox({ checks = true } = {}) {
    document.body.innerHTML = `<div data-testid="mergebox-partial"><div data-testid="mergebox-border-container"><section aria-label="Reviews"></section>${checks ? '<section aria-label="Checks"></section>' : ""}<section aria-label="Merging is blocked"></section><div class="bgColor-muted"></div></div></div>`;
    return document.querySelector('[data-testid="mergebox-border-container"]');
}

const conditionsSection = () =>
    document.querySelector("[data-mergify-conditions-section]");

function rowOrder(container) {
    return Array.from(container.children).map(
        (el) => el.getAttribute("aria-label") ?? el.tagName,
    );
}

describe("merge-box conditions row", () => {
    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        resetQueueState();
    });

    afterEach(() => {
        resetQueueState();
        jest.restoreAllMocks();
    });

    test("goes after GitHub's checks row, before 'Merging is blocked'", async () => {
        const box = mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();

        updateAllMergifyRows();

        expect(rowOrder(box)).toEqual([
            "Reviews",
            "Checks",
            "Queue conditions",
            "Merging is blocked",
            "DIV",
        ]);
    });

    test("without a checks row, goes before 'Merging is blocked'", async () => {
        const box = mergeBox({ checks: false });
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();

        updateAllMergifyRows();

        expect(rowOrder(box)).toEqual([
            "Reviews",
            "Queue conditions",
            "Merging is blocked",
            "DIV",
        ]);
    });

    test("waiting: GitHub's row layout, neutral circle, folded", async () => {
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();

        updateAllMergifyRows();

        const section = conditionsSection();
        expect(section.getAttribute("data-mergify-conditions-section")).toBe(
            "waiting",
        );
        expect(section.querySelector("h3").textContent).toBe(
            "Waiting for queue conditions",
        );
        expect(
            section.querySelector("[data-mergify-conditions-summary]")
                .textContent,
        ).toBe("Some queue conditions are unmet");
        const circle = section.querySelector(".fgColor-onEmphasis");
        expect(circle.classList.contains("bgColor-neutral-emphasis")).toBe(
            true,
        );
        expect(circle.querySelector("svg").getAttribute("class")).toBe(
            "octicon octicon-clock",
        );
        expect(
            section
                .querySelector("[data-mergify-conditions-toggle]")
                .getAttribute("aria-expanded"),
        ).toBe("false");
        const body = section.querySelector("[data-mergify-conditions-body]");
        expect(body.hidden).toBe(true);
        expect(body.textContent).toBe("View details");
    });

    test("met: green check and nothing to unfold", async () => {
        mergeBox();
        mockCheckRun(
            checkPage(entry([rule("✓label = a")]), { title: READY_TITLE }),
        );
        await fetchQueueState();

        updateAllMergifyRows();

        const section = conditionsSection();
        expect(section.querySelector("h3").textContent).toBe(
            "Queue conditions met",
        );
        expect(
            section
                .querySelector(".fgColor-onEmphasis")
                .classList.contains("bgColor-success-emphasis"),
        ).toBe(true);
        expect(
            section.querySelector("[data-mergify-conditions-toggle]"),
        ).toBeNull();
        expect(
            buildMergifyRow("default")
                .querySelector("[data-mergify-queue-btn]")
                .getAttribute("title"),
        ).toBe("Add the pull request to the merge queue");
    });

    test("without a tree on the check, points at the details", async () => {
        mergeBox();
        mockCheckRun(
            `<h2>${WAITING_TITLE}</h2><div class="markdown-body"></div>`,
        );
        await fetchQueueState();
        updateAllMergifyRows();

        const section = conditionsSection();
        expect(
            section.querySelector("[data-mergify-conditions-summary]")
                .textContent,
        ).toBe("Some queue conditions are unmet");
        expect(
            section.querySelector("[data-mergify-conditions-body]").textContent,
        ).toBe("View details");
    });

    test("a click unfolds it, and a rebuild keeps it unfolded", async () => {
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();

        document.querySelector("[data-mergify-conditions-toggle]").click();
        expect(
            document.querySelector("[data-mergify-conditions-body]").hidden,
        ).toBe(false);

        // The conditions move (a review lands) and the row is rebuilt.
        mockCheckRun(checkPage(entry([rule("label = ready-to-queue")])));
        await fetchQueueState();
        updateAllMergifyRows();

        expect(
            document.querySelector("[data-mergify-conditions-body]").hidden,
        ).toBe(false);
    });

    test("remembers nothing: the next pull request starts at its default, nothing stored", async () => {
        const setItem = jest.spyOn(Storage.prototype, "setItem");
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();
        document.querySelector("[data-mergify-conditions-toggle]").click();

        resetQueueState();
        window.history.replaceState({}, "", "/acme/widget/pull/43");
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();

        expect(
            document.querySelector("[data-mergify-conditions-body]").hidden,
        ).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
    });

    test("an unchanged poll touches nothing", async () => {
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();
        document.querySelector("[data-mergify-conditions-toggle]").click();
        await fetchQueueState();

        const mutations = [];
        const observer = new MutationObserver((m) => mutations.push(...m));
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
        });
        updateAllMergifyRows();
        updateAllMergifyRows();
        await Promise.resolve();
        observer.disconnect();

        expect(mutations).toHaveLength(0);
    });

    test("on a merged pull request's box, goes after GitHub's rows, before Mergify's", () => {
        document.body.innerHTML =
            '<div data-testid="mergebox-partial"><div data-testid="mergebox-border-container"><div id="merged">Pull request successfully merged</div><div data-mergify-merge-box-row="default">Mergify</div></div></div>';
        const box = document.querySelector(
            '[data-testid="mergebox-border-container"]',
        );
        const section = document.createElement("section");

        placeQueueConditionsSection(box, section);

        expect(
            Array.from(box.children).map((el) => el.id || el.tagName),
        ).toEqual(["merged", "SECTION", "DIV"]);
    });

    test("goes back in place when GitHub redraws its rows", async () => {
        const box = mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();

        box.appendChild(conditionsSection());
        updateAllMergifyRows();

        expect(rowOrder(box)).toEqual([
            "Reviews",
            "Checks",
            "Queue conditions",
            "Merging is blocked",
            "DIV",
        ]);
    });

    test("leaves once the pull request is queued, or the run can't be read", async () => {
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).not.toBeNull();

        mockCheckRun(`Queued for merge ${PROTECTIONS_RUN_HTML}`);
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).toBeNull();

        resetQueueState();
        mockCheckRun("", { runOk: false });
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).toBeNull();
    });

    test("no row on a closed pull request, even with a waiting status comment", async () => {
        await jest.isolateModulesAsync(async () => {
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () => ({
                    source: "payload",
                    payload: {
                        version: 1,
                        state: "waiting",
                        required_conditions: [],
                    },
                }),
            }));
            const queue = require("../queue");
            const box = mergeBox();
            box.insertAdjacentHTML(
                "beforebegin",
                '<span data-status="pullClosed">Closed</span>',
            );
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();

            queue.updateAllMergifyRows();

            expect(conditionsSection()).toBeNull();
        });
        // doMock outlives isolateModulesAsync: drop it for the next tests.
        jest.dontMock("../mqPayload");
    });

    test("the Mergify row keeps only its buttons, which say they will wait", async () => {
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();

        for (const variant of ["default", "sidebar"]) {
            const row = buildMergifyRow(variant);
            expect(
                row.querySelector("[data-mergify-conditions-tree]"),
            ).toBeNull();
            const btn = row.querySelector("[data-mergify-queue-btn]");
            expect(btn.hasAttribute("disabled")).toBe(false);
            expect(btn.style.backgroundColor).toContain("button-default");
            expect(btn.getAttribute("title")).toContain(
                "enters once its queue conditions match",
            );
        }
    });
});

describe("rich row while the queue request waits", () => {
    // The engine's payload for this state never carries the conditions.
    const WAITING_PAYLOAD = {
        version: 1,
        state: "waiting",
        queue_rule_name: null,
        queued_at: null,
        estimated_time_of_merge: null,
        speculative_check_pr: null,
        required_conditions: [],
    };

    const withPayload = (payload) =>
        jest.doMock("../mqPayload", () => ({
            ...jest.requireActual("../mqPayload"),
            getCurrent: () => ({ source: "payload", payload }),
        }));

    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        resetQueueState();
    });

    afterEach(() => {
        resetQueueState();
        jest.restoreAllMocks();
        jest.dontMock("../mqPayload");
    });

    test("says the conditions are unmet; the merge-box row says it too", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            mergeBox();
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();

            const row = queue.buildRichRow(WAITING_PAYLOAD);
            queue.updateAllMergifyRows();

            // The count is the merge-box row's: this line only says why.
            expect(row.querySelector("[data-mergify-eta]").textContent).toBe(
                "queue conditions not met",
            );
            expect(
                row.querySelector("[data-mergify-conditions-tree]"),
            ).toBeNull();
            expect(
                conditionsSection().querySelector(
                    "[data-mergify-conditions-summary]",
                ).textContent,
            ).toBe("Some queue conditions are unmet");
        });
    });

    test("keeps the generic note when the check says the queue is ready", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            mergeBox();
            mockCheckRun(
                checkPage(entry([rule("✓label = a")]), { title: READY_TITLE }),
            );
            await queue.fetchQueueState();

            queue.updateAllMergifyRows();

            expect(
                queue
                    .buildRichRow(WAITING_PAYLOAD, "sidebar")
                    .querySelector("[data-mergify-eta]").textContent,
            ).toBe("enters the queue once its conditions match");
            expect(conditionsSection()).toBeNull();
        });
    });

    test("offers to cancel the request, and says so while the dequeue is pending", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();

            const button = () =>
                queue
                    .buildRichRow(WAITING_PAYLOAD)
                    .querySelector("[data-mergify-queue-btn]");
            expect(button().textContent).toBe("Cancel queue request");

            // The click's comment lands before the engine rewrites the status
            // comment: a second click would post a second dequeue.
            document.body.insertAdjacentHTML(
                "beforeend",
                '<div class="TimelineItem"><div class="comment-body">@mergifyio dequeue</div></div>',
            );
            expect(button().getAttribute("data-mergify-queue-btn")).toBe(
                "dequeuing",
            );
            expect(button().hasAttribute("disabled")).toBe(true);
        });
    });

    test("offers no command on a closed pull request", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            document.body.innerHTML =
                '<span data-status="pullClosed">Closed</span>';

            const row = queue.buildRichRow(WAITING_PAYLOAD);
            expect(row.querySelector("[data-mergify-queue-btn]")).toBeNull();
            expect(row.textContent).not.toContain("Refresh");
        });
    });

    test("a pull request out of the queue gets the grey add button while unmet", async () => {
        await jest.isolateModulesAsync(async () => {
            const dequeued = { ...WAITING_PAYLOAD, state: "dequeued" };
            withPayload(dequeued);
            const queue = require("../queue");
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();

            const btn = queue
                .buildRichRow(dequeued)
                .querySelector("[data-mergify-queue-btn]");
            expect(btn.textContent).toBe("Add to merge queue");
            expect(btn.style.backgroundColor).toContain("button-default");
        });
    });

    test("re-rendering an unchanged waiting row touches nothing (freeze #34031)", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            const box = mergeBox();
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();
            box.appendChild(queue.buildRichRow(WAITING_PAYLOAD));
            queue.updateAllMergifyRows();
            // A second poll with the same page keeps the same tree.
            await queue.fetchQueueState();

            const mutations = [];
            const observer = new MutationObserver((m) => mutations.push(...m));
            observer.observe(document.body, { childList: true, subtree: true });
            queue.updateAllMergifyRows();
            queue.updateAllMergifyRows();
            await Promise.resolve();
            observer.disconnect();

            expect(mutations).toHaveLength(0);
        });
    });
});
