// The merge-box conditions row's reading of the evaluated tree the engine puts
// in the check's payload: the queue rules a pull request can still reach, the
// closest first, and from them the row's verdict and its count line.

// generic_evaluator.GenericRulesEvaluator.FIXED_ATTRIBUTES: what the author
// cannot change on this pull request.
const FIXED_ATTRIBUTES = new Set(["head", "author"]);

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

// ---- Marks ---------------------------------------------------------------

export const FILES_ATTRIBUTE =
    /^-?#?(?:added-|modified-|removed-)?files\s*(?:=|!=|~=|>=|<=|>|<)/;

// Unmet conditions that fail until someone changes the pull request.
function _fixedFailure(label) {
    return (
        /^-conflict$/.test(label) ||
        /^base\s*=/.test(label) ||
        FILES_ATTRIBUTE.test(label)
    );
}

function _leafMark(node) {
    if (node.match) return "met";
    if (_fixedFailure(node.label)) return "failed";
    return "todo";
}

function _nodeMark(node) {
    if (node.match) return "met";
    if (node.op === "leaf") return _leafMark(node);
    if (node.op === "not") return "todo";
    const marks = node.children.filter((c) => !c.match).map(_nodeMark);
    if (node.op === "or")
        return marks.length > 0 && marks.every((m) => m === "failed")
            ? "failed"
            : "todo";
    return marks.includes("failed") ? "failed" : "todo";
}

// The page's tree laid out: the requirements every rule shares, then the rules
// a pull request can still reach, the closest first. Null when the
// check carried no tree.
function _layout(conditions) {
    const entry = conditions?.entry;
    if (!entry) return null;
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

    let rules = (rulesNode?.children ?? []).map((node, index) => ({
        node: _reachable(_flattened(node)),
        order: index,
    }));
    const reachable = rules.filter((r) => !isOutOfReach(r.node));
    if (reachable.length > 0) rules = reachable;
    // Closest first: a rule that can still match, then the fewest missing.
    const stuck = (r) => (_nodeMark(r.node) === "failed" ? 1 : 0);
    rules.sort(
        (a, b) =>
            stuck(a) - stuck(b) ||
            _unmetLeaves(a.node) - _unmetLeaves(b.node) ||
            a.order - b.order,
    );
    return { requirements, rules };
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
    const { requirements, rules } = layout;
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
    const parts = _missingCounts(items);
    if (rules.length > 1) parts.push(`closest of ${rules.length} queue rules`);
    const stuck = (node) => _nodeMark(node) === "failed";
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
function _missingKind(node) {
    const label = node.label;
    if (/^-conflict$/.test(label)) return { key: "conflict" };
    if (/^base\s*(?:=|!=|~=)/.test(label)) return { key: "base" };
    if (FILES_ATTRIBUTE.test(label)) return { key: "files" };
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
    ["conflict", () => "conflicts with the base branch"],
    ["base", () => "wrong base branch"],
    ["files", () => "files outside the rule"],
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

// An "all of" group (a merge protection, say) counts by its own missing
// conditions; an "any of" as one condition.
function _missingCounts(items) {
    const counts = new Map();
    const required = new Map();
    const count = (item) => {
        if (item.op === "and") {
            for (const child of item.children) if (!child.match) count(child);
            return;
        }
        if (isProtectionsCheckGroup(item)) return;
        const kind = item.op === "leaf" ? _missingKind(item) : { key: "other" };
        counts.set(kind.key, (counts.get(kind.key) ?? 0) + 1);
        if (kind.required !== undefined)
            required.set(
                kind.key,
                Math.max(required.get(kind.key) ?? 0, kind.required),
            );
    };
    for (const item of items) count(item);
    return MISSING_PHRASES.filter(([key]) => counts.has(key)).map(
        ([key, phrase]) => phrase(counts.get(key), required.get(key)),
    );
}
