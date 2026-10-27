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
const {
    conditionMark,
    parseQueueConditionsPage,
    readCheckStates,
} = require("../queueConditions");
const { placeQueueConditionsSection } = require("../queueConditionsSection");
const {
    MAX_TREE_ROWS,
    buildQueueConditionsTree,
    conditionsVerdict,
    humanCondition,
} = require("../queueConditionsTree");

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

function parsed(requiredConditions, checkStates = {}) {
    const conditions = parseQueueConditionsPage(
        checkPage(requiredConditions),
        RUN_URL,
    );
    conditions.checkStates = checkStates;
    return conditions;
}

function mockCheckRun(runHtml, { runOk = true, statusChecks = [] } = {}) {
    global.fetch = jest.fn((url) => {
        const u = String(url);
        if (u.includes("/page_data/status_checks")) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ statusChecks }),
            });
        }
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

// Every row of the unfolded tree as "<kind> <mark> <text>", in order.
function treeRows(container) {
    return Array.from(
        container.querySelectorAll(
            "[data-mergify-tree-rule], [data-mergify-tree-group], [data-mergify-tree-leaf], [data-mergify-tree-met], [data-mergify-tree-more]",
        ),
    ).map((el) => {
        const mark = el.querySelector("[data-mark]")?.getAttribute("data-mark");
        if (el.hasAttribute("data-mergify-tree-rule")) {
            const name = el.getAttribute("data-mergify-tree-rule");
            const closest = el.querySelector("[data-mergify-tree-closest]")
                ? " (closest)"
                : "";
            const missing = el.querySelector("[data-mergify-tree-missing]");
            return `rule ${mark}${name ? ` ${name}` : ""}${closest}${missing ? ` · ${missing.textContent}` : ""}`;
        }
        if (el.hasAttribute("data-mergify-tree-group")) {
            const pill = el.querySelector("[data-mergify-tree-pill]");
            return `group ${el.getAttribute("data-mergify-tree-group")} ${mark} ${pill.firstChild.textContent} ${pill.lastChild.textContent}`;
        }
        if (el.hasAttribute("data-mergify-tree-met"))
            return `met ${el.textContent}`;
        if (el.hasAttribute("data-mergify-tree-more"))
            return `more ${el.querySelector("button").textContent}`;
        return `leaf ${mark} ${el.textContent}`;
    });
}

// The tree the recorded fixture page carries, with the docs check running.
// Its payload names no group, so the protections' conditions read as the
// rule's own, and the requirement on their check says they exist.
const PROTECTIONS_TREE = [
    "leaf todo Merge protections pass",
    "rule todo",
    "leaf todo Labeled ready-to-queue",
    "leaf running CI · docs",
    "leaf todo Labeled changelog",
    "leaf todo Reviews · 2 approvals",
    "met 2 conditions met",
    "leaf met Reviews · No changes requested",
    "leaf met Targets main",
];

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

describe("readCheckStates", () => {
    test("keeps what GitHub shows running or failed, by check name", () => {
        expect(
            readCheckStates({
                statusChecks: [
                    { displayName: "unit", state: "FAILURE" },
                    { displayName: "slow", state: "PENDING" },
                    { displayName: "build", state: "IN_PROGRESS" },
                    { displayName: "lint", state: "SUCCESS" },
                    { displayName: "Mergify Merge Queue", state: "NEUTRAL" },
                ],
            }),
        ).toEqual({ unit: "failed", slow: "running", build: "running" });
    });

    test("reads an Actions job under the name a condition gives it", () => {
        expect(
            readCheckStates({
                statusChecks: [
                    {
                        displayName:
                            "Continuous Integration / test (pull_request)",
                        state: "IN_PROGRESS",
                    },
                    {
                        displayName: "CI / lint / ruff (push)",
                        state: "FAILURE",
                    },
                ],
            }),
        ).toEqual({
            "Continuous Integration / test (pull_request)": "running",
            test: "running",
            "CI / lint / ruff (push)": "failed",
            "lint / ruff": "failed",
        });
        expect(readCheckStates(null)).toEqual({});
    });
});

describe("conditionMark", () => {
    test("draws GitHub's merge-box marks at its 16px size, in its theme colours", () => {
        const todo = conditionMark("todo");
        expect([
            todo.getAttribute("width"),
            todo.getAttribute("height"),
        ]).toEqual(["16", "16"]);
        expect(todo.style.fill).toBe("var(--fgColor-muted, #59636e)");

        // The Primer Spinner GitHub shows on a check in progress: a faint
        // ring and an arc, both in the attention colour.
        const running = conditionMark("running");
        expect(running.getAttribute("width")).toBe("16");
        expect(running.style.color).toBe("var(--fgColor-attention, #9a6700)");
        expect(
            running.querySelector("circle").getAttribute("stroke-opacity"),
        ).toBe("0.25");
        expect(running.querySelector("path").getAttribute("d")).toBe(
            "M15 8a7.002 7.002 0 00-7-7",
        );
        // ...around an 8px dot, as GitHub's CheckSpinner draws it.
        expect(
            running
                .querySelector('circle[fill="currentColor"]')
                .getAttribute("r"),
        ).toBe("4");
    });

    test("draws a failed check with GitHub's red x-circle", () => {
        const failed = conditionMark("failed");

        expect(failed.getAttribute("width")).toBe("16");
        expect(failed.style.fill).toBe("var(--fgColor-danger, #d1242f)");
        expect(failed.querySelector("path").getAttribute("d")).toMatch(
            /^M2\.343 13\.657A8 8 0 1 1/,
        );
    });

    test("spins a running mark, and holds it still under reduced motion", () => {
        conditionMark("running");

        const css = document.getElementById(
            "mergify-condition-spin",
        ).textContent;
        expect(css).toContain(
            "animation: mergify-condition-spin 1s linear infinite",
        );
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{ \[data-mark="running"\] \{ animation: none; \} \}/,
        );
    });
});

describe("conditionsVerdict", () => {
    const verdict = (rules, states, requirements) =>
        conditionsVerdict(parsed(entry(rules, requirements), states));

    test("counts what the closest rule misses, failures first", () => {
        expect(
            verdict(
                [
                    rule(
                        "#approved-reviews-by >= 1",
                        "label = ready-to-queue",
                        "check-success = slow",
                        "check-success = unit",
                        "check-success = lint",
                        "✓base = main",
                    ),
                ],
                { unit: "failed", slow: "running" },
            ),
        ).toEqual({
            state: "blocked",
            summary:
                "1 check failed · 1 check running · 1 check expected · 1 approval missing · 1 label missing",
        });
    });

    test("waits while nothing fails for good", () => {
        expect(
            verdict(
                [
                    rule("#approved-reviews-by >= 2", "check-success = ci", [
                        "any of",
                        "label = hotfix",
                        "label = urgent",
                    ]),
                ],
                { ci: "running" },
            ),
        ).toEqual({
            state: "waiting",
            summary:
                "1 check running · approvals missing (2 required) · Labeled hotfix or Labeled urgent",
        });
    });

    test("a protection's conditions count one by one, the check repeating them not at all", () => {
        expect(
            conditionsVerdict({
                ...parseQueueConditionsPage(PROTECTIONS_RUN_HTML, RUN_URL),
                checkStates: { docs: "running" },
            }),
        ).toEqual({
            state: "waiting",
            summary:
                "1 check running · approvals missing (2 required) · 2 labels missing",
        });
    });

    test("the wrong base branch, files the rule is not about and a conflict can't match", () => {
        expect(verdict([rule("base = main")]).state).toBe("blocked");
        expect(verdict([rule("files ~= ^docs/", "label = a")])).toEqual({
            state: "blocked",
            summary: "files outside the rule · 1 label missing",
        });
        expect(
            verdict([rule("✓label = a")], {}, [
                "✓-closed",
                "-conflict",
                "✓-draft",
            ]),
        ).toEqual({
            state: "blocked",
            summary: "conflicts with the base branch",
        });
    });

    test("a failed check another option can stand in for still waits", () => {
        expect(
            verdict(
                [
                    rule("label = a", [
                        "any of",
                        "check-success = ci",
                        "label = hotfix",
                    ]),
                ],
                { ci: "failed" },
            ).state,
        ).toBe("waiting");
    });

    test("can't match only when every queue rule has a failure", () => {
        const states = { ci: "failed" };
        expect(
            verdict(
                [
                    rule("check-success = ci", "label = a"),
                    rule("label = urgent"),
                ],
                states,
            ),
        ).toEqual({
            state: "waiting",
            summary: "1 label missing · closest of 2 queue rules",
        });
        expect(
            verdict(
                [
                    rule("check-success = ci", "label = a"),
                    rule("base = release", "label = urgent"),
                ],
                states,
            ).state,
        ).toBe("blocked");
    });

    test("a group that can't match counts as a failure", () => {
        expect(
            verdict(
                [
                    rule("#approved-reviews-by >= 1", [
                        "any of",
                        "check-success = a",
                        "check-success = b",
                        "check-success = c",
                    ]),
                ],
                { a: "failed", b: "failed", c: "failed" },
            ),
        ).toEqual({
            state: "blocked",
            summary: "1 check failed · 1 approval missing",
        });
    });

    test("names a two-option group on one check by what it must do", () => {
        expect(
            verdict([
                rule(["any of", "check-skipped = ci", "check-success = ci"]),
            ]).summary,
        ).toBe("CI · ci must be skipped or pass");
    });

    test("a label to remove and a draft", () => {
        expect(
            verdict([rule("-label = wip")], {}, [
                "✓-closed",
                "✓-conflict",
                "-draft",
            ]).summary,
        ).toBe("1 label to remove · still a draft");
    });

    test("met when the check says the queue is ready; waiting when it carries no tree", () => {
        expect(conditionsVerdict({ met: true, entry: null })).toEqual({
            state: "met",
            summary: "Ready to enter the merge queue",
        });
        expect(conditionsVerdict({ met: false, entry: null })).toEqual({
            state: "waiting",
            summary: "Some queue conditions are unmet",
        });
        expect(conditionsVerdict(null)).toBeNull();
    });
});

describe("buildQueueConditionsTree", () => {
    const tree = (rules, states, requirements) =>
        buildQueueConditionsTree(parsed(entry(rules, requirements), states));

    test("draws the recorded page: one rule, the requirement left, what matches folded", () => {
        const drawn = buildQueueConditionsTree({
            ...parseQueueConditionsPage(PROTECTIONS_RUN_HTML, RUN_URL),
            checkStates: { docs: "running" },
        });

        expect(treeRows(drawn)).toEqual(PROTECTIONS_TREE);
        // The words are ours; the condition stays in the tooltip.
        expect(
            drawn.querySelector(
                '[data-mergify-tree-leaf][title="label = ready-to-queue"]',
            ).textContent,
        ).toBe("Labeled ready-to-queue");
        expect(drawn.lastElementChild.textContent).toBe("View details");
    });

    test("names rules and protections when the payload notes them, and drops the check repeating them", () => {
        const drawn = buildQueueConditionsTree(
            parsed([
                [
                    "any of [🔀 queue conditions]",
                    [
                        "all of [📌 queue conditions of queue rule `default`]",
                        "label = ready",
                        [
                            "all of [🛡 Merge Protections rule `Require 2 approvals`]",
                            "#approved-reviews-by >= 2",
                        ],
                    ],
                ],
                [
                    "any of [📌 queue requirement]",
                    "check-success = @mergify/Mergify Merge Protections",
                    "check-neutral = @mergify/Mergify Merge Protections",
                ],
                ...REQUIREMENTS,
            ]),
        );

        expect(treeRows(drawn)).toEqual([
            "rule todo default",
            "leaf todo Labeled ready",
            "group and todo Merge protection 0/1",
            "leaf todo Reviews · 2 approvals",
        ]);
    });

    test("several rules: the closest first, open and marked, the others folded", () => {
        const drawn = tree([
            rule("#approved-reviews-by >= 1", "label = queue"),
            rule("label = urgent"),
        ]);

        expect(treeRows(drawn)).toEqual([
            "rule todo 2 (closest) · 1 missing",
            "leaf todo Labeled urgent",
            "rule todo 1 · 2 missing",
            "leaf todo Reviews · 1 approval",
            "leaf todo Labeled queue",
        ]);
        expect(
            Array.from(drawn.querySelectorAll(":scope > details")).map(
                (d) => d.open,
            ),
        ).toEqual([true, false]);
    });

    test("a rule that can still match comes before one that can't, however close", () => {
        const rows = treeRows(
            tree(
                [
                    rule("check-success = ci"),
                    rule("#approved-reviews-by >= 2", "label = queue"),
                ],
                { ci: "failed" },
            ),
        );

        expect(rows[0]).toBe("rule todo 2 (closest) · 2 missing");
        expect(rows).toContain("rule failed 1 · 1 missing");
    });

    test("drops an option out of the author's reach, and a lone option stands alone", () => {
        expect(
            treeRows(
                tree([
                    rule([
                        "any of",
                        "author = dependabot[bot]",
                        "label = changelog",
                    ]),
                ]),
            ),
        ).toEqual(["rule todo", "leaf todo Labeled changelog"]);
    });

    test("folds what matches into one line that unfolds to the list", () => {
        const drawn = tree([
            rule(
                "label = queue",
                "✓check-success = lint",
                "✓check-success = unit",
                "✓check-success = e2e",
                ["✓any of", "✓label = hotfix", "check-success = ci"],
            ),
        ]);
        const met = drawn.querySelector("[data-mergify-tree-met]");

        expect(met.textContent).toBe("4 conditions met");
        const details = met.closest("details");
        expect(details.open).toBe(false);
        expect(
            Array.from(
                details.querySelectorAll("[data-mergify-tree-leaf]"),
            ).map((l) => l.textContent),
        ).toEqual(["CI · lint", "CI · unit", "CI · e2e"]);
    });

    test("only checks matched: 'N checks passed'", () => {
        expect(
            tree([
                rule(
                    "label = queue",
                    "✓check-success = lint",
                    "✓check-success = unit",
                ),
            ]).querySelector("[data-mergify-tree-met]").textContent,
        ).toBe("2 checks passed");
    });

    test(`shows ${MAX_TREE_ROWS} conditions, then 'Show N more' and back`, () => {
        const labels = Array.from({ length: 8 }, (_, i) => `label = l${i}`);
        const more = tree([rule(...labels)]).querySelector(
            "[data-mergify-tree-more]",
        );
        const button = more.querySelector("button");
        const list = more.previousElementSibling;

        expect(button.textContent).toBe("Show 2 more");
        expect(list.hidden).toBe(true);
        expect(list.querySelectorAll("[data-mergify-tree-leaf]")).toHaveLength(
            2,
        );
        button.click();
        expect(list.hidden).toBe(false);
        expect(button.textContent).toBe("Show less");
        expect(button.getAttribute("aria-expanded")).toBe("true");
        button.click();
        expect(button.textContent).toBe("Show 2 more");
    });

    test("three levels drawn; deeper ones behind 'Show more'", () => {
        const rows = treeRows(
            tree([
                rule([
                    "any of",
                    "label = a",
                    [
                        "all of",
                        "label = b",
                        ["any of", "label = c", "label = d"],
                    ],
                ]),
            ]),
        );

        expect(rows.slice(0, 4)).toEqual([
            "rule todo",
            "group or todo Any of 0/2",
            "leaf todo Labeled a",
            "group and todo All of 0/2",
        ]);
        expect(rows).toContain("more Show 2 more");
    });

    test("an unmet requirement comes first: a conflict can't match", () => {
        expect(
            treeRows(
                tree([rule("✓label = queue")], {}, ["✓-closed", "-conflict"]),
            )[0],
        ).toBe("leaf failed No conflict with the base branch");
    });

    test("returns null when the check carried no tree", () => {
        expect(
            buildQueueConditionsTree({
                met: false,
                entry: null,
                runUrl: RUN_URL,
            }),
        ).toBeNull();
    });
});

describe("humanCondition", () => {
    test.each([
        ["check-success = test", ["CI", "test"]],
        ["status-success = ci-gate", ["CI", "ci-gate"]],
        ["check-skipped = ci", ["CI", "ci must be skipped"]],
        [
            "check-success-or-neutral = lint",
            ["CI", "lint must pass or be neutral"],
        ],
        ["#approved-reviews-by >= 2", ["Reviews", "2 approvals"]],
        ["#approved-reviews-by >= 1", ["Reviews", "1 approval"]],
        [
            "#changes-requested-reviews-by = 0",
            ["Reviews", "No changes requested"],
        ],
        ["label = ready", [null, "Labeled ready"]],
        ["-label = wip", [null, "Not labeled wip"]],
        ["label != wip", [null, "Not labeled wip"]],
        ["base = main", [null, "Targets main"]],
        ["base != main", [null, "Doesn't target main"]],
        ["author = dependabot[bot]", [null, "Opened by dependabot[bot]"]],
        ["files ~= ^src/", ["Files", "^src/"]],
        ["-draft", [null, "Not a draft"]],
        ["-conflict", [null, "No conflict with the base branch"]],
        [
            "-mergify-configuration-changed",
            [null, "Doesn't change the Mergify configuration"],
        ],
    ])("%s", (raw, words) => {
        expect(humanCondition(raw)).toEqual(words);
    });

    test("says a freeze's or a schedule's condition in time", () => {
        expect(
            humanCondition(
                "current-datetime < 2026-10-13T16:03:13[Europe/Paris]",
            ),
        ).toEqual(["Schedule", "before 2026-10-13 16:03 (Europe/Paris)"]);
        expect(humanCondition("schedule = Mon-Fri 09:00-17:00")).toEqual([
            "Schedule",
            "Mon-Fri 09:00-17:00",
        ]);
    });

    test("keeps the syntax for what it can't say better", () => {
        expect(humanCondition("#commits-behind <= 3")).toBeNull();
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

const BLOCKED_PAGE = checkPage(
    entry([
        rule("#approved-reviews-by >= 1", "check-success = unit", [
            "any of",
            "check-success = ci",
            "label = hotfix",
        ]),
    ]),
);
const STATES = [
    { displayName: "unit", state: "FAILURE" },
    { displayName: "ci", state: "IN_PROGRESS" },
];

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

    test("waiting: GitHub's row layout, neutral circle, the count, folded, with GitHub's check states", async () => {
        mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML, {
            statusChecks: [{ displayName: "docs", state: "PENDING" }],
        });
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
        ).toBe(
            "1 check running · approvals missing (2 required) · 2 labels missing",
        );
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
        expect(treeRows(body)).toEqual(PROTECTIONS_TREE);
        // The states come from the JSON GitHub's own merge box loads.
        expect(global.fetch).toHaveBeenCalledWith(
            "/acme/widget/pull/42/page_data/status_checks",
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-Requested-With": "XMLHttpRequest",
                }),
            }),
        );
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

    test("can't match: red x, unfolded on the tree with GitHub's marks", async () => {
        mergeBox();
        mockCheckRun(BLOCKED_PAGE, { statusChecks: STATES });
        await fetchQueueState();

        updateAllMergifyRows();

        const section = conditionsSection();
        expect(section.querySelector("h3").textContent).toBe(
            "Queue conditions can't match",
        );
        expect(
            section
                .querySelector(".fgColor-onEmphasis")
                .classList.contains("bgColor-danger-emphasis"),
        ).toBe(true);
        expect(
            section.querySelector("[data-mergify-conditions-summary]")
                .textContent,
        ).toBe(
            "1 check failed · 1 approval missing · CI · ci or Labeled hotfix",
        );
        const body = section.querySelector("[data-mergify-conditions-body]");
        expect(body.hidden).toBe(false);
        expect(treeRows(body)).toEqual([
            "rule failed",
            "leaf todo Reviews · 1 approval",
            "leaf failed CI · unit",
            "group or running Any of 0/2",
            "leaf running CI · ci",
            "leaf todo Labeled hotfix",
        ]);
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
        // No tree, no check states to read.
        expect(
            global.fetch.mock.calls.some(([url]) =>
                String(url).includes("status_checks"),
            ),
        ).toBe(false);
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

    test("keeps its last state while its sources say nothing, and goes once it cannot apply", async () => {
        const box = mergeBox();
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();
        const shown = conditionsSection();
        expect(shown).not.toBeNull();

        // The queue rewrites the check before its status comment is posted.
        mockCheckRun("<h2>In merge queue — waiting for batch (1/2)</h2>");
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).toBe(shown);

        // The run cannot be read for a poll.
        mockCheckRun("", { runOk: false });
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).toBe(shown);

        // Another pull request, after an in-page navigation.
        window.history.replaceState({}, "", "/acme/widget/pull/43");
        resetQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).toBeNull();

        // A closed pull request.
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        mockCheckRun(PROTECTIONS_RUN_HTML);
        await fetchQueueState();
        updateAllMergifyRows();
        expect(conditionsSection()).not.toBeNull();
        box.insertAdjacentHTML(
            "beforebegin",
            '<span data-status="pullClosed">Closed</span>',
        );
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

    test("says the conditions are unmet; the tree is in the merge-box row", async () => {
        await jest.isolateModulesAsync(async () => {
            withPayload(WAITING_PAYLOAD);
            const queue = require("../queue");
            mergeBox();
            mockCheckRun(PROTECTIONS_RUN_HTML);
            await queue.fetchQueueState();

            const row = queue.buildRichRow(WAITING_PAYLOAD);
            queue.updateAllMergifyRows();

            // One state line in the merge box: Mergify's row, not this one.
            expect(row.querySelector("[data-mergify-eta]")).toBeNull();
            expect(
                row.querySelector("[data-mergify-conditions-tree]"),
            ).toBeNull();
            // The sidebar, which has no such row, keeps its own line.
            expect(
                queue
                    .buildRichRow(WAITING_PAYLOAD, "sidebar")
                    .querySelector("[data-mergify-eta]").textContent,
            ).toBe("queue conditions not met");
            expect(treeRows(conditionsSection())).toEqual(
                PROTECTIONS_TREE.map((r) =>
                    r === "leaf running CI · docs" ? "leaf todo CI · docs" : r,
                ),
            );
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

describe("queue states in the merge-box row", () => {
    const QUEUED = {
        version: 1,
        state: "checking",
        queue_rule_name: "default",
        queued_at: new Date(Date.now() - 12 * 60000).toISOString(),
        estimated_time_of_merge: null,
        speculative_check_pr: 77,
        required_conditions: [
            {
                description: "check-success = ci",
                match: false,
                subconditions: [],
            },
            {
                description: "#approved-reviews-by >= 1",
                match: true,
                subconditions: [],
            },
        ],
    };

    const withPayload = (payload) =>
        jest.doMock("../mqPayload", () => ({
            ...jest.requireActual("../mqPayload"),
            getCurrent: () => ({ source: "payload", payload }),
        }));

    async function rowFor(payload, { status = "pullOpened" } = {}) {
        let section = null;
        await jest.isolateModulesAsync(async () => {
            withPayload(payload);
            const queue = require("../queue");
            const box = mergeBox();
            box.insertAdjacentHTML(
                "beforebegin",
                `<span data-status="${status}">x</span>`,
            );
            mockCheckRun("");
            queue.updateAllMergifyRows();
            section = conditionsSection();
        });
        return section;
    }

    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        resetQueueState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.dontMock("../mqPayload");
    });

    const look = (section) => ({
        state: section.getAttribute("data-mergify-conditions-section"),
        title: section.querySelector("h3").textContent,
        summary: section.querySelector("[data-mergify-conditions-summary]")
            .textContent,
        icon: section
            .querySelector(".fgColor-onEmphasis svg")
            .getAttribute("class"),
    });

    test("checking: GitHub's in-progress yellow, what the merge still waits on, when it was queued", async () => {
        const section = await rowFor(QUEUED);

        expect(look(section)).toEqual({
            state: "checking",
            title: "In the merge queue",
            summary: "1 check expected · queued 12m ago",
            icon: "octicon octicon-git-merge-queue",
        });
        expect(
            section
                .querySelector(".fgColor-onEmphasis")
                .classList.contains("bgColor-attention-emphasis"),
        ).toBe(true);
        const body = section.querySelector("[data-mergify-conditions-body]");
        expect(body.hidden).toBe(true);
        expect(
            body.querySelector("[data-mergify-spec-pr] a").getAttribute("href"),
        ).toBe("/acme/widget/pull/77");
        expect(treeRows(body)).toEqual(["leaf todo CI · ci"]);
    });

    test("checking held by a freeze: the schedule condition alone, in time", async () => {
        const section = await rowFor({
            ...QUEUED,
            required_conditions: [
                {
                    description: "all of",
                    match: false,
                    subconditions: [
                        {
                            description:
                                "current-datetime < 2026-10-13T16:03:13[Europe/Paris]",
                            match: false,
                            subconditions: [],
                        },
                    ],
                },
                {
                    description: "status-success = ci-gate",
                    match: true,
                    subconditions: [],
                },
            ],
        });

        expect(look(section).summary).toBe(
            "waiting for its schedule · queued 12m ago",
        );
        expect(
            treeRows(section.querySelector("[data-mergify-conditions-body]")),
        ).toEqual([
            "leaf todo Schedule · before 2026-10-13 16:03 (Europe/Paris)",
        ]);
    });

    test("checking with every merge condition met has only the draft PR to show", async () => {
        const section = await rowFor({
            ...QUEUED,
            required_conditions: [
                {
                    description: "check-success = ci",
                    match: true,
                    subconditions: [],
                },
            ],
        });

        expect(look(section).summary).toBe(
            "Merge conditions met · queued 12m ago",
        );
        expect(
            treeRows(section.querySelector("[data-mergify-conditions-body]")),
        ).toEqual([]);
    });

    test("paused, frozen and bisecting say what holds the pull request", async () => {
        expect(
            look(await rowFor({ ...QUEUED, state: "paused" })),
        ).toMatchObject({
            state: "paused",
            title: "Merge queue paused",
            summary: "Checks suspended · queued 12m ago",
            icon: "octicon octicon-git-merge-queue",
        });
        expect(
            look(await rowFor({ ...QUEUED, state: "frozen" })),
        ).toMatchObject({
            title: "Merge queue frozen",
            icon: "octicon octicon-lock",
        });
        expect(
            look(await rowFor({ ...QUEUED, state: "bisecting" })),
        ).toMatchObject({
            title: "Bisecting a failed batch",
            // The failed batch's conditions would read as still to come.
            summary: "Finding the pull request that broke it · queued 12m ago",
            icon: "octicon octicon-iterations",
        });
    });

    test("merged: GitHub's merged purple, nothing to unfold, on a merged page", async () => {
        const section = await rowFor(
            {
                ...QUEUED,
                state: "merged",
                speculative_check_pr: null,
                required_conditions: [],
            },
            { status: "pullMerged" },
        );

        expect(look(section)).toMatchObject({
            state: "merged",
            title: "Merged by the merge queue",
            icon: "octicon octicon-git-merge",
        });
        expect(
            section
                .querySelector(".fgColor-onEmphasis")
                .classList.contains("bgColor-done-emphasis"),
        ).toBe(true);
        expect(
            section.querySelector("[data-mergify-conditions-toggle]"),
        ).toBeNull();
    });

    test("dequeued: red, pointing at the activity log; gone once the PR is closed", async () => {
        const dequeued = {
            ...QUEUED,
            state: "dequeued",
            speculative_check_pr: null,
            required_conditions: [],
        };
        const section = await rowFor(dequeued);
        // Without the reason or the time it left, neither is made up: the
        // queued time answers another question.
        expect(look(section)).toMatchObject({
            title: "Removed from the merge queue",
            summary: "Its activity log says why",
        });
        expect(
            section
                .querySelector("[data-mergify-activity-log]")
                .getAttribute("href"),
        ).toBe(
            "https://dashboard.mergify.com/orgs/acme/repos/widget/activity-log?pull_request=42&preset=Past1month",
        );
        expect(await rowFor(dequeued, { status: "pullClosed" })).toBeNull();
    });

    test("removed and merged say when they left, and the ticker keeps it", async () => {
        jest.useFakeTimers();
        try {
            await jest.isolateModulesAsync(async () => {
                const removed = {
                    ...QUEUED,
                    state: "dequeued",
                    speculative_check_pr: null,
                    required_conditions: [],
                    left_at: new Date(Date.now() - 3 * 60000).toISOString(),
                    dequeue_reason: {
                        code: "PR_MANUALLY_DEQUEUED",
                        label: "pull request manually dequeued",
                        by: "octocat",
                    },
                };
                withPayload(removed);
                const queue = require("../queue");
                mergeBox();
                queue.updateAllMergifyRows();
                const summary = () =>
                    document.querySelector("[data-mergify-conditions-summary]")
                        .textContent;
                expect(summary()).toBe(
                    "pull request manually dequeued by @octocat · activity log · removed 3m ago",
                );

                queue.startEtaTicker(removed);
                jest.advanceTimersByTime(60_000);

                expect(summary()).toMatch(/· removed 4m ago$/);
                queue.stopEtaTicker();
            });
        } finally {
            jest.useRealTimers();
        }
        const merged = await rowFor(
            {
                ...QUEUED,
                state: "merged",
                speculative_check_pr: null,
                required_conditions: [],
                left_at: new Date(Date.now() - 5 * 60000).toISOString(),
            },
            { status: "pullMerged" },
        );
        expect(look(merged).summary).toMatch(/ · merged 5m ago$/);
    });

    test("the ticker keeps the times current in place", async () => {
        jest.useFakeTimers();
        try {
            await jest.isolateModulesAsync(async () => {
                withPayload(QUEUED);
                const queue = require("../queue");
                mergeBox();
                queue.updateAllMergifyRows();
                const times = document.querySelector(
                    "[data-mergify-queue-times]",
                );
                expect(times.textContent).toBe("queued 12m ago");

                queue.startEtaTicker({
                    ...QUEUED,
                    estimated_time_of_merge: new Date(
                        Date.now() + 30 * 60000,
                    ).toISOString(),
                });
                jest.advanceTimersByTime(60_000);

                expect(times.isConnected).toBe(true);
                expect(times.textContent).toMatch(/^queued 13m ago · merging /);
                queue.stopEtaTicker();
            });
        } finally {
            jest.useRealTimers();
        }
    });

    // One payload per in-queue state, with the optional fields proposed in
    // Mergifyio/monorepo#46755 (fixtures/queue_states.json).
    const QUEUE_STATE_FIXTURES = require("./fixtures/queue_states.json");
    const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    test.each(QUEUE_STATE_FIXTURES.map((f) => [f.name, f]))(
        "optional fields: %s",
        async (_name, fixture) => {
            const section = await rowFor(fixture.payload);
            const { clockTime } = require("../queueDetail");
            const expected = fixture.summary.replace(
                "{T}",
                clockTime("2026-10-16T12:50:00+00:00"),
            );

            expect(look(section).title).toBe(fixture.title);
            expect(look(section).summary).toMatch(
                new RegExp(
                    `^${escapeRegExp(expected)}( · (queued|removed) .+)?$`,
                ),
            );
        },
    );

    const removal = (name) =>
        QUEUE_STATE_FIXTURES.find((f) => f.name === name).payload;

    test("removed on its conditions: the tree unfolded, the failed check marked", async () => {
        const section = await rowFor(
            removal("removed on failed checks, with the engine's reason"),
        );

        const body = section.querySelector("[data-mergify-conditions-body]");
        expect(body.hidden).toBe(false);
        expect(
            section
                .querySelector("[data-mergify-conditions-toggle]")
                .getAttribute("aria-expanded"),
        ).toBe("true");
        // ci-gate ran on the queue's draft: the mark comes from the payload.
        expect(treeRows(body)).toContain("leaf failed CI · ci-gate");
        // The fold's button covers the header: the link sits above it, so a
        // click opens the log rather than folding the row.
        const link = section.querySelector("[data-mergify-activity-log]");
        expect(link.style.position).toBe("relative");
        expect(Number(link.style.zIndex)).toBeGreaterThan(
            Number(
                section.querySelector("[data-mergify-conditions-toggle]").style
                    .zIndex,
            ),
        );
    });

    test("the engine's sentence keeps its code spans as code", async () => {
        const section = await rowFor(
            removal("removed by hand, with the engine's reason"),
        );

        const summary = section.querySelector(
            "[data-mergify-conditions-summary]",
        );
        expect(summary.querySelector("code").textContent).toBe("dequeue");
        // Nothing to unfold: a removal by hand carries no conditions.
        expect(
            section.querySelector("[data-mergify-conditions-body]"),
        ).toBeNull();
    });

    test("malformed conditions draw the reason without a tree", async () => {
        const payload = removal(
            "removed on failed checks, with the engine's reason",
        );
        const section = await rowFor({
            ...payload,
            dequeue_reason: {
                ...payload.dequeue_reason,
                conditions: [
                    null,
                    { description: "x", match: false, subconditions: [null] },
                ],
            },
        });

        expect(look(section).summary).toMatch(
            /^The merge conditions cannot be satisfied due to failing checks · activity log/,
        );
        expect(
            section.querySelector("[data-mergify-conditions-body]"),
        ).toBeNull();
    });

    test("a removal on a conflict says why and has nothing to unfold", async () => {
        const section = await rowFor(
            removal("removed on a conflict with the base branch"),
        );

        expect(look(section).summary).toMatch(
            /^The pull request conflicts with the base branch · activity log/,
        );
        // Long or not, the sentence wraps: the activity log is never cut off.
        expect(
            section.querySelector("[data-mergify-conditions-summary]").style
                .whiteSpace,
        ).toBe("");
        expect(
            section.querySelector("[data-mergify-conditions-body]"),
        ).toBeNull();
    });

    test("optional fields of the wrong shape draw the state alone", async () => {
        const section = await rowFor({
            ...QUEUED,
            step: "teleporting",
            position: "3",
            batch: { size: "1", target: 2 },
            checks: [],
            freeze: { name: "" },
        });

        expect(look(section)).toMatchObject({
            title: "In the merge queue",
            summary: "1 check expected · queued 12m ago",
        });
    });

    test("just queued: 'queued just now', then minutes that tick without an estimate", async () => {
        jest.useFakeTimers();
        try {
            await jest.isolateModulesAsync(async () => {
                const justQueued = {
                    ...QUEUED,
                    queued_at: new Date(Date.now() - 20_000).toISOString(),
                };
                withPayload(justQueued);
                const queue = require("../queue");
                mergeBox();
                queue.updateAllMergifyRows();
                const times = document.querySelector(
                    "[data-mergify-queue-times]",
                );
                expect(times.textContent).toBe("queued just now");

                queue.startEtaTicker(justQueued);
                jest.advanceTimersByTime(60_000);

                expect(times.textContent).toBe("queued 1m ago");
                queue.stopEtaTicker();
            });
        } finally {
            jest.useRealTimers();
        }
    });
});

describe("joining the merge queue", () => {
    const READY_PAGE = checkPage(entry([rule("✓label = a")]), {
        title: READY_TITLE,
    });
    let current = null;

    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        current = null;
        resetQueueState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.dontMock("../mqPayload");
    });

    // The page's comment form, which the queue button posts its command with.
    function commentForm() {
        document.body.insertAdjacentHTML(
            "beforeend",
            '<textarea id="new_comment_field"></textarea><div id="partial-new-comment-form-actions"><button type="button">Comment</button></div>',
        );
    }

    async function withQueue(run) {
        await jest.isolateModulesAsync(async () => {
            jest.doMock("../mqPayload", () => ({
                ...jest.requireActual("../mqPayload"),
                getCurrent: () =>
                    current
                        ? { source: "payload", payload: current }
                        : { source: "fallback" },
            }));
            await run(require("../queue"));
        });
    }

    const look = () => {
        const s = conditionsSection();
        return s
            ? `${s.getAttribute("data-mergify-conditions-section")} | ${s.querySelector("h3").textContent}`
            : "none";
    };

    test("from the click to the queue's payload, never blank and never unmet", async () => {
        await withQueue(async (queue) => {
            mergeBox();
            commentForm();
            mockCheckRun(READY_PAGE);
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            expect(look()).toBe("met | Queue conditions met");

            queue.postCommandAndUpdate("queue");
            expect(look()).toBe("joining | Joining the merge queue…");

            // The queue rewrites its check while it takes the pull request,
            // then posts a status comment that still says "waiting".
            mockCheckRun(checkPage(entry([rule("label = a")])));
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            expect(look()).toBe("joining | Joining the merge queue…");
            current = {
                version: 1,
                state: "waiting",
                queued_at: null,
                required_conditions: [],
            };
            mockCheckRun(`Queued for merge ${READY_PAGE}`);
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            expect(look()).toBe("joining | Joining the merge queue…");

            current = {
                version: 1,
                state: "checking",
                queued_at: new Date().toISOString(),
                estimated_time_of_merge: null,
                speculative_check_pr: 7,
                required_conditions: [],
            };
            queue.updateAllMergifyRows();
            expect(look()).toBe("checking | In the merge queue");
        });
    });

    test("queued from elsewhere: the met row stays until the queue answers", async () => {
        await withQueue(async (queue) => {
            mergeBox();
            mockCheckRun(READY_PAGE);
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            const shown = conditionsSection();
            expect(look()).toBe("met | Queue conditions met");

            // The command came from a comment, not this page's button: the
            // status comment says "waiting" while the conditions match.
            current = {
                version: 1,
                state: "waiting",
                queued_at: null,
                required_conditions: [],
            };
            queue.updateAllMergifyRows();

            expect(conditionsSection()).toBe(shown);
        });
    });

    test("a request cancelled before the queue answers stops joining", async () => {
        await withQueue(async (queue) => {
            mergeBox();
            commentForm();
            mockCheckRun(READY_PAGE);
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            queue.postCommandAndUpdate("queue");
            expect(look()).toBe("joining | Joining the merge queue…");

            queue.postCommandAndUpdate("dequeue");

            expect(look()).toBe("met | Queue conditions met");
        });
    });

    test("a queue state goes with the payload it was drawn from", async () => {
        await withQueue(async (queue) => {
            current = {
                version: 1,
                state: "checking",
                queued_at: new Date().toISOString(),
                estimated_time_of_merge: null,
                speculative_check_pr: 7,
                required_conditions: [],
            };
            mergeBox();
            mockCheckRun("", { runOk: false });
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            expect(look()).toBe("checking | In the merge queue");

            // The command was cancelled: the engine rewrote the status comment
            // without a payload, and the check says nothing either.
            current = null;
            queue.updateAllMergifyRows();

            expect(look()).toBe("none");
        });
    });

    test("sits beside the protected-ref note, each in its place, steady", async () => {
        await withQueue(async (queue) => {
            current = {
                version: 1,
                state: "checking",
                queued_at: new Date().toISOString(),
                estimated_time_of_merge: null,
                speculative_check_pr: 7,
                required_conditions: [],
            };
            const box = mergeBox();
            box.querySelector('[aria-label="Merging is blocked"]').textContent =
                "Merging is blocked: Cannot update this protected ref";
            box.appendChild(queue.buildMergifyRow("default"));
            mockCheckRun("", { runOk: false });
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();

            const order = () =>
                Array.from(box.children).map((el) =>
                    el.hasAttribute("data-mergify-conditions-section")
                        ? "ROW"
                        : el.hasAttribute("data-mergify-manual-merge-note")
                          ? "NOTE"
                          : el.hasAttribute("data-mergify-merge-box-row")
                            ? "MERGIFY"
                            : (el.getAttribute("aria-label") ?? el.tagName),
                );
            expect(order()).toEqual([
                "Reviews",
                "Checks",
                "ROW",
                "Merging is blocked",
                "DIV",
                "NOTE",
                "MERGIFY",
            ]);

            const mutations = [];
            const observer = new MutationObserver((m) => mutations.push(...m));
            observer.observe(box, { childList: true });
            queue.updateAllMergifyRows();
            queue.updateAllMergifyRows();
            await Promise.resolve();
            observer.disconnect();
            expect(mutations).toHaveLength(0);
        });
    });

    test("a status comment left by an earlier queue entry is not the answer", async () => {
        await withQueue(async (queue) => {
            current = {
                version: 1,
                state: "dequeued",
                queued_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
                required_conditions: [],
            };
            mergeBox();
            commentForm();
            mockCheckRun(READY_PAGE);
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();
            expect(look()).toBe("dequeued | Removed from the merge queue");

            queue.postCommandAndUpdate("queue");

            expect(look()).toBe("joining | Joining the merge queue…");
        });
    });

    test("queued on unmet conditions, the row keeps saying what it waits for", async () => {
        await withQueue(async (queue) => {
            mergeBox();
            commentForm();
            mockCheckRun(checkPage(entry([rule("label = a")])));
            await queue.fetchQueueState();
            queue.updateAllMergifyRows();

            queue.postCommandAndUpdate("queue");

            expect(look()).toBe("waiting | Waiting for queue conditions");
        });
    });
});

describe("a re-run check", () => {
    beforeEach(() => {
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        document.body.innerHTML = "";
        resetQueueState();
    });

    test("turns the row from red to grey on the next poll", async () => {
        mergeBox();
        const page = checkPage(entry([rule("check-success = unit")]));
        mockCheckRun(page, {
            statusChecks: [{ displayName: "unit", state: "FAILURE" }],
        });
        await fetchQueueState();
        updateAllMergifyRows();
        expect(
            conditionsSection().getAttribute("data-mergify-conditions-section"),
        ).toBe("blocked");

        // Someone re-runs it: GitHub shows it pending, the payload unchanged.
        mockCheckRun(page, {
            statusChecks: [{ displayName: "unit", state: "PENDING" }],
        });
        await fetchQueueState();
        updateAllMergifyRows();

        expect(
            conditionsSection().getAttribute("data-mergify-conditions-section"),
        ).toBe("waiting");
    });
});
