// Mergify's row of GitHub's merge box, drawn like the rows GitHub puts there
// itself ("No conflicts with base branch", "Review required"): a 32px status
// circle, a bold title, one line under it, and for a row with something to
// show, GitHub's chevron to unfold it.
//
// One row for the whole lifecycle. Before the queue it says whether the pull
// request can enter, from the merge queue check's conditions; once queued, what
// the queue is doing with it, from the status report's payload: checking,
// paused, frozen, bisecting, merged, dequeued.
//
// GitHub's own classes for that row are CSS modules hashed per deploy, so the
// layout is mirrored with inline styles over Primer's stable utility classes
// and colour variables.

import { parseRequiredConditions } from "./queueConditions.js";
import {
    buildQueueConditionsTree,
    conditionsVerdict,
} from "./queueConditionsTree.js";
import { dequeueReasonText, describeQueueStep } from "./queueDetail.js";

export const CONDITIONS_SECTION_ATTR = "data-mergify-conditions-section";

const SVG_NS = "http://www.w3.org/2000/svg";

// Octicons, 16px (@primer/octicons 19): `check` and `x` as GitHub draws them
// in its rows' circles, `clock` for the wait, `git-merge-queue`, `lock`,
// `iterations` and `git-merge` for the queue's states, `chevron-right` for
// the fold.
const ICON_PATHS = {
    "git-merge-queue":
        "M3.75 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM3 7.75a.75.75 0 0 1 1.5 0v2.878a2.251 2.251 0 1 1-1.5 0Zm.75 5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm5-7.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 2.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-1.5 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z",
    lock: "M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z",
    iterations:
        "M2.5 7.25a4.75 4.75 0 0 1 9.5 0 .75.75 0 0 0 1.5 0 6.25 6.25 0 1 0-6.25 6.25H12v2.146c0 .223.27.335.427.177l2.896-2.896a.25.25 0 0 0 0-.354l-2.896-2.896a.25.25 0 0 0-.427.177V12H7.25A4.75 4.75 0 0 1 2.5 7.25Z",
    "git-merge":
        "M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z",
    check: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z",
    x: "M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z",
    clock: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z",
    chevron:
        "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z",
};

const STATES = {
    met: {
        title: "Queue conditions met",
        circle: "bgColor-success-emphasis",
        fill: "var(--bgColor-success-emphasis, #1f883d)",
        icon: "check",
    },
    waiting: {
        title: "Waiting for queue conditions",
        circle: "bgColor-neutral-emphasis",
        fill: "var(--bgColor-neutral-emphasis, #59636e)",
        icon: "clock",
    },
    blocked: {
        title: "Queue conditions can't match",
        circle: "bgColor-danger-emphasis",
        fill: "var(--bgColor-danger-emphasis, #cf222e)",
        icon: "x",
    },
    // In the queue: GitHub's in-progress yellow, its merged purple, its red.
    checking: {
        title: "In the merge queue",
        circle: "bgColor-attention-emphasis",
        fill: "var(--bgColor-attention-emphasis, #9a6700)",
        icon: "git-merge-queue",
        // No fixed note: the merge conditions say what it waits on (checks,
        // a freeze's schedule), and "checks running" was false half the time.
    },
    // Between the click and the queue's answer.
    joining: {
        title: "Joining the merge queue…",
        circle: "bgColor-attention-emphasis",
        fill: "var(--bgColor-attention-emphasis, #9a6700)",
        icon: "git-merge-queue",
        note: "Waiting for the queue to take it",
    },
    paused: {
        title: "Merge queue paused",
        circle: "bgColor-attention-emphasis",
        fill: "var(--bgColor-attention-emphasis, #9a6700)",
        icon: "git-merge-queue",
        note: "Checks suspended",
    },
    frozen: {
        title: "Merge queue frozen",
        circle: "bgColor-attention-emphasis",
        fill: "var(--bgColor-attention-emphasis, #9a6700)",
        icon: "lock",
        note: "A freeze holds the queue",
    },
    bisecting: {
        title: "Bisecting a failed batch",
        circle: "bgColor-attention-emphasis",
        fill: "var(--bgColor-attention-emphasis, #9a6700)",
        icon: "iterations",
        note: "Finding the pull request that broke it",
    },
    merged: {
        title: "Merged by the merge queue",
        circle: "bgColor-done-emphasis",
        fill: "var(--bgColor-done-emphasis, #8250df)",
        icon: "git-merge",
    },
    dequeued: {
        title: "Removed from the merge queue",
        circle: "bgColor-danger-emphasis",
        fill: "var(--bgColor-danger-emphasis, #cf222e)",
        icon: "x",
    },
};

// The queue states the row draws from the status report's payload; "waiting"
// is the conditions' to draw.
export const QUEUE_PAYLOAD_STATES = new Set([
    "checking",
    "paused",
    "frozen",
    "bisecting",
    "merged",
    "dequeued",
]);

// What the row shows for a model: { conditions } before the queue, { queue }
// once in it. queue: { state, queuedAt, eta, specPr, required, mergedMessage,
// repoPath }.
function _view(model) {
    if (model.conditions) {
        const verdict = conditionsVerdict(model.conditions);
        if (!verdict) return null;
        return {
            state: verdict.state,
            label: "Queue conditions",
            summary: [verdict.summary],
            body:
                verdict.state === "met"
                    ? null
                    : () =>
                          buildQueueConditionsTree(model.conditions) ??
                          _detailsOnly(model.conditions.runUrl),
        };
    }
    if (model.joining) {
        return {
            state: "joining",
            label: "Merge queue",
            summary: [STATES.joining.note],
            body: null,
        };
    }
    const queue = model.queue;
    const look = STATES[queue.state];
    if (!look) return null;
    if (queue.state === "merged") {
        return {
            state: "merged",
            label: "Merge queue",
            summary: [queue.mergedMessage, _TIMES],
            body: null,
        };
    }
    if (queue.state === "dequeued") {
        // Why, when the payload says, and the activity log either way.
        const reason = dequeueReasonText(queue.detail ?? null);
        const log = (prefix, text, suffix) => ({
            prefix,
            text,
            suffix,
            href: queue.activityLogUrl ?? null,
        });
        return {
            state: "dequeued",
            label: "Merge queue",
            summary: reason
                ? [reason, log("", "activity log", ""), _TIMES]
                : [log("Its ", "activity log", " says why"), _TIMES],
            body: null,
        };
    }
    // What the queue is doing, when the payload says more than its state.
    const step = describeQueueStep(queue.state, queue.detail ?? null);
    // What the merge conditions still miss, while the batch runs. Paused,
    // frozen or bisecting, they describe a batch that is held or already
    // failed: the state says it better than a count would. So does a step
    // other than the checks running.
    const countsConditions =
        queue.state === "checking" &&
        (!step || step.title === "Checks running");
    const entry = countsConditions
        ? parseRequiredConditions(queue.required)
        : null;
    const conditions = entry ? { met: false, entry, runUrl: null } : null;
    const unmet = conditions && entry.some((n) => !n.match);
    const summary = step ? [...step.notes] : look.note ? [look.note] : [];
    if (unmet) summary.push(conditionsVerdict(conditions).summary);
    else if (conditions) summary.push("Merge conditions met");
    summary.push(_TIMES);
    const hasBody = Boolean(unmet || queue.specPr);
    return {
        state: queue.state,
        title: step?.title,
        icon: step?.icon,
        label: "Merge queue",
        summary,
        body: hasBody
            ? () => _queueBody(queue, unmet ? conditions : null)
            : null,
    };
}

// Where the queued-at and estimated-merge times go: the caller fills it, and
// its ticker keeps it current.
const _TIMES = Symbol("times");

function _queueBody(queue, conditions) {
    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;min-width:0;";
    if (queue.specPr) {
        const line = document.createElement("div");
        line.setAttribute("data-mergify-spec-pr", "");
        line.style.cssText =
            "font-size:14px;line-height:20px;padding:4px 0;color:var(--fgColor-muted, #59636e);";
        const link = document.createElement("a");
        link.href = `${queue.repoPath}/pull/${queue.specPr}`;
        link.style.color = "var(--fgColor-accent, #0969da)";
        link.textContent = `draft pull request #${queue.specPr}`;
        line.append("Checks run in ", link);
        body.appendChild(line);
    }
    if (conditions) {
        const tree = buildQueueConditionsTree(conditions);
        if (tree) body.appendChild(tree);
    }
    return body;
}

// "Its activity log says why", the words in the middle a link when there is
// somewhere to go.
function _linkPart({ prefix, text, suffix, href }) {
    const span = document.createElement("span");
    if (prefix) span.append(prefix);
    if (href) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("data-mergify-activity-log", "");
        link.style.color = "var(--fgColor-accent, #0969da)";
        link.textContent = text;
        span.appendChild(link);
    } else {
        span.append(text);
    }
    if (suffix) span.append(suffix);
    return span;
}

function _octicon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `octicon octicon-${name}`);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ICON_PATHS[name]);
    svg.appendChild(path);
    return svg;
}

// Whether the row opens unfolded: only when no rule can match, the case the
// author has to act on. A click overrides it for this pull request only.
export function sectionStartsExpanded(model) {
    return model?.conditions
        ? conditionsVerdict(model.conditions)?.state === "blocked"
        : false;
}

// expanded: the fold state to draw; onToggle(expanded) is called on a click;
// times(): the nodes saying when the pull request was queued and should merge.
export function buildQueueSection(
    model,
    { expanded = false, onToggle = () => {}, times = () => [] } = {},
) {
    const view = model ? _view(model) : null;
    if (!view) return null;
    const look = STATES[view.state];
    const foldable = Boolean(view.body);

    const section = document.createElement("section");
    section.setAttribute(CONDITIONS_SECTION_ATTR, view.state);
    section.setAttribute("aria-label", view.label);
    section.className = "border-bottom color-border-subtle";
    // The classes are GitHub's; a merged pull request's box does not style
    // them, so the rule is drawn here too.
    section.style.borderBottom =
        "1px solid var(--borderColor-muted, #d1d9e0b3)";

    const header = document.createElement("div");
    header.style.cssText =
        "position:relative;display:flex;gap:8px;padding:16px;";

    const layout = document.createElement("div");
    layout.className = "d-flex width-full";
    layout.style.minWidth = "0";

    const iconColumn = document.createElement("div");
    iconColumn.className = "mr-2 flex-shrink-0";
    const iconClip = document.createElement("div");
    iconClip.style.cssText =
        "width:32px;height:32px;border-radius:50%;overflow:hidden;";
    const circle = document.createElement("div");
    circle.className = `${look.circle} fgColor-onEmphasis`;
    // The class is GitHub's; the inline colour covers the pages that do not
    // load that Primer utility (the neutral one is missing on PR pages).
    circle.style.cssText = `display:flex;width:32px;height:32px;align-items:center;justify-content:center;background-color:${look.fill};color:var(--fgColor-onEmphasis, #fff);`;
    circle.appendChild(_octicon(view.icon ?? look.icon));
    iconClip.appendChild(circle);
    iconColumn.appendChild(iconClip);

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0;";
    const title = document.createElement("h3");
    title.style.cssText =
        "margin:0;font-family:var(--fontStack-sansSerifDisplay, inherit);font-size:16px;font-weight:600;line-height:24px;display:flex;align-items:center;gap:8px;";
    title.textContent = view.title ?? look.title;
    const subtitle = document.createElement("p");
    subtitle.className = "fgColor-muted mb-0";
    subtitle.setAttribute("data-mergify-conditions-summary", "");
    subtitle.style.cssText =
        "font-size:14px;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    const parts = [];
    for (const part of view.summary) {
        if (part === _TIMES) {
            const nodes = times();
            if (nodes.length === 0) continue;
            const span = document.createElement("span");
            span.setAttribute("data-mergify-queue-times", "");
            span.append(...nodes);
            parts.push(span);
        } else if (typeof part === "object" && part) {
            parts.push(_linkPart(part));
        } else if (part) {
            parts.push(document.createTextNode(part));
        }
    }
    parts.forEach((node, i) => {
        if (i > 0) subtitle.append(" · ");
        subtitle.appendChild(node);
    });
    subtitle.title = subtitle.textContent;
    text.append(title, subtitle);

    layout.append(iconColumn, text);
    header.appendChild(layout);
    section.appendChild(header);
    if (!foldable) return section;

    const body = document.createElement("div");
    body.setAttribute("data-mergify-conditions-body", "");
    // Under the title, past the 32px circle and its 8px gap.
    // GitHub's own unfolded rows sit on a muted band under a rule.
    body.style.cssText =
        "padding:8px 16px 12px 56px;min-width:0;background:var(--bgColor-muted, #f6f8fa);border-top:1px solid var(--borderColor-muted, #d1d9e0b3);";
    body.appendChild(view.body());
    body.hidden = !expanded;

    const chevronColumn = document.createElement("div");
    chevronColumn.className = "fgColor-muted pr-2 pt-2";
    const chevron = document.createElement("div");
    chevron.style.cssText = `width:16px;height:16px;transition:transform .2s cubic-bezier(.6,0,.2,1);${expanded ? "transform:rotate(90deg);" : ""}`;
    chevron.appendChild(_octicon("chevron"));
    chevronColumn.appendChild(chevron);

    // GitHub covers the whole header with a transparent button.
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-mergify-conditions-toggle", "");
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute(
        "aria-label",
        `${expanded ? "Collapse" : "Expand"} ${view.label.toLowerCase()}`,
    );
    toggle.style.cssText =
        "position:absolute;inset:0;z-index:1;width:100%;opacity:0;cursor:pointer;border:0;padding:0;";
    toggle.onclick = () => {
        const next = body.hidden;
        body.hidden = !next;
        toggle.setAttribute("aria-expanded", String(next));
        toggle.setAttribute(
            "aria-label",
            `${next ? "Collapse" : "Expand"} ${view.label.toLowerCase()}`,
        );
        chevron.style.transform = next ? "rotate(90deg)" : "";
        onToggle(next);
    };

    header.append(toggle, chevronColumn);
    section.appendChild(body);
    return section;
}

// The check carried no tree (an engine that does not write it, or a tree too
// large for it): point at the check page, which lists the conditions.
function _detailsOnly(runUrl) {
    const line = document.createElement("div");
    line.setAttribute("data-mergify-conditions-tree", "");
    line.style.cssText = "font-size:14px;line-height:20px;";
    if (runUrl) {
        const link = document.createElement("a");
        link.href = runUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.color = "var(--fgColor-accent, #0969da)";
        link.textContent = "View details";
        line.appendChild(link);
    }
    return line;
}

// Where the row goes in the merge box: right after GitHub's checks row, so it
// reads as the next thing standing between the pull request and the queue;
// without one (a merged pull request), after GitHub's own rows, before
// "Merging is blocked" or the band of merge buttons and Mergify's actions.
export function placeQueueConditionsSection(container, section) {
    const rows = Array.from(container.children);
    const checks = rows.find(
        (el) =>
            el.getAttribute("aria-label") === "Checks" ||
            el.querySelector(':scope > section[aria-label="Checks"]'),
    );
    let before = checks ? checks.nextElementSibling : null;
    if (!checks) {
        before =
            rows.find(
                (el) =>
                    el !== section &&
                    (el.getAttribute("aria-label") === "Merging is blocked" ||
                        el.classList.contains("bgColor-muted") ||
                        el.hasAttribute("data-mergify-merge-box-row")),
            ) ?? null;
    }
    if (before === section) return;
    if (
        section.parentElement === container &&
        section.nextElementSibling === before
    )
        return;
    container.insertBefore(section, before);
}
