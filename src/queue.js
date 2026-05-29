import { MergifyCache } from "./cache.js";
import { debug } from "./debug.js";
import { getPullRequestData, isGitHubPullRequestPage } from "./dom.js";
import { getLogoSvg, parseSvg } from "./logo.js";
import { resetStackState } from "./stacks.js";

const QUEUE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>`;

const LOGS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 4.75a.75.75 0 0 1 1.5 0v3.44l1.97 1.97a.75.75 0 1 1-1.06 1.06l-2.19-2.19a.75.75 0 0 1-.22-.53Z"/></svg>`;

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

export function resetQueueState() {
    lastKnownQueueState = false;
    queueStateInitialized = false;
    if (queuePollTimer) {
        clearTimeout(queuePollTimer);
        queuePollTimer = null;
    }
    resetStackState();
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

export async function fetchQueueStateIfNeeded() {
    if (queueStateInitialized) return;
    queueStateInitialized = true;
    await fetchQueueState();
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
        if (window.location.pathname !== urlAtFetch) return;
        if (!checksResponse.ok) {
            debug(
                "fetchQueueState: checks page returned",
                checksResponse.status,
            );
            return;
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
            return;
        }

        debug("fetchQueueState: found check_run_id", match[1]);

        // Step 2: Fetch the specific check run page to get the description
        const runResponse = await fetch(
            `/${data.org}/${data.repo}/runs/${match[1]}`,
        );
        if (window.location.pathname !== urlAtFetch) return;
        if (!runResponse.ok) {
            debug("fetchQueueState: run page returned", runResponse.status);
            return;
        }

        const runHtml = await runResponse.text();
        lastKnownQueueState = isMergifyQueueCheckQueued(runHtml);
        debug("fetchQueueState: result =", lastKnownQueueState);
    } catch (error) {
        debug("Failed to fetch queue state:", error);
    }
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
    updateAllMergifyRows();
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

// Marker for the rows we inject. Use a data attribute rather than an id so
// the row can coexist multiple times across the legacy merge box and the new
// merge-status sidebar without clashing on uniqueness. Also avoids matching
// GitHub's native <section id="mergify"> for the Mergify GitHub App check.
export const MERGE_BOX_ROW_ATTR = "data-mergify-merge-box-row";

export function buildMergifyRow(variant = "default") {
    if (variant === "sidebar") return buildMergifySidebarRow();

    const state = deriveQueueButtonState();

    const row = document.createElement("div");
    // Variant is stored on the attribute so updateMergifyRow can rebuild
    // the row in the same style when state transitions from open to
    // merged/closed.
    row.setAttribute(MERGE_BOX_ROW_ATTR, "default");
    row.className =
        "bgColor-muted borderColor-muted border-top rounded-bottom-2";
    row.style.cssText =
        "display:flex;align-items:center;gap:8px;padding:var(--base-size-16,16px)!important;";

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

    if (state === "merged") {
        const status = document.createElement("span");
        status.style.color = "var(--fgColor-muted, #7d8590)";
        status.textContent = getMergedMessage();
        info.appendChild(status);
    }

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

    row.appendChild(info);

    return row;
}

function buildMergifySidebarRow() {
    const state = deriveQueueButtonState();

    const row = document.createElement("div");
    row.setAttribute(MERGE_BOX_ROW_ATTR, "sidebar");
    // Two-line layout that matches the surrounding native sections (border
    // rules on top and bottom, no muted background); action buttons on line
    // one, queue/logs on the left of line two and Mergify brand on the
    // right.
    row.className = "border-top border-bottom color-border-subtle";
    row.style.cssText =
        "display:flex;flex-direction:column;gap:8px;padding:var(--base-size-16,16px)!important;margin-top:var(--base-size-24,24px);";

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

    const secondLine = document.createElement("div");
    secondLine.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:8px;";

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

export function updateAllMergifyRows() {
    const rows = document.querySelectorAll(`[${MERGE_BOX_ROW_ATTR}]`);
    for (const row of rows) updateMergifyRow(row);
}

export function updateMergifyRow(row) {
    const state = deriveQueueButtonState();
    const oldBtn = row.querySelector("[data-mergify-queue-btn]");

    if (state === "merged" || state === "closed") {
        if (oldBtn) {
            // PR was open, now merged/closed — rebuild entire row, keeping
            // the same variant so the sidebar styling survives the swap.
            const variant = row.getAttribute(MERGE_BOX_ROW_ATTR) || "default";
            const newRow = buildMergifyRow(variant);
            row.replaceWith(newRow);
            debug("Mergify row rebuilt for state:", state);
        }
        return;
    }

    if (!oldBtn) return;
    if (oldBtn.getAttribute("data-mergify-queue-btn") === state) return;
    const newBtn = buildQueueButton(state);
    oldBtn.replaceWith(newBtn);
    debug("Queue button state:", state);
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
