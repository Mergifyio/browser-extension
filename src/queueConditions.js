// The queue entry conditions of a pull request not in the queue yet, read off
// the "Mergify Merge Queue" check run page.
//
// The engine writes them as data in the check's summary: an empty
// <span itemprop="mergify.v1.<base64url JSON>">, the status report's
// MergeQueueStatePayload with the whole evaluated tree in
// required_conditions. GitHub keeps that attribute byte for byte and the span
// takes no room, no focus and no place in the accessibility tree. Nothing here
// reads the summary's text.

const PAYLOAD_ATTRIBUTE_PREFIX = "mergify.v1.";

// What the engine titles the check of a pull request that matches its queue
// conditions but was not queued yet: queuing is manual there, and the command
// would put it in right away.
const READY_CHECK_TITLE = "Merge queue is ready";
// Both writers of the check title its waiting state this way: "… to match"
// for the engine, bare for the queue before the pull request enters.
const WAITING_CHECK_TITLE = "Waiting for queue conditions";

// Returns { met, entry, runUrl } when the page is about the queue entry
// conditions, null otherwise. `entry` is the evaluated tree (top-level nodes)
// when the check carries it, null when it does not (an older engine, or a tree
// too large for the span): the pull request still waits, on something only
// the check page can explain.
export function parseQueueConditionsPage(runHtml, runUrl = null) {
    if (typeof runHtml !== "string") return null;
    if (
        !runHtml.includes(READY_CHECK_TITLE) &&
        !runHtml.includes(WAITING_CHECK_TITLE)
    )
        return null;
    const doc = new DOMParser().parseFromString(runHtml, "text/html");
    const titles = Array.from(doc.querySelectorAll("h1, h2, h3")).map((h) =>
        h.textContent.trim(),
    );
    const ready = titles.includes(READY_CHECK_TITLE);
    // A dequeued pull request keeps the queue's last check, whose conditions
    // are the ones to MERGE: only a check about getting in is read.
    if (!ready && !titles.some((t) => t.startsWith(WAITING_CHECK_TITLE)))
        return null;
    const entry = _readPayloadTree(doc);
    return { met: ready, entry, runUrl };
}

function _readPayloadTree(doc) {
    const span = doc.querySelector(
        `span[itemprop^="${PAYLOAD_ATTRIBUTE_PREFIX}"]`,
    );
    if (!span) return null;
    let payload;
    try {
        const encoded = span
            .getAttribute("itemprop")
            .slice(PAYLOAD_ATTRIBUTE_PREFIX.length)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const bytes = Uint8Array.from(
            atob(encoded + "=".repeat((4 - (encoded.length % 4)) % 4)),
            (c) => c.charCodeAt(0),
        );
        payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return null;
    }
    return parseRequiredConditions(payload?.required_conditions);
}

// The payload's required_conditions as the tree draws them; null for none.
export function parseRequiredConditions(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    return nodes.map(_toNode);
}

// A payload condition as the tree draws it. `description` holds the
// engine's label: the condition itself, or "all of" / "any of" / "not" for
// a group. An optional `note` names a group ("📌 queue conditions of queue
// rule `default`"), when the payload carries it.
function _toNode(condition) {
    const children = Array.isArray(condition.subconditions)
        ? condition.subconditions.map(_toNode)
        : [];
    const label = String(condition.description ?? "");
    const op =
        children.length === 0
            ? "leaf"
            : label.startsWith("any of")
              ? "or"
              : label.startsWith("not")
                ? "not"
                : "and";
    return {
        op,
        match: Boolean(condition.match),
        label,
        desc: typeof condition.note === "string" ? condition.note : "",
        children,
    };
}

// GitHub's own state of each check on the pull request, by the name a
// condition gives it: what its merge box shows, read from the JSON it loads
// (/pull/N/page_data/status_checks). Running or failed only; the rest says
// nothing a condition's match does not.
const RUNNING_STATES = new Set([
    "PENDING",
    "IN_PROGRESS",
    "QUEUED",
    "WAITING",
    "REQUESTED",
]);
const FAILED_STATES = new Set([
    "FAILURE",
    "ERROR",
    "CANCELLED",
    "TIMED_OUT",
    "ACTION_REQUIRED",
    "STARTUP_FAILURE",
]);

// GitHub Actions jobs show as "<workflow> / <job> (<event>)" while a
// condition names the check run, the job: keep both spellings.
const ACTIONS_DISPLAY_NAME = /^.+? \/ (.+?)(?: \([a-z_]+\))?$/;

export function readCheckStates(statusChecksJson) {
    const states = {};
    for (const check of statusChecksJson?.statusChecks ?? []) {
        const name = check?.displayName;
        if (typeof name !== "string") continue;
        const state = FAILED_STATES.has(check.state)
            ? "failed"
            : RUNNING_STATES.has(check.state)
              ? "running"
              : null;
        if (!state) continue;
        states[name] = state;
        const job = ACTIONS_DISPLAY_NAME.exec(name)?.[1];
        if (job && !(job in states)) states[job] = state;
    }
    return states;
}

// The marks of GitHub's own merge-box checks list, at its size (16px), so
// the eye reads them the same way. Still to do: Octicon `dot`, the hollow
// twin of the `dot-fill` GitHub puts on a pending status. Running: GitHub's
// CheckSpinner (a Primer Spinner around an 8px dot), mirrored rather than
// referenced, because its classes are
// hashed per deploy and only loaded on some pages; its colour and timing are
// the same, and it holds still under prefers-reduced-motion.
const SVG_NS = "http://www.w3.org/2000/svg";
const MARK_SIZE = "16";
const TODO_PATH =
    "M4 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm4-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z";
// Octicon `x-circle-fill`, GitHub's mark for a failed check in the same list.
const FAILED_PATH =
    "M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z";
const SPIN_STYLE_ID = "mergify-condition-spin";

function _ensureSpinStyle() {
    if (document.getElementById(SPIN_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = SPIN_STYLE_ID;
    style.textContent = [
        "@keyframes mergify-condition-spin { to { transform: rotate(360deg); } }",
        '[data-mark="running"] { animation: mergify-condition-spin 1s linear infinite; transform-box: fill-box; transform-origin: center; }',
        '@media (prefers-reduced-motion: reduce) { [data-mark="running"] { animation: none; } }',
    ].join("\n");
    document.head.appendChild(style);
}

function _svgChild(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs))
        el.setAttribute(name, value);
    return el;
}

export function conditionMark(kind) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", MARK_SIZE);
    svg.setAttribute("height", MARK_SIZE);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("data-mark", kind);
    if (kind === "running") {
        _ensureSpinStyle();
        svg.setAttribute("fill", "none");
        svg.style.cssText =
            "flex-shrink:0;color:var(--fgColor-attention, #9a6700);vertical-align:middle;";
        svg.append(
            _svgChild("circle", {
                cx: "8",
                cy: "8",
                r: "7",
                stroke: "currentColor",
                "stroke-opacity": "0.25",
                "stroke-width": "2",
                "vector-effect": "non-scaling-stroke",
            }),
            _svgChild("path", {
                d: "M15 8a7.002 7.002 0 00-7-7",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "vector-effect": "non-scaling-stroke",
            }),
            // GitHub's CheckSpinner centres an 8px dot in the ring.
            _svgChild("circle", {
                cx: "8",
                cy: "8",
                r: "4",
                fill: "currentColor",
            }),
        );
        return svg;
    }
    const failed = kind === "failed";
    svg.style.cssText = `flex-shrink:0;fill:${failed ? "var(--fgColor-danger, #d1242f)" : "var(--fgColor-muted, #59636e)"};vertical-align:middle;`;
    svg.append(_svgChild("path", { d: failed ? FAILED_PATH : TODO_PATH }));
    return svg;
}
