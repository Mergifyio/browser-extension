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
