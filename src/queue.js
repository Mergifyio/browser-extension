import { MergifyCache } from "./cache.js";
import { debug } from "./debug.js";
import { getPullRequestData, isGitHubPullRequestPage } from "./dom.js";
import { getLogoSvg, parseSvg } from "./logo.js";
import { resetStackState } from "./stacks.js";

const QUEUE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`;

const LOGS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 4.75a.75.75 0 0 1 1.5 0v3.44l1.97 1.97a.75.75 0 1 1-1.06 1.06l-2.19-2.19a.75.75 0 0 1-.22-.53Z"/></svg>`;

export function formatEta(etaIso, now = Date.now()) {
    if (etaIso == null) return "";
    const eta = Date.parse(etaIso);
    if (Number.isNaN(eta)) return "";
    const deltaMs = eta - now;
    if (deltaMs < 0) {
        const overdueMin = Math.round(-deltaMs / 60000);
        return `overdue by ${overdueMin}m`;
    }
    if (deltaMs <= 5000) return "any moment";
    if (deltaMs < 60000) return `~${Math.round(deltaMs / 1000)}s`;
    return `~${Math.round(deltaMs / 60000)}m`;
}

export const BUTTONS = [
    {
        command: "refresh",
        label: "Refresh",
        tooltip: "Trigger Mergify to reevaluate the pull request",
        disableOnClosedPR: false,
    },
    {
        command: "rebase",
        label: "Rebase",
        tooltip: "Rebase the pull request against its base branch",
        disableOnClosedPR: true,
    },
    {
        command: "update",
        label: "Update",
        tooltip: "Update the pull request with its base branch",
        disableOnClosedPR: true,
    },
];

export const MERGED_MESSAGES = [
    "Merged while you weren't looking ✨",
    "Another one bites the queue 🎶",
    "Delivered. You're welcome 😎",
    "Merged faster than you can say 'LGTM'",
    "One less PR on your plate 🍽️",
    "Clean merge, zero drama ✅",
    "Shipped it! Back to coffee ☕",
    "This PR has left the queue 🚀",
    "Merged. No humans were harmed 🤖",
    "Queue in, merge out. Easy 🎯",
    "That's a wrap on this one 🌯",
    "Deployed to main, guilt-free 🌟",
];

// Descriptions that indicate the PR is actually in the merge queue
export const QUEUED_DESCRIPTIONS = [
    "In merge queue",
    "Queued for merge",
    "Running merge queue checks",
    "Merge queue checks ended",
];

export let lastKnownQueueState = false;
export let queueStateInitialized = false;
export let queuePollTimer = null;
export const QUEUE_POLL_INTERVAL = 15000;

// Marker for the rows we inject. Use a data attribute rather than an id so
// the row can coexist multiple times across the legacy merge box and the new
// merge-status sidebar without clashing on uniqueness. Also avoids matching
// GitHub's native <section id="mergify"> for the Mergify GitHub App check.
export const MERGE_BOX_ROW_ATTR = "data-mergify-merge-box-row";

export function resetQueueState() {
    lastKnownQueueState = false;
    queueStateInitialized = false;
    if (queuePollTimer) {
        clearTimeout(queuePollTimer);
        queuePollTimer = null;
    }
    stopEtaTicker();
    resetStackState();
}

export async function fetchQueueStateIfNeeded() {
    if (queueStateInitialized) return;
    queueStateInitialized = true;
    await fetchQueueState();
}

export function scheduleQueueStatePoll() {
    if (queuePollTimer) return;
    queuePollTimer = setTimeout(async () => {
        queuePollTimer = null;
        if (!isGitHubPullRequestPage()) return;
        const previousState = lastKnownQueueState;
        await fetchQueueState();
        if (previousState !== lastKnownQueueState) updateAllMergifyRows();
        if (isGitHubPullRequestPage()) scheduleQueueStatePoll();
    }, QUEUE_POLL_INTERVAL);
}

export function isMergifyQueueCheckQueued(text) {
    return QUEUED_DESCRIPTIONS.some((desc) => text.includes(desc));
}

export function isPullRequestOpen() {
    const opened = document.querySelector("span[data-status=pullOpened]");
    const draft = document.querySelector("span[data-status=draft]");
    const closed = document.querySelector("span[data-status=pullClosed]");
    const merged = document.querySelector("span[data-status=pullMerged]");
    if (opened || draft) return true;
    if (closed || merged) return false;

    const oldStatusBadge = document.querySelector("span.State");
    if (oldStatusBadge) {
        const status = oldStatusBadge.getAttribute("title").split(": ")[1];
        if (!status) {
            console.warn("Can't find pull request status");
            // Assume it's open if we can't find the status
            return true;
        }
        // status can be "open", "draft", "merged" or "closed"
        return ["open", "draft"].includes(status.toLowerCase());
    }

    // Assume it's open if we can't find the status
    return true;
}

export function wasMergedByMergify() {
    const timelineItems = document.querySelectorAll(".TimelineItem");
    for (const item of timelineItems) {
        if (!item.textContent.includes("merged commit")) continue;
        if (item.querySelector('a[href="/apps/mergify"]')) return true;
    }
    return false;
}

export function getMergedMessage() {
    // Use PR number as seed for consistent message per PR
    const data = getPullRequestData();
    const index = Number.parseInt(data.pull, 10) % MERGED_MESSAGES.length;
    return MERGED_MESSAGES[index];
}

export function isMergifyEnabledOnTheRepo(hasMergifyConfiguration) {
    const appIconUrl = "https://avatars.githubusercontent.com/in/10562";
    const appIconFound = document.querySelector(`img[src^="${appIconUrl}?"]`);
    if (appIconFound) {
        const { org, repo } = getPullRequestData();
        const mergifyCache = new MergifyCache();
        const cachedValue = mergifyCache.get(org, repo);
        // Mergify is detected - update cache if it differs
        if (cachedValue !== true) {
            mergifyCache.update(org, repo, true);
        }
        return true;
    }
    return hasMergifyConfiguration;
}

export async function getMergifyConfigurationStatus() {
    const mergifyCache = new MergifyCache();
    const { org, repo } = getPullRequestData();
    const cachedValue = mergifyCache.get(org, repo);
    if (cachedValue) {
        return true;
    }

    const response = await fetch(
        `/search?q=repo%3A${org}%2F${repo}+%28.mergify.yml+OR+.mergify%2Fconfig.yml+OR+.github%2Fmergify.yml%29&type=code`,
    );
    const html = await response.text();

    // Parse into a DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const h2 = doc.querySelector("h2#search-results-count");
    debug(h2?.textContent.trim());

    // Find and match the <h2>
    const match = doc
        .querySelector("h2#search-results-count")
        ?.textContent.trim()
        .match(/^(?<count>\d+) files?$/);

    debug(match);
    const found = Boolean(match && Number.parseInt(match.groups.count, 10) > 0);
    debug(found);
    debug(cachedValue);

    if (cachedValue !== found) {
        debug("update");
        mergifyCache.update(org, repo, found);
    }
    return found;
}

export function isPullRequestQueued() {
    // Read from expanded checks list if available
    const checksSection = document.querySelector(
        'section[aria-label="Checks"]',
    );
    if (checksSection) {
        const listItems = checksSection.querySelectorAll("li");
        if (listItems.length > 0) {
            let queued = false;
            for (const li of listItems) {
                if (!li.textContent.includes("Mergify Merge Queue")) continue;
                // Check the description text to distinguish "queued" from "evaluating"
                if (isMergifyQueueCheckQueued(li.textContent)) {
                    queued = true;
                    break;
                }
            }
            lastKnownQueueState = queued;
        }
    }
    return lastKnownQueueState;
}

export async function fetchQueueState() {
    const urlAtFetch = window.location.pathname;
    const data = getPullRequestData();
    debug("fetchQueueState: starting for", data.org, data.repo, data.pull);
    try {
        // Step 1: Fetch the checks page to find the Mergify Merge Queue check run ID
        const checksResponse = await fetch(
            `/${data.org}/${data.repo}/pull/${data.pull}/checks`,
        );
        if (window.location.pathname !== urlAtFetch) return lastKnownQueueState;
        if (!checksResponse.ok) {
            debug(
                "fetchQueueState: checks page returned",
                checksResponse.status,
            );
            return lastKnownQueueState;
        }

        const checksHtml = await checksResponse.text();
        debug(
            "fetchQueueState: checks page loaded,",
            checksHtml.length,
            "chars",
        );
        const match = checksHtml.match(
            /check_run_id=(\d+)[^>]*>\s*<span>Mergify Merge Queue/,
        );
        if (!match) {
            debug("fetchQueueState: no Mergify Merge Queue check run found");
            lastKnownQueueState = false;
            return lastKnownQueueState;
        }

        debug("fetchQueueState: found check_run_id", match[1]);

        // Step 2: Fetch the specific check run page to get the description
        const runResponse = await fetch(
            `/${data.org}/${data.repo}/runs/${match[1]}`,
        );
        if (window.location.pathname !== urlAtFetch) return lastKnownQueueState;
        if (!runResponse.ok) {
            debug("fetchQueueState: run page returned", runResponse.status);
            return lastKnownQueueState;
        }

        const runHtml = await runResponse.text();
        lastKnownQueueState = isMergifyQueueCheckQueued(runHtml);
        debug("fetchQueueState: result =", lastKnownQueueState);
    } catch (error) {
        debug("Failed to fetch queue state:", error);
    }
    return lastKnownQueueState;
}

export function findLastMergifyCommand() {
    const comments = document.querySelectorAll(
        ".TimelineItem, .js-comment-container",
    );
    for (let i = comments.length - 1; i >= 0; i--) {
        const body = comments[i].querySelector(".comment-body");
        if (!body) continue;
        // Only match short command comments (e.g. "@Mergifyio queue"),
        // not Mergify's own long status reports that mention the command.
        const text = body.textContent.trim();
        if (text.length > 100) continue;
        const lower = text.toLowerCase();
        for (const cmd of ["dequeue", "queue"]) {
            if (
                lower.includes(`@mergifyio ${cmd}`) ||
                lower.includes(`@mergify ${cmd}`)
            ) {
                const acknowledged = !!comments[i].querySelector(
                    'button.social-reaction-summary-item[value^="THUMBS_UP"]',
                );
                return { command: cmd, acknowledged };
            }
        }
    }
    return null;
}

export function deriveQueueButtonState() {
    if (!isPullRequestOpen()) {
        return wasMergedByMergify() ? "merged" : "closed";
    }
    const checkRunQueued = isPullRequestQueued();
    const lastCmd = findLastMergifyCommand();
    // Only show pending state when the command hasn't been acknowledged yet.
    // Once Mergify thumbs-ups the comment, it was processed — trust the check run.
    if (lastCmd && !lastCmd.acknowledged) {
        if (lastCmd.command === "queue" && !checkRunQueued) return "queuing";
        if (lastCmd.command === "dequeue" && checkRunQueued) return "dequeuing";
    }
    return checkRunQueued ? "queued" : "unqueued";
}

export function postCommand(command) {
    const input = document.querySelector("#new_comment_field");
    input.removeAttribute("disabled");
    input.value = `@mergifyio ${command}`;
    const button = Array.from(
        document.querySelectorAll("#partial-new-comment-form-actions button"),
    ).find((el) => el.textContent.trim() === "Comment");
    button.removeAttribute("disabled");
    button.click();
}

export function postCommandAndUpdate(command) {
    postCommand(command);
    for (const row of document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`)) {
        updateMergifyRow(row);
    }
}

export function buildMergeBoxButton(
    command,
    label,
    tooltip,
    disabled,
    variant,
) {
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("title", tooltip);
    if (disabled) {
        button.setAttribute("disabled", "disabled");
    }
    button.onclick = () => postCommand(command);
    button.style.cssText = `
        border: none;
        border-radius: 6px;
        box-sizing: border-box;
        cursor: pointer;
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        height: 32px;
        line-height: 21px;
        padding: 0 12px;
        white-space: nowrap;
        flex-shrink: 0;
    `;

    if (variant === "primary") {
        button.style.backgroundColor =
            "var(--button-primary-bgColor-rest, #238636)";
        button.style.color = "var(--button-primary-fgColor-rest, #ffffff)";
        button.style.border =
            "1px solid var(--button-primary-borderColor-rest, transparent)";
    } else if (variant === "danger") {
        button.style.backgroundColor =
            "var(--button-danger-bgColor-rest, #da3633)";
        button.style.color = "var(--button-danger-fgColor-rest, #ffffff)";
        button.style.border =
            "1px solid var(--button-danger-borderColor-rest, transparent)";
    } else {
        button.style.backgroundColor =
            "var(--button-default-bgColor-rest, #21262d)";
        button.style.color = "var(--button-default-fgColor-rest, #e6edf3)";
        button.style.border =
            "1px solid var(--button-default-borderColor-rest, #30363d)";
        button.style.fontWeight = "normal";
    }

    if (disabled) {
        button.style.opacity = "0.5";
        button.style.cursor = "not-allowed";
    }

    button.textContent = label;
    return button;
}

export function buildQueueButton(state) {
    let btn;
    switch (state) {
        case "queuing":
        case "dequeuing":
            btn = buildMergeBoxButton(
                state === "queuing" ? "queue" : "dequeue",
                state === "queuing"
                    ? "Adding to merge queue…"
                    : "Removing from merge queue…",
                "Waiting for Mergify to process…",
                true,
                "secondary",
            );
            break;
        case "queued":
            btn = buildMergeBoxButton(
                "dequeue",
                "Remove from merge queue",
                "Remove the pull request from the merge queue",
                false,
                "danger",
            );
            btn.onclick = () => postCommandAndUpdate("dequeue");
            break;
        default:
            btn = buildMergeBoxButton(
                "queue",
                "Add to merge queue",
                "Add the pull request to the merge queue",
                false,
                "primary",
            );
            btn.onclick = () => postCommandAndUpdate("queue");
            break;
    }
    btn.setAttribute("data-mergify-queue-btn", state);
    return btn;
}

export function getEventLogLink() {
    const data = getPullRequestData();
    return `https://dashboard.mergify.com/event-logs?login=${data.org}&repository=${data.repo}&pullRequestNumber=${data.pull}`;
}

export function getMergeQueueLink() {
    const data = getPullRequestData();
    return `https://dashboard.mergify.com/queues?login=${data.org}&repository=${data.repo}&branch=main&pull-request-number=${data.pull}`;
}

// Read the current payload from mqPayload via lazy require to sidestep the
// circular dependency (mqPayload.js imports fetchQueueState from this module).
function _currentPayload() {
    try {
        const cur = require("./mqPayload.js").getCurrent();
        return cur && cur.source === "payload" ? cur.payload : null;
    } catch (_e) {
        return null;
    }
}

function buildLegacyDefaultRow() {
    const state = deriveQueueButtonState();

    const row = document.createElement("div");
    row.setAttribute(MERGE_BOX_ROW_ATTR, "default");
    row.dataset.mergifyShape = "legacy";
    row.className =
        "bgColor-muted borderColor-muted border-top rounded-bottom-2";
    row.style.cssText =
        "display:flex;align-items:center;gap:8px;padding:var(--base-size-16,16px)!important;flex-wrap:wrap;";

    if (state !== "merged" && state !== "closed") {
        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:6px;";
        buttons.appendChild(buildQueueButton(state));
        for (const btn of BUTTONS) {
            buttons.appendChild(
                buildMergeBoxButton(
                    btn.command,
                    btn.label,
                    btn.tooltip,
                    false,
                    "secondary",
                ),
            );
        }
        row.appendChild(buttons);
    }

    const info = buildBrandAndLinks();

    if (state === "merged") {
        const status = document.createElement("span");
        status.style.color = "var(--fgColor-muted, #7d8590)";
        status.textContent = getMergedMessage();
        // The brand anchor is the last child of the info div returned by
        // buildBrandAndLinks(); insert the merged status before it so the
        // visual order (queue link, logs link, merged message, brand) is
        // preserved.
        info.insertBefore(status, info.lastChild);
    }

    row.appendChild(info);

    return row;
}

function buildLegacySidebarRow() {
    const state = deriveQueueButtonState();

    const row = document.createElement("div");
    row.setAttribute(MERGE_BOX_ROW_ATTR, "sidebar");
    row.dataset.mergifyShape = "legacy";
    // Two-line layout that matches the surrounding native sections (border
    // rules on top and bottom, no muted background); action buttons on line
    // one, queue/logs on the left of line two and Mergify brand on the right.
    row.className = "border-top border-bottom color-border-subtle";
    row.style.cssText =
        "display:flex;flex-direction:column;gap:8px;padding:var(--base-size-16,16px)!important;margin-top:var(--base-size-24,24px);";

    if (state !== "merged" && state !== "closed") {
        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
        buttons.appendChild(buildQueueButton(state));
        for (const btn of BUTTONS) {
            buttons.appendChild(
                buildMergeBoxButton(
                    btn.command,
                    btn.label,
                    btn.tooltip,
                    false,
                    "secondary",
                ),
            );
        }
        row.appendChild(buttons);
    }

    const secondLine = document.createElement("div");
    secondLine.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:8px;";

    // Sidebar's second line keeps queue+logs (and any merged-message badge)
    // on the left, with the Mergify brand pinned to the right via
    // justify-content:space-between. Mirrors PR #494's structure so the
    // dashboard-link tests pass.
    const links = document.createElement("div");
    links.style.cssText =
        "display:flex;align-items:center;gap:12px;font-size:14px;";
    function appendLink(href, text, iconSvg) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.cssText =
            "color:var(--fgColor-accent, #58a6ff);text-decoration:none;display:inline-flex;align-items:center;gap:4px;";
        link.appendChild(parseSvg(iconSvg));
        link.appendChild(document.createTextNode(text));
        links.appendChild(link);
    }
    appendLink(getMergeQueueLink(), "queue", QUEUE_ICON_SVG);
    appendLink(getEventLogLink(), "logs", LOGS_ICON_SVG);
    if (state === "merged") {
        const status = document.createElement("span");
        status.style.color = "var(--fgColor-muted, #7d8590)";
        status.textContent = getMergedMessage();
        links.appendChild(status);
    }
    secondLine.appendChild(links);

    const brand = document.createElement("a");
    brand.href = "https://dashboard.mergify.com";
    brand.target = "_blank";
    brand.rel = "noopener noreferrer";
    brand.title = "Open Mergify dashboard";
    brand.style.cssText =
        "display:flex;align-items:center;gap:6px;color:var(--fgColor-default, #e6edf3);text-decoration:none;font-weight:600;";
    const svgEl = parseSvg(getLogoSvg());
    svgEl.setAttribute("width", "20");
    svgEl.setAttribute("height", "20");
    brand.appendChild(svgEl);
    const brandText = document.createElement("span");
    brandText.textContent = "Mergify";
    brand.appendChild(brandText);
    secondLine.appendChild(brand);
    row.appendChild(secondLine);

    return row;
}

function buildLegacyRow(variant = "default") {
    if (variant === "sidebar") return buildLegacySidebarRow();
    return buildLegacyDefaultRow();
}

export function buildMergifyRow(variant = "default") {
    const payload = _currentPayload();
    if (payload) return buildRichRow(payload, variant);
    return buildLegacyRow(variant);
}

export function updateAllMergifyRows() {
    const rows = document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`);
    for (const row of rows) updateMergifyRow(row);
}

export function updateMergifyRow(row) {
    const variant = row.getAttribute(MERGE_BOX_ROW_ATTR) || "default";
    const currentShape = row.dataset.mergifyShape || "legacy";
    const payload = _currentPayload();
    const incomingShape = payload ? "rich" : "legacy";

    if (incomingShape !== currentShape) {
        stopEtaTicker();
        const replacement = payload
            ? buildRichRow(payload, variant)
            : buildLegacyRow(variant);
        row.replaceWith(replacement);
        debug("Mergify row swapped:", currentShape, "→", incomingShape);
        return;
    }

    if (incomingShape === "rich") {
        const next = buildRichRow(payload, variant);
        // Snapshot the children before replaceChildren starts moving them.
        // Spread already eagerly iterates, but Array.from makes the snapshot
        // explicit so the live-NodeList shape can't trip up a future reader
        // (or static analyzer) reasoning about iteration-during-mutation.
        row.replaceChildren(...Array.from(next.childNodes));
        _etaPayload = payload;
        debug("Mergify rich row patched:", payload.state);
        return;
    }

    _legacyPatch(row, variant);
}

function _legacyPatch(row, variant = "default") {
    const derived = deriveQueueButtonState();
    const oldBtn = row.querySelector("[data-mergify-queue-btn]");
    if (derived === "merged" || derived === "closed") {
        if (oldBtn) {
            const newRow = buildLegacyRow(variant);
            row.replaceWith(newRow);
            debug("Mergify legacy row rebuilt for state:", derived);
        }
        return;
    }
    if (!oldBtn) return;
    if (oldBtn.getAttribute("data-mergify-queue-btn") === derived) return;
    const newBtn = buildQueueButton(derived);
    oldBtn.replaceWith(newBtn);
    debug("Legacy queue button state:", derived);
}

// Walk the condition tree and produce a flat list of short labels describing
// what's still blocking the merge. Met conditions are skipped entirely.
// "any of" groups collapse to a single "any of: a, b, c" line so the user
// sees that ONE alternative is enough; all-of groups flatten transparently.
function _collectBlockers(nodes) {
    const out = [];
    for (const n of nodes) {
        if (n.match) continue;
        if (!n.subconditions || n.subconditions.length === 0) {
            out.push(n.description);
            continue;
        }
        const desc = (n.description || "").toLowerCase();
        if (desc.includes("any of") || desc.includes("not")) {
            // Format inline so the disjunction/negation is visible at a glance.
            const childTexts = n.subconditions
                .filter((c) => !c.match)
                .map((c) =>
                    c.subconditions && c.subconditions.length > 0
                        ? `(${_collectBlockers([c]).join(" · ")})`
                        : c.description,
                );
            out.push(`${n.description} ${childTexts.join(", ")}`);
        } else {
            // "all of" or unnamed group — flatten unmet children transparently.
            out.push(..._collectBlockers(n.subconditions));
        }
    }
    return out;
}

export function renderConditionsBlock(conditions) {
    if (!conditions || conditions.length === 0) return null;
    const blockers = _collectBlockers(conditions);

    const block = document.createElement("div");
    block.setAttribute("data-mergify-conditions", "");
    // No background fill — let the conditions block share the parent row's
    // surface so it reads as a continuation of the state row above, with
    // a subtle border + indent for separation.
    block.style.cssText =
        "padding:6px 16px 12px 40px;border-top:1px dashed var(--borderColor-muted, #30363d);";

    const heading = document.createElement("h4");
    heading.style.cssText =
        "margin:0 0 6px;font-size:11px;text-transform:none;letter-spacing:0;color:#7d8590;font-weight:600;display:flex;align-items:center;gap:6px;";
    if (blockers.length === 0) {
        const allMet = document.createElement("span");
        allMet.style.color = "#3fb950";
        allMet.textContent = "✓ All required conditions met";
        heading.appendChild(allMet);
    } else {
        heading.textContent =
            blockers.length === 1
                ? "Blocking the merge:"
                : `Blocking the merge (${blockers.length}):`;
    }
    block.appendChild(heading);

    for (const text of blockers) {
        const row = document.createElement("div");
        row.setAttribute("data-mergify-condition", "");
        row.style.cssText =
            "display:flex;align-items:flex-start;gap:8px;padding:2px 0;color:#c9d1d9;font-size:12px;";
        const dot = document.createElement("span");
        dot.className = "pending";
        dot.style.cssText = "color:#dbab09;flex-shrink:0;line-height:1.4;";
        dot.textContent = "●";
        const label = document.createElement("span");
        label.style.cssText =
            "word-break:break-word;line-height:1.4;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;";
        label.textContent = text;
        row.appendChild(dot);
        row.appendChild(label);
        block.appendChild(row);
    }
    return block;
}

const STATE_PILL_COPY = {
    waiting: { label: "Waiting", note: "queued conditions not yet met" },
    checking: { label: "Checking", note: "" },
    frozen: { label: "Frozen", note: "queue paused — freeze in effect" },
    bisecting: {
        label: "Bisecting",
        note: "train split — isolating a failure",
    },
    merged: { label: "Merged", note: "" },
    dequeued: { label: "Dequeued", note: "removed from queue" },
};

const STATE_PILL_COLORS = {
    waiting: {
        bg: "#7d859022",
        fg: "#c9d1d9",
        border: "#7d859055",
        pulse: false,
    },
    checking: {
        // GitHub's CI in-progress yellow.
        bg: "#dbab0922",
        fg: "#dbab09",
        border: "#dbab0966",
        pulse: true,
    },
    frozen: {
        bg: "#bb800922",
        fg: "#e3b341",
        border: "#bb800966",
        pulse: false,
    },
    bisecting: {
        bg: "#da363322",
        fg: "#f85149",
        border: "#da363366",
        pulse: true,
    },
    merged: {
        bg: "#3fb95022",
        fg: "#3fb950",
        border: "#3fb95055",
        pulse: false,
    },
    dequeued: {
        bg: "#da363322",
        fg: "#f85149",
        border: "#da363366",
        pulse: false,
    },
};

let _mqpStyleInjected = false;
function ensurePulseKeyframes() {
    if (_mqpStyleInjected) return;
    _mqpStyleInjected = true;
    const s = document.createElement("style");
    s.textContent = "@keyframes mqp-pulse { 50% { opacity: .4; } }";
    document.head.appendChild(s);
}

function buildStatePill(state) {
    const pill = document.createElement("span");
    pill.setAttribute("data-mergify-state-pill", "");
    pill.setAttribute("data-state", state);
    const c = STATE_PILL_COLORS[state];
    pill.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${c.bg};color:${c.fg};border:1px solid ${c.border};`;
    const dot = document.createElement("span");
    dot.style.cssText = `width:7px;height:7px;border-radius:50%;background:${c.fg};${c.pulse ? "animation:mqp-pulse 1.6s infinite;" : ""}`;
    pill.appendChild(dot);
    pill.appendChild(
        document.createTextNode(` ${STATE_PILL_COPY[state].label}`),
    );
    return pill;
}

function buildSpecPrLink(org, repo, prNumber) {
    const n = Number.parseInt(prNumber, 10);
    if (!Number.isFinite(n) || n <= 0 || String(n) !== String(prNumber))
        return null;
    const a = document.createElement("a");
    a.setAttribute("data-mergify-spec-pr", "");
    a.href = `/${org}/${repo}/pull/${n}`;
    a.title = `Open the draft pull request running CI for this merge`;
    a.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "gap:4px",
        "padding:3px 10px",
        "border-radius:6px",
        "border:1px solid var(--button-default-borderColor-rest, #30363d)",
        "background:var(--button-default-bgColor-rest, #21262d)",
        "color:var(--button-default-fgColor-rest, #e6edf3)",
        "font-size:12px",
        "font-weight:500",
        "text-decoration:none",
        "white-space:nowrap",
    ].join(";");
    a.textContent = `Batch PR #${n} →`;
    return a;
}

function buildBrandAndLinks() {
    const info = document.createElement("div");
    info.style.cssText =
        "display:flex;align-items:center;gap:12px;font-size:14px;margin-left:auto;";

    function appendLink(href, text, iconSvg) {
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.cssText =
            "color:var(--fgColor-accent, #58a6ff);text-decoration:none;display:inline-flex;align-items:center;gap:4px;";
        link.appendChild(parseSvg(iconSvg));
        link.appendChild(document.createTextNode(text));
        info.appendChild(link);
    }
    appendLink(getMergeQueueLink(), "queue", QUEUE_ICON_SVG);
    appendLink(getEventLogLink(), "logs", LOGS_ICON_SVG);

    const brand = document.createElement("a");
    brand.href = "https://dashboard.mergify.com";
    brand.target = "_blank";
    brand.rel = "noopener noreferrer";
    brand.title = "Open Mergify dashboard";
    brand.style.cssText =
        "display:flex;align-items:center;gap:6px;margin-left:8px;color:var(--fgColor-default, #e6edf3);text-decoration:none;font-weight:600;";
    const svgEl = parseSvg(getLogoSvg());
    svgEl.setAttribute("width", "20");
    svgEl.setAttribute("height", "20");
    brand.appendChild(svgEl);
    const brandText = document.createElement("span");
    brandText.textContent = "Mergify";
    brand.appendChild(brandText);
    info.appendChild(brand);

    return info;
}

function buildButtonsRow(queueButtonState) {
    const row = document.createElement("div");
    row.style.cssText =
        "display:flex;align-items:center;gap:8px;padding:var(--base-size-16,16px)!important;flex-wrap:wrap;";
    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    buttons.appendChild(buildQueueButton(queueButtonState));
    for (const btn of BUTTONS) {
        buttons.appendChild(
            buildMergeBoxButton(
                btn.command,
                btn.label,
                btn.tooltip,
                false,
                "secondary",
            ),
        );
    }
    row.appendChild(buttons);
    row.appendChild(buildBrandAndLinks());
    return row;
}

// Format a duration in minutes as a short human-readable string. Stays in
// `Nm` for short queue times, switches to `Hh Mm` once it exceeds an hour,
// and to `Dd Hh` past a day so long-running queue waits stay legible
// (e.g. 822m → `13h 42m`, 1500m → `1d 1h`).
export function formatDurationMinutes(totalMinutes) {
    const m = Math.max(0, Math.round(totalMinutes));
    if (m < 60) return `${m}m`;
    if (m < 24 * 60) {
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
    }
    const d = Math.floor(m / (24 * 60));
    const remH = Math.floor((m % (24 * 60)) / 60);
    return remH === 0 ? `${d}d` : `${d}d ${remH}h`;
}

function buildEtaMetaContent(payload) {
    const parts = [];
    if (payload.queued_at) {
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode("queued "));
        const queuedMin = (Date.now() - Date.parse(payload.queued_at)) / 60000;
        const strong = document.createElement("strong");
        strong.style.color = "var(--fgColor-default, #e6edf3)";
        strong.textContent = `${formatDurationMinutes(queuedMin)} ago`;
        frag.appendChild(strong);
        parts.push(frag);
    }
    const etaStr = formatEta(payload.estimated_time_of_merge);
    if (etaStr) {
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode("merging "));
        const strong = document.createElement("strong");
        strong.style.color = "var(--fgColor-default, #e6edf3)";
        strong.textContent = etaStr;
        frag.appendChild(strong);
        parts.push(frag);
    }
    if (STATE_PILL_COPY[payload.state] && STATE_PILL_COPY[payload.state].note) {
        parts.push(
            document.createTextNode(STATE_PILL_COPY[payload.state].note),
        );
    }
    // Interleave separators.
    const out = [];
    parts.forEach((frag, i) => {
        if (i > 0) out.push(document.createTextNode(" · "));
        out.push(frag);
    });
    return out;
}

function buildStateRow(payload, org, repo) {
    const row = document.createElement("div");
    row.style.cssText =
        "display:flex;align-items:center;gap:10px;padding:10px var(--base-size-16,16px);border-top:1px solid var(--borderColor-muted, #30363d);";

    // Brand prefix so it's unambiguous that this row reflects Mergify's
    // merge-queue state, not some other GitHub status.
    const brand = document.createElement("span");
    brand.style.cssText =
        "display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--fgColor-default, #e6edf3);";
    const svgEl = parseSvg(getLogoSvg());
    svgEl.setAttribute("width", "14");
    svgEl.setAttribute("height", "14");
    brand.appendChild(svgEl);
    brand.appendChild(document.createTextNode("Merge Queue"));
    row.appendChild(brand);

    row.appendChild(buildStatePill(payload.state));

    const meta = document.createElement("span");
    meta.setAttribute("data-mergify-eta", "");
    meta.style.cssText = "color:#7d8590;font-size:12px;";
    for (const node of buildEtaMetaContent(payload)) {
        meta.appendChild(node);
    }
    row.appendChild(meta);

    const specLink = buildSpecPrLink(org, repo, payload.speculative_check_pr);
    if (specLink) {
        const wrap = document.createElement("span");
        wrap.style.cssText = "margin-left:auto;";
        wrap.appendChild(specLink);
        row.appendChild(wrap);
    }
    return row;
}

function buildMergedRow() {
    const row = document.createElement("div");
    row.style.cssText =
        "display:flex;align-items:center;gap:12px;padding:var(--base-size-16,16px)!important;";
    row.appendChild(buildStatePill("merged"));
    const msg = document.createElement("span");
    msg.setAttribute("data-mergify-merged-msg", "");
    msg.style.cssText = "color:#7d8590;font-size:12px;";
    msg.textContent = getMergedMessage();
    row.appendChild(msg);
    row.appendChild(buildBrandAndLinks());
    return row;
}

function deriveQueueButtonStateFromPayload(state) {
    if (state === "checking" || state === "frozen" || state === "bisecting")
        return "queued";
    return "unqueued";
}

export function buildRichRow(payload, variant = "default") {
    ensurePulseKeyframes();
    const data = getPullRequestData();
    const row = document.createElement("div");
    row.setAttribute(MERGE_BOX_ROW_ATTR, variant);
    row.dataset.mergifyShape = "rich";
    row.className =
        variant === "sidebar"
            ? "border-top border-bottom color-border-subtle"
            : "bgColor-muted borderColor-muted border-top rounded-bottom-2";

    if (payload.state === "merged") {
        row.appendChild(buildMergedRow());
        return row;
    }

    const queueBtnState = deriveQueueButtonStateFromPayload(payload.state);
    row.appendChild(buildButtonsRow(queueBtnState));
    row.appendChild(buildStateRow(payload, data.org, data.repo));

    const conditions = renderConditionsBlock(payload.required_conditions);
    if (conditions) row.appendChild(conditions);

    return row;
}

let _etaTimer = null;
let _etaPayload = null;

function _tickAllEtaMetas() {
    if (!_etaPayload) {
        stopEtaTicker();
        return;
    }
    const metas = document.querySelectorAll(
        `[${MERGE_BOX_ROW_ATTR}] [data-mergify-eta]`,
    );
    if (metas.length === 0) {
        // No live rows to tick anymore (all detached).
        stopEtaTicker();
        return;
    }
    for (const meta of metas) {
        meta.replaceChildren(...buildEtaMetaContent(_etaPayload));
    }
}

export function startEtaTicker(payload) {
    stopEtaTicker();
    if (!payload?.estimated_time_of_merge) return;
    _etaPayload = payload;
    _etaTimer = setInterval(_tickAllEtaMetas, 1000);
}

export function stopEtaTicker() {
    if (_etaTimer != null) {
        clearInterval(_etaTimer);
        _etaTimer = null;
    }
    _etaPayload = null;
}
