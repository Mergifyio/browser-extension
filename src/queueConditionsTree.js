// The unfolded part of the merge-box conditions row: the queue rules as a
// tree — each rule a branch, its "all of" / "any of" groups under it, the
// conditions as leaves — drawn from the evaluated tree the engine puts in the
// check's payload, with what matches folded away. The row's verdict and its
// count line come from the same reading, so the two cannot disagree.
//
// It speaks the dashboard's language for the same trees (the condition
// builder and the PR simulator, dashboard/src/modules/common/condition-tree):
// an operator pill with a passing/total count, a guide rail per level, and the
// human wording of its condition chips ("Targets main", "Labeled x").

import { conditionMark } from "./queueConditions.js";

// generic_evaluator.GenericRulesEvaluator.FIXED_ATTRIBUTES: what the author
// cannot change on this pull request.
const FIXED_ATTRIBUTES = new Set(["head", "author"]);

// Leaves shown in a group before "Show N more".
export const MAX_TREE_ROWS = 6;
// Levels drawn before "Show more": the rule, its groups, their groups.
export const MAX_TREE_DEPTH = 3;

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIL_PX = 16;

// ---- Reading the tree --------------------------------------------------

function _attributeName(label) {
    return /^[-#]*([a-z][a-z0-9-]*)/.exec(label)?.[1] ?? "";
}

export function isImmutableLeaf(node) {
    return (
        node.op === "leaf" && FIXED_ATTRIBUTES.has(_attributeName(node.label))
    );
}

// An unmet branch only a change of author or head branch could satisfy.
export function isOutOfReach(node) {
    if (node.match) return false;
    if (node.op === "leaf") return isImmutableLeaf(node);
    if (node.op === "and") return node.children.some(isOutOfReach);
    if (node.op === "or") return node.children.every(isOutOfReach);
    return false;
}

// Same-operator nesting flattened, as the engine's `simplified()`.
function _flattened(node) {
    if (node.op === "leaf" || node.op === "not") {
        return node.op === "not"
            ? { ...node, children: node.children.map(_flattened) }
            : node;
    }
    // A named group (a merge protection, a GitHub ruleset) keeps its name.
    const children = node.children
        .map(_flattened)
        .flatMap((c) =>
            c.op === node.op && !namedGroup(c) ? c.children : [c],
        );
    return { ...node, children };
}

// The groups the engine injects into a queue rule, by their note.
const NAMED_GROUPS = [
    [/^🛡 Merge Protections rule (.+)$/u, "Merge protection"],
    [/^🛡 GitHub repository ruleset rules? (.+)$/u, "GitHub ruleset"],
    [/^🛡 GitHub branch protection$/u, "GitHub branch protection"],
    [/configuration change requirements$/, "Configuration change"],
];

// { kind, name } for a group the engine named, null otherwise.
export function namedGroup(node) {
    if (node.op === "leaf" || !node.desc) return null;
    for (const [pattern, kind] of NAMED_GROUPS) {
        const m = pattern.exec(node.desc);
        if (m) return { kind, name: m[1]?.replace(/`/g, "").trim() ?? "" };
    }
    return null;
}

// The queue's own requirement that the Mergify Merge Protections check
// passes, as "any of" its success, neutral and skipped conclusions.
const PROTECTIONS_CHECK =
    /^check-[a-z-]+\s*=\s*@mergify\/Mergify Merge Protections$/;

export function isProtectionsCheckGroup(node) {
    return (
        node.op !== "leaf" &&
        node.children.length > 0 &&
        node.children.every(
            (c) => c.op === "leaf" && PROTECTIONS_CHECK.test(c.label),
        )
    );
}

function _hasProtectionGroup(node) {
    if (node.op === "leaf") return false;
    if (namedGroup(node)?.kind === "Merge protection") return true;
    return node.children.some(_hasProtectionGroup);
}

// Under "any of", options out of reach are dropped: they can never be the
// one that is enough.
function _reachable(node) {
    if (node.op === "leaf") return node;
    let children = node.children;
    if (node.op === "or" && !node.match)
        children = children.filter((c) => c.match || !isOutOfReach(c));
    // A group left with one option is that option; the rule itself, and a
    // group the engine named, stay.
    children = children
        .map(_reachable)
        .map((c) =>
            (c.op === "and" || c.op === "or") &&
            c.children.length === 1 &&
            !namedGroup(c)
                ? c.children[0]
                : c,
        );
    return { ...node, children };
}

// An unnamed group around one condition is that condition.
function _alone(node) {
    return (node.op === "and" || node.op === "or") &&
        node.children.length === 1 &&
        !namedGroup(node)
        ? _alone(node.children[0])
        : node;
}

function _unmetLeaves(node) {
    if (node.match) return 0;
    if (node.op === "leaf" || node.op === "not") return 1;
    if (node.op === "or")
        return Math.min(...node.children.map(_unmetLeaves), Infinity);
    return node.children.reduce((sum, c) => sum + _unmetLeaves(c), 0);
}

// ---- Words ---------------------------------------------------------------

const CHECK_LEAF =
    /^(check|status)-(success-or-neutral|success|failure|neutral|skipped|timed-out|cancelled|pending|stale)\s*(=|~=)\s*(.+)$/;

// A condition in words, as [muted prefix, text]; null for the raw syntax.
export function humanCondition(label) {
    const check = CHECK_LEAF.exec(label);
    if (check) {
        const [, , state, op, name] = check;
        // What the check must do, not what it did: "ci must be skipped".
        const MUST = {
            success: "",
            "success-or-neutral": " must pass or be neutral",
            failure: " must fail",
            neutral: " must be neutral",
            skipped: " must be skipped",
            "timed-out": " must time out",
            cancelled: " must be cancelled",
            pending: " must be pending",
            stale: " must be stale",
        };
        return [
            "CI",
            `${op === "~=" ? `matching ${name}` : name}${MUST[state]}`,
        ];
    }
    const approvals = /^#approved-reviews-by\s*>=\s*(\d+)$/.exec(label);
    if (approvals) {
        const n = Number(approvals[1]);
        return ["Reviews", `${n} approval${n > 1 ? "s" : ""}`];
    }
    const approvedBy = /^approved-reviews-by\s*=\s*(.+)$/.exec(label);
    if (approvedBy) return ["Reviews", `Approved by ${approvedBy[1]}`];
    if (/^#changes-requested-reviews-by\s*=\s*0$/.test(label))
        return ["Reviews", "No changes requested"];
    if (/^#review-threads-unresolved\s*=\s*0$/.test(label))
        return ["Reviews", "All threads resolved"];
    const lbl = /^(-?)label\s*(=|!=)\s*(.+)$/.exec(label);
    if (lbl) {
        const negated = (lbl[1] === "-") !== (lbl[2] === "!=");
        return [null, `${negated ? "Not labeled" : "Labeled"} ${lbl[3]}`];
    }
    const base = /^(-?)base\s*(=|!=)\s*(.+)$/.exec(label);
    if (base) {
        const negated = (base[1] === "-") !== (base[2] === "!=");
        return [null, `${negated ? "Doesn't target" : "Targets"} ${base[3]}`];
    }
    const author = /^(-?)author\s*(=|!=)\s*(.+)$/.exec(label);
    if (author) {
        const negated = (author[1] === "-") !== (author[2] === "!=");
        return [
            null,
            `${negated ? "Not opened by" : "Opened by"} ${author[3]}`,
        ];
    }
    const files = /^files\s*~=\s*(.+)$/.exec(label);
    if (files) return ["Files", files[1]];
    // A freeze or a merge schedule: "current-datetime < 2026-10-13T16:03:13
    // [Europe/Paris]", "schedule = Mon-Fri 09:00-17:00".
    const datetime =
        /^current-datetime\s*(<=?|>=?)\s*(\S+?)T(\d\d:\d\d)(?::\d\d)?(?:\[(.+)\])?$/.exec(
            label,
        );
    if (datetime) {
        const [, op, day, time, zone] = datetime;
        const when = op.startsWith("<") ? "before" : "after";
        return [
            "Schedule",
            `${when} ${day} ${time}${zone ? ` (${zone})` : ""}`,
        ];
    }
    const schedule = /^schedule\s*=\s*(.+)$/.exec(label);
    if (schedule) return ["Schedule", schedule[1]];
    const FLAGS = {
        "-draft": "Not a draft",
        draft: "Draft",
        "-conflict": "No conflict with the base branch",
        "-closed": "Open",
        "-merged": "Not merged",
        "-mergify-configuration-changed":
            "Doesn't change the Mergify configuration",
        "#commits-behind = 0": "Up to date with the base branch",
    };
    if (FLAGS[label]) return [null, FLAGS[label]];
    return null;
}

export const FILES_ATTRIBUTE =
    /^-?#?(?:added-|modified-|removed-)?files\s*(?:=|!=|~=|>=|<=|>|<)/;

// The check a "succeed" condition names, e.g. "unit" in `check-success = unit`.
const CHECK_NAME =
    /^(?:check|status)-(?:success-or-neutral|success|neutral|skipped|failure)\s*=\s*(.+)$/;

// GitHub's state of the check a condition names: "running", "failed", or
// undefined when it says nothing more than the condition's match.
function _checkState(label, states) {
    const name = CHECK_NAME.exec(label)?.[1];
    return name ? states[name] : undefined;
}

// Unmet conditions that fail until someone changes the pull request.
function _fixedFailure(label) {
    return (
        /^-conflict$/.test(label) ||
        /^base\s*=/.test(label) ||
        FILES_ATTRIBUTE.test(label)
    );
}

function _leafMark(node, states) {
    if (node.match) return "met";
    const state = _checkState(node.label, states);
    if (state === "failed" || _fixedFailure(node.label)) return "failed";
    if (state === "running") return "running";
    return "todo";
}

function _nodeMark(node, states) {
    if (node.match) return "met";
    if (node.op === "leaf") return _leafMark(node, states);
    if (node.op === "not") return "todo";
    const marks = node.children
        .filter((c) => !c.match)
        .map((c) => _nodeMark(c, states));
    if (node.op === "or") {
        if (marks.length > 0 && marks.every((m) => m === "failed"))
            return "failed";
        if (marks.includes("running")) return "running";
        return "todo";
    }
    if (marks.includes("failed")) return "failed";
    if (marks.length > 0 && marks.every((m) => m === "running"))
        return "running";
    return "todo";
}

// ---- Drawing -------------------------------------------------------------

const CHECK_CIRCLE_PATH =
    "M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z";
const CHEVRON_PATH =
    "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z";

function _svg(path, color, size = 16) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = `flex-shrink:0;fill:${color};`;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
}

function _mark(kind) {
    if (kind === "met") {
        const svg = _svg(CHECK_CIRCLE_PATH, "var(--fgColor-success, #1a7f37)");
        svg.setAttribute("data-mark", "met");
        return svg;
    }
    return conditionMark(kind);
}

function _row(depthPx = 0) {
    const row = document.createElement("div");
    // GitHub's unfolded checks list: 14px text.
    row.style.cssText = `display:flex;align-items:center;gap:8px;min-height:28px;min-width:0;padding-left:${depthPx}px;font-size:14px;line-height:20px;color:var(--fgColor-default, #1f2328);`;
    return row;
}

function _text(content, css = "") {
    const span = document.createElement("span");
    span.style.cssText = `min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${css}`;
    span.textContent = content;
    return span;
}

// One condition: its mark, its words, the raw condition in the tooltip.
function _leafRow(node, states) {
    const row = _row();
    row.setAttribute("data-mergify-tree-leaf", _leafMark(node, states));
    row.title = node.label;
    row.appendChild(_mark(_leafMark(node, states)));
    const words = humanCondition(node.label);
    if (words) {
        const [prefix, text] = words;
        const label = _text("", "flex:1;");
        if (prefix) {
            const muted = document.createElement("span");
            muted.style.color = "var(--fgColor-muted, #59636e)";
            muted.textContent = `${prefix} · `;
            label.appendChild(muted);
        }
        const value = document.createElement("span");
        // A pattern stays code.
        if (prefix === "Files")
            value.style.cssText =
                "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;";
        value.textContent = text;
        label.appendChild(value);
        row.appendChild(label);
    } else {
        row.appendChild(
            _text(
                node.label,
                "flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;",
            ),
        );
    }
    row.setAttribute("data-mergify-tree-text", row.textContent);
    return row;
}

// The queue's requirement that the Merge Protections check passes, when the
// protection rules themselves are not drawn: one line, not three conditions
// on a check's conclusions. Its failure only says a protection is unmet, so it
// is never drawn as one that can't match.
function _protectionsRow(node) {
    const row = _row();
    row.setAttribute("data-mergify-tree-leaf", "todo");
    row.title = node.children.map((c) => c.label).join("\n");
    row.appendChild(_mark("todo"));
    row.appendChild(_text("Merge protections pass", "flex:1;"));
    return row;
}

// The dashboard's operator pill, in words: neutral "All of", blue "Any of",
// red "Not", with its passing/total count.
const PILLS = {
    and: {
        text: "All of",
        fg: "var(--fgColor-default, #1f2328)",
        bg: "var(--bgColor-muted, #f6f8fa)",
        border: "var(--borderColor-default, #d1d9e0)",
    },
    or: {
        text: "Any of",
        note: "one is enough",
        fg: "var(--fgColor-accent, #0969da)",
        bg: "var(--bgColor-accent-muted, #ddf4ff)",
        border: "var(--borderColor-accent-muted, #54aeff66)",
    },
    not: {
        text: "Not",
        fg: "var(--fgColor-danger, #d1242f)",
        bg: "var(--bgColor-danger-muted, #ffebe9)",
        border: "var(--borderColor-danger-muted, #ff818266)",
    },
};

function _pill(op, passing, total, text = PILLS[op].text) {
    const look = PILLS[op];
    const pill = document.createElement("span");
    pill.setAttribute("data-mergify-tree-pill", op);
    pill.style.cssText = `display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border:1px solid ${look.border};border-radius:6px;background:${look.bg};color:${look.fg};font-size:12px;font-weight:600;flex-shrink:0;`;
    pill.append(text);
    const count = document.createElement("span");
    count.style.cssText =
        "padding:0 4px;border-radius:4px;background:var(--bgColor-neutral-muted, #818b981f);color:var(--fgColor-muted, #59636e);font-size:11px;font-weight:500;line-height:16px;font-variant-numeric:tabular-nums;";
    count.textContent = `${passing}/${total}`;
    pill.appendChild(count);
    return pill;
}

// A level's children hang off a thin guide line, as in GitHub's file tree.
function _rail() {
    const rail = document.createElement("div");
    rail.setAttribute("data-mergify-tree-rail", "");
    rail.style.cssText = `display:flex;flex-direction:column;min-width:0;margin-left:7px;padding-left:${RAIL_PX - 7}px;border-left:1px solid var(--borderColor-muted, #d1d9e0b3);`;
    return rail;
}

// A row that unfolds what it stands for, in place.
function _disclosure(summaryRow, content, open = false) {
    const details = document.createElement("details");
    details.open = open;
    details.style.cssText = "min-width:0;";
    const summary = document.createElement("summary");
    summary.style.cssText = "list-style:none;cursor:pointer;min-width:0;";
    const chevron = _svg(CHEVRON_PATH, "var(--fgColor-muted, #59636e)", 12);
    chevron.style.transition = "transform .2s cubic-bezier(.6,0,.2,1)";
    if (open) chevron.style.transform = "rotate(90deg)";
    details.addEventListener("toggle", () => {
        chevron.style.transform = details.open ? "rotate(90deg)" : "";
    });
    summaryRow.appendChild(chevron);
    summary.appendChild(summaryRow);
    details.append(summary, content);
    return details;
}

// What already matches in a group, in one line: "✓ Targets main",
// "✓ 3 checks passed", "✓ 2 conditions met"; it unfolds to the list.
function _metLine(nodes, states) {
    const row = _row();
    row.setAttribute("data-mergify-tree-met", String(nodes.length));
    row.appendChild(_mark("met"));
    let text;
    if (nodes.length === 1 && nodes[0].op === "leaf") {
        const words = humanCondition(nodes[0].label);
        text = words
            ? `${words[0] ? `${words[0]} · ` : ""}${words[1]}`
            : nodes[0].label;
    } else if (nodes.length === 1) {
        const named = namedGroup(nodes[0]);
        text = named
            ? `${named.kind}${named.name ? ` · ${named.name}` : ""}`
            : `${PILLS[nodes[0].op].text} · ${nodes[0].children.length} met`;
    } else if (
        nodes.every((n) => n.op === "leaf" && CHECK_LEAF.test(n.label))
    ) {
        text = `${nodes.length} checks passed`;
    } else {
        text = `${nodes.length} conditions met`;
    }
    row.appendChild(_text(text, "flex:1;color:var(--fgColor-muted, #59636e);"));
    if (nodes.length === 1) {
        row.title = nodes[0].op === "leaf" ? nodes[0].label : "";
        return row;
    }
    const list = _rail();
    for (const node of nodes) list.appendChild(_nodeRows(node, states, 0));
    return _disclosure(row, list);
}

// A node and what hangs under it, `depth` levels below the rule.
function _nodeRows(node, states, depth) {
    if (node.op === "leaf") return _leafRow(node, states);
    if (isProtectionsCheckGroup(node)) return _protectionsRow(node);
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;min-width:0;";
    const passing = node.children.filter((c) => c.match).length;
    const header = _row();
    header.setAttribute("data-mergify-tree-group", node.op);
    header.appendChild(_mark(_nodeMark(node, states)));
    const named = namedGroup(node);
    // A named group says what it is ("Merge protection") and its name; an
    // "any of" among them keeps its own pill.
    const label = named && node.op === "and" ? named.kind : PILLS[node.op].text;
    header.appendChild(_pill(node.op, passing, node.children.length, label));
    if (named) {
        if (named.name)
            header.appendChild(_text(named.name, "font-weight:600;"));
        else if (node.op !== "and")
            header.appendChild(
                _text(named.kind, "color:var(--fgColor-muted, #59636e);"),
            );
    }
    if (PILLS[node.op].note && !node.match) {
        header.appendChild(
            _text(PILLS[node.op].note, "color:var(--fgColor-muted, #59636e);"),
        );
    }
    wrap.appendChild(header);
    if (node.match) return wrap;
    const rail = _rail();
    if (depth + 1 >= MAX_TREE_DEPTH) {
        rail.appendChild(_showMore(node.children, states, depth + 1));
    } else {
        _appendChildren(rail, node, states, depth + 1);
    }
    wrap.appendChild(rail);
    return wrap;
}

// A group's unmet children in detail, the rest in one "✓" line.
function _appendChildren(container, node, states, depth) {
    const unmet =
        node.op === "not"
            ? node.children
            : node.children.filter((c) => !c.match);
    const met = node.op === "not" ? [] : node.children.filter((c) => c.match);
    const shown = unmet.slice(0, MAX_TREE_ROWS);
    for (const child of shown)
        container.appendChild(_nodeRows(child, states, depth));
    if (unmet.length > shown.length)
        container.appendChild(
            _showMore(unmet.slice(shown.length), states, depth),
        );
    if (met.length > 0) container.appendChild(_metLine(met, states));
}

function _showMore(nodes, states, depth) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;min-width:0;";
    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;min-width:0;";
    list.hidden = true;
    for (const node of nodes)
        list.appendChild(_nodeRows(node, states, Math.min(depth, 1)));
    const row = _row();
    row.setAttribute("data-mergify-tree-more", String(nodes.length));
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.style.cssText =
        "padding:0;border:0;background:none;cursor:pointer;font:inherit;color:var(--fgColor-accent, #0969da);";
    button.textContent = `Show ${nodes.length} more`;
    button.onclick = () => {
        list.hidden = !list.hidden;
        button.setAttribute("aria-expanded", String(!list.hidden));
        button.textContent = list.hidden
            ? `Show ${nodes.length} more`
            : "Show less";
    };
    row.appendChild(button);
    wrap.append(list, row);
    return wrap;
}

// The rule's name when the payload notes it; its rank among several when it
// does not; nothing for a lone rule.
function _ruleName(node, index, total) {
    // The note is markdown: the name sits in a code span.
    const named = /queue rule (.+)$/
        .exec(node.desc)?.[1]
        ?.replace(/`/g, "")
        .trim();
    if (named) return named;
    return total > 1 ? String(index + 1) : "";
}

function _closestLabel() {
    const label = document.createElement("span");
    label.setAttribute("data-mergify-tree-closest", "");
    label.style.cssText =
        "flex-shrink:0;padding:0 7px;border:1px solid var(--borderColor-accent-emphasis, #0969da);border-radius:2em;color:var(--fgColor-accent, #0969da);font-size:12px;font-weight:500;line-height:18px;";
    label.textContent = "Closest";
    return label;
}

function _ruleBranch(rule, states, { closest, several, open }) {
    const missing = _unmetLeaves(rule.node);
    const header = _row();
    header.setAttribute("data-mergify-tree-rule", rule.name);
    header.appendChild(_mark(_nodeMark(rule.node, states)));
    const name = document.createElement("span");
    name.style.cssText =
        "display:flex;align-items:center;gap:6px;flex:1;min-width:0;";
    name.append(
        _text(
            "Queue rule",
            "flex-shrink:0;color:var(--fgColor-muted, #59636e);",
        ),
    );
    if (rule.name) name.appendChild(_text(rule.name, "font-weight:600;"));
    if (closest && several) name.appendChild(_closestLabel());
    header.appendChild(name);
    const rail = _rail();
    _appendChildren(rail, rule.node, states, 1);
    // One rule: the row above already counts it and folds it.
    if (!several) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;min-width:0;";
        wrap.append(header, rail);
        return wrap;
    }
    const count = header.appendChild(
        _text(
            missing === 0 ? "matches" : `${missing} missing`,
            "flex-shrink:0;color:var(--fgColor-muted, #59636e);font-variant-numeric:tabular-nums;",
        ),
    );
    count.setAttribute("data-mergify-tree-missing", "");
    return _disclosure(header, rail, open);
}

function _detailsLink(runUrl) {
    const row = _row();
    row.style.paddingTop = "4px";
    const link = document.createElement("a");
    link.href = runUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = "color:var(--fgColor-accent, #0969da);font-size:12px;";
    link.textContent = "View details";
    row.appendChild(link);
    return row;
}

// The page's tree laid out as drawn: the requirements every rule shares, then
// the rules a pull request can still reach, the closest first. Null when the
// check carried no tree.
function _layout(conditions) {
    const entry = conditions?.entry;
    if (!entry) return null;
    const states = conditions.checkStates ?? {};
    // The "any of" over the queue rules: named so when the payload notes it,
    // else the one whose options are all "all of" groups.
    const rulesNode =
        entry.find(
            (n) => n.op === "or" && n.desc.endsWith("queue conditions"),
        ) ??
        entry.find(
            (n) =>
                n.op === "or" &&
                n.children.length > 0 &&
                n.children.every((c) => c.op === "and"),
        );
    // The Merge Protections check requirement repeats the protection groups
    // drawn under the rule: drop it when they are there.
    const protectionsShown = rulesNode ? _hasProtectionGroup(rulesNode) : false;
    const requirements = entry
        .filter(
            (n) =>
                n !== rulesNode &&
                !n.match &&
                !isOutOfReach(n) &&
                !(protectionsShown && isProtectionsCheckGroup(n)),
        )
        .map(_alone);

    const total = rulesNode?.children.length ?? 0;
    let rules = (rulesNode?.children ?? []).map((node, index) => ({
        name: _ruleName(node, index, total),
        node: _reachable(_flattened(node)),
        order: index,
    }));
    const reachable = rules.filter((r) => !isOutOfReach(r.node));
    if (reachable.length > 0) rules = reachable;
    // Closest first: a rule that can still match, then the fewest missing.
    const stuck = (r) => (_nodeMark(r.node, states) === "failed" ? 1 : 0);
    rules.sort(
        (a, b) =>
            stuck(a) - stuck(b) ||
            _unmetLeaves(a.node) - _unmetLeaves(b.node) ||
            a.order - b.order,
    );
    return { states, requirements, rules };
}

// ---- Verdict -------------------------------------------------------------

// The state the merge-box row shows, in the three colours of GitHub's own
// rows: "met" when the check says the queue is ready; "blocked" when a shared
// requirement, or every queue rule, has a condition that fails until someone
// changes the pull request (a failed check, the wrong base branch, files the
// rule is not about, a conflict); "waiting" otherwise. summary is the one-line
// count of what is missing, for the closest rule.
export function conditionsVerdict(conditions) {
    if (!conditions) return null;
    if (conditions.met) {
        return { state: "met", summary: "Ready to enter the merge queue" };
    }
    const layout = _layout(conditions);
    const unknown = {
        state: "waiting",
        summary: "Some queue conditions are unmet",
    };
    if (!layout) return unknown;
    const { states, requirements, rules } = layout;
    const shared = requirements.filter((n) => !isProtectionsCheckGroup(n));
    const closest = rules[0]?.node;
    const items = [
        ...shared,
        ...(closest && !closest.match
            ? closest.op === "and"
                ? closest.children.filter((c) => !c.match)
                : [closest]
            : []),
    ];
    const parts = _missingCounts(items, states);
    if (rules.length > 1) parts.push(`closest of ${rules.length} queue rules`);
    const stuck = (node) => _nodeMark(node, states) === "failed";
    const blocked =
        shared.some(stuck) ||
        (rules.length > 0 && rules.every((r) => stuck(r.node)));
    if (parts.length === 0) return unknown;
    return {
        state: blocked ? "blocked" : "waiting",
        summary: parts.join(" · "),
    };
}

const CHECK_ATTRIBUTE = /^(?:check|status)-[a-z-]+\s*=/;

// What a missing condition is, for the count.
function _missingKind(node, states) {
    const label = node.label;
    const state = _checkState(label, states);
    if (state === "failed") return { key: "failed" };
    if (/^-conflict$/.test(label)) return { key: "conflict" };
    if (/^base\s*(?:=|!=|~=)/.test(label)) return { key: "base" };
    if (FILES_ATTRIBUTE.test(label)) return { key: "files" };
    if (state === "running") return { key: "running" };
    if (CHECK_ATTRIBUTE.test(label)) return { key: "expected" };
    const approvals = /^#approved-reviews-by\s*>=?\s*(\d+)/.exec(label);
    if (approvals) return { key: "approval", required: Number(approvals[1]) };
    if (/^-?label\s*(?:=|~=|!=)/.test(label))
        return { key: label.startsWith("-") ? "unlabel" : "label" };
    if (/^-draft$/.test(label)) return { key: "draft" };
    if (/^(?:current-datetime|schedule)\b/.test(label))
        return { key: "schedule" };
    return { key: "other" };
}

const MISSING_PHRASES = [
    ["failed", (n) => `${n} check${n > 1 ? "s" : ""} failed`],
    ["conflict", () => "conflicts with the base branch"],
    ["base", () => "wrong base branch"],
    ["files", () => "files outside the rule"],
    ["running", (n) => `${n} check${n > 1 ? "s" : ""} running`],
    ["expected", (n) => `${n} check${n > 1 ? "s" : ""} expected`],
    // One condition, however many approvals it asks for: the page does not
    // say how many are already given.
    [
        "approval",
        (_n, k) =>
            k === 1
                ? "1 approval missing"
                : `approvals missing (${k} required)`,
    ],
    ["label", (n) => `${n} label${n > 1 ? "s" : ""} missing`],
    ["unlabel", (n) => `${n} label${n > 1 ? "s" : ""} to remove`],
    ["draft", () => "still a draft"],
    ["schedule", () => "waiting for its schedule"],
    ["other", (n) => `${n} condition${n > 1 ? "s" : ""} missing`],
];

const CHECK_VERBS = {
    success: "pass",
    "success-or-neutral": "pass or be neutral",
    failure: "fail",
    neutral: "be neutral",
    skipped: "be skipped",
};
const SAME_CHECK =
    /^check-(success-or-neutral|success|failure|neutral|skipped)\s*=\s*(.+)$/;

// "CI · ci or Labeled hotfix": a two-option group named, rather than counted
// as "1 condition".
function _optionsText(node) {
    if (
        node.op !== "or" ||
        node.children.length !== 2 ||
        node.children.some((c) => c.op !== "leaf")
    )
        return null;
    const checks = node.children.map((c) => SAME_CHECK.exec(c.label));
    if (checks.every(Boolean) && checks[0][2] === checks[1][2]) {
        const verbs = checks.map((m) => CHECK_VERBS[m[1]] ?? m[1]);
        return `CI · ${checks[0][2]} must ${verbs.join(" or ")}`;
    }
    return node.children
        .map((c) => {
            const words = humanCondition(c.label);
            return words
                ? `${words[0] ? `${words[0]} · ` : ""}${words[1]}`
                : c.label;
        })
        .join(" or ");
}

// An "all of" group (a merge protection, say) counts by its own missing
// conditions; an "any of" as one, named when it has two options, else as a
// failure, a running check or one condition by what keeps it out.
function _missingCounts(items, states) {
    const counts = new Map();
    const required = new Map();
    const named = [];
    const count = (item) => {
        if (item.op === "and") {
            for (const child of item.children) if (!child.match) count(child);
            return;
        }
        if (isProtectionsCheckGroup(item)) return;
        let kind;
        if (item.op === "leaf") kind = _missingKind(item, states);
        else {
            const options = _optionsText(item);
            if (options) {
                named.push(options);
                return;
            }
            const mark = _nodeMark(item, states);
            kind = {
                key:
                    mark === "failed"
                        ? "failed"
                        : mark === "running"
                          ? "running"
                          : "other",
            };
        }
        counts.set(kind.key, (counts.get(kind.key) ?? 0) + 1);
        if (kind.required !== undefined)
            required.set(
                kind.key,
                Math.max(required.get(kind.key) ?? 0, kind.required),
            );
    };
    for (const item of items) count(item);
    return [
        ...MISSING_PHRASES.filter(([key]) => counts.has(key)).map(
            ([key, phrase]) => phrase(counts.get(key), required.get(key)),
        ),
        ...named,
    ];
}

// ---- Entry point ---------------------------------------------------------

// Returns null when the page carried no tree to draw.
export function buildQueueConditionsTree(conditions) {
    const layout = _layout(conditions);
    if (!layout) return null;
    const { states, requirements, rules } = layout;

    const tree = document.createElement("div");
    tree.setAttribute("data-mergify-conditions-tree", "");
    tree.style.cssText = "display:flex;flex-direction:column;min-width:0;";
    // What every rule needs first: an open, non-draft, conflict-free PR.
    for (const node of requirements)
        tree.appendChild(_nodeRows(_flattened(node), states, 1));
    rules.forEach((rule, index) => {
        tree.appendChild(
            _ruleBranch(rule, states, {
                closest: index === 0,
                several: rules.length > 1,
                open: index === 0,
            }),
        );
    });
    if (conditions.runUrl) tree.appendChild(_detailsLink(conditions.runUrl));
    return tree;
}
