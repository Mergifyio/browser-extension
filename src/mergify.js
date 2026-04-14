// ==UserScript==
// @name         Mergify
// @namespace    http://tampermonkey.net/
// @version      2024-03-13
// @description  try to take over the world!
// @author       Mehdi Abaakouk<sileht@mergify.com>
// @match        https://github.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mergify.com
// @grant        none
// ==/UserScript==

const LOGO_WHITE_SVG = `<svg width="32" height="32" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_11862_5683)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 25C19.4036 25 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 5.59644 25 12.5 25ZM6.33336 10.8363C5.62696 10.5675 5.12502 9.88399 5.12502 9.08325C5.12502 8.04772 5.96449 7.20825 7.00002 7.20825C7.937 7.20825 8.71346 7.89553 8.85276 8.79347C8.95713 8.71964 9.06732 8.65233 9.18336 8.59155C9.65003 8.33599 10.1778 8.20821 10.7667 8.20821C11.3223 8.20821 11.8278 8.33599 12.2834 8.59155C12.6651 8.7964 12.9806 9.07538 13.2297 9.42849C13.499 9.08483 13.828 8.8114 14.2167 8.60821C14.7056 8.34154 15.25 8.20821 15.85 8.20821C16.45 8.20821 16.9889 8.33599 17.4667 8.59155C17.9445 8.83599 18.3223 9.19154 18.6 9.65821C18.8778 10.1249 19.0167 10.6804 19.0167 11.3249V14.3979C19.4863 14.7387 19.7917 15.292 19.7917 15.9165C19.7917 16.9521 18.9523 17.7915 17.9167 17.7915C16.8812 17.7915 16.0417 16.9521 16.0417 15.9165C16.0417 15.2846 16.3543 14.7257 16.8334 14.386V11.6749C16.8334 11.2082 16.6834 10.8471 16.3834 10.5915C16.0945 10.3249 15.7334 10.1915 15.3 10.1915C15.0223 10.1915 14.7611 10.2527 14.5167 10.3749C14.2834 10.486 14.1 10.6527 13.9667 10.8749C13.8334 11.0971 13.7667 11.3638 13.7667 11.6749V14.398C14.2363 14.7387 14.5417 15.292 14.5417 15.9165C14.5417 16.9521 13.7022 17.7915 12.6667 17.7915C11.6311 17.7915 10.7917 16.9521 10.7917 15.9165C10.7917 15.2846 11.1043 14.7257 11.5834 14.386V11.6749C11.5834 11.2082 11.4334 10.8471 11.1334 10.5915C10.8445 10.3249 10.4834 10.1915 10.05 10.1915C9.76114 10.1915 9.50003 10.2527 9.2667 10.3749C9.03336 10.486 8.85003 10.6527 8.7167 10.8749C8.58336 11.0971 8.5167 11.3638 8.5167 11.6749V14.398C8.9863 14.7387 9.29169 15.292 9.29169 15.9165C9.29169 16.9521 8.45222 17.7915 7.41669 17.7915C6.38115 17.7915 5.54169 16.9521 5.54169 15.9165C5.54169 15.2846 5.85432 14.7257 6.33336 14.386V10.8363Z" fill="white"/>
<path d="M7.04167 10.1249C7.61696 10.1249 8.08333 9.65855 8.08333 9.08325C8.08333 8.50796 7.61696 8.04158 7.04167 8.04158C6.46637 8.04158 6 8.50796 6 9.08325C6 9.65855 6.46637 10.1249 7.04167 10.1249Z" fill="white"/>
<path d="M7.45833 16.9582C8.03363 16.9582 8.5 16.4918 8.5 15.9165C8.5 15.3412 8.03363 14.8749 7.45833 14.8749C6.88304 14.8749 6.41667 15.3412 6.41667 15.9165C6.41667 16.4918 6.88304 16.9582 7.45833 16.9582Z" fill="white"/>
<path d="M17.9584 16.9582C18.5337 16.9582 19 16.4918 19 15.9165C19 15.3412 18.5337 14.8749 17.9584 14.8749C17.3831 14.8749 16.9167 15.3412 16.9167 15.9165C16.9167 16.4918 17.3831 16.9582 17.9584 16.9582Z" fill="white"/>
<path d="M13.75 15.9165C13.75 16.4918 13.2836 16.9582 12.7083 16.9582C12.133 16.9582 11.6667 16.4918 11.6667 15.9165C11.6667 15.3412 12.133 14.8749 12.7083 14.8749C13.2836 14.8749 13.75 15.3412 13.75 15.9165Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_11862_5683">
<path d="M0 12.5C0 8.30236 0 6.20354 0.768086 4.57956C1.55942 2.90642 2.90642 1.55942 4.57956 0.768086C6.20354 0 8.30236 0 12.5 0V0C16.6976 0 18.7965 0 20.4204 0.768086C22.0936 1.55942 23.4406 2.90642 24.2319 4.57956C25 6.20354 25 8.30236 25 12.5V12.5C25 16.6976 25 18.7965 24.2319 20.4204C23.4406 22.0936 22.0936 23.4406 20.4204 24.2319C18.7965 25 16.6976 25 12.5 25V25C8.30236 25 6.20354 25 4.57956 24.2319C2.90642 23.4406 1.55942 22.0936 0.768086 20.4204C0 18.7965 0 16.6976 0 12.5V12.5Z" fill="white"/>
</clipPath>
</defs>
</svg>`;

const LOGO_BLACK_SVG = `
<svg width="32" height="32" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1083_50505)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 25C19.4036 25 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 5.59644 25 12.5 25ZM6.33336 10.8363C5.62696 10.5675 5.12502 9.88399 5.12502 9.08325C5.12502 8.04772 5.96449 7.20825 7.00002 7.20825C7.937 7.20825 8.71346 7.89553 8.85276 8.79347C8.95713 8.71964 9.06732 8.65233 9.18336 8.59155C9.65003 8.33599 10.1778 8.20821 10.7667 8.20821C11.3223 8.20821 11.8278 8.33599 12.2834 8.59155C12.6651 8.7964 12.9806 9.07538 13.2297 9.42849C13.499 9.08483 13.828 8.8114 14.2167 8.60821C14.7056 8.34154 15.25 8.20821 15.85 8.20821C16.45 8.20821 16.9889 8.33599 17.4667 8.59155C17.9445 8.83599 18.3223 9.19154 18.6 9.65821C18.8778 10.1249 19.0167 10.6804 19.0167 11.3249V14.3979C19.4863 14.7387 19.7917 15.292 19.7917 15.9165C19.7917 16.9521 18.9523 17.7915 17.9167 17.7915C16.8812 17.7915 16.0417 16.9521 16.0417 15.9165C16.0417 15.2846 16.3543 14.7257 16.8334 14.386V11.6749C16.8334 11.2082 16.6834 10.8471 16.3834 10.5915C16.0945 10.3249 15.7334 10.1915 15.3 10.1915C15.0223 10.1915 14.7611 10.2527 14.5167 10.3749C14.2834 10.486 14.1 10.6527 13.9667 10.8749C13.8334 11.0971 13.7667 11.3638 13.7667 11.6749V14.398C14.2363 14.7387 14.5417 15.292 14.5417 15.9165C14.5417 16.9521 13.7022 17.7915 12.6667 17.7915C11.6311 17.7915 10.7917 16.9521 10.7917 15.9165C10.7917 15.2846 11.1043 14.7257 11.5834 14.386V11.6749C11.5834 11.2082 11.4334 10.8471 11.1334 10.5915C10.8445 10.3249 10.4834 10.1915 10.05 10.1915C9.76114 10.1915 9.50003 10.2527 9.2667 10.3749C9.03337 10.486 8.85003 10.6527 8.7167 10.8749C8.58336 11.0971 8.5167 11.3638 8.5167 11.6749V14.398C8.9863 14.7387 9.29169 15.292 9.29169 15.9165C9.29169 16.9521 8.45222 17.7915 7.41669 17.7915C6.38115 17.7915 5.54169 16.9521 5.54169 15.9165C5.54169 15.2846 5.85432 14.7257 6.33336 14.386V10.8363Z" fill="black"/>
<path d="M7.04167 10.1249C7.61696 10.1249 8.08333 9.65855 8.08333 9.08325C8.08333 8.50796 7.61696 8.04158 7.04167 8.04158C6.46637 8.04158 6 8.50796 6 9.08325C6 9.65855 6.46637 10.1249 7.04167 10.1249Z" fill="black"/>
<path d="M7.45833 16.9582C8.03363 16.9582 8.5 16.4918 8.5 15.9165C8.5 15.3412 8.03363 14.8749 7.45833 14.8749C6.88304 14.8749 6.41667 15.3412 6.41667 15.9165C6.41667 16.4918 6.88304 16.9582 7.45833 16.9582Z" fill="black"/>
<path d="M17.9584 16.9582C18.5337 16.9582 19 16.4918 19 15.9165C19 15.3412 18.5337 14.8749 17.9584 14.8749C17.3831 14.8749 16.9167 15.3412 16.9167 15.9165C16.9167 16.4918 17.3831 16.9582 17.9584 16.9582Z" fill="black"/>
<path d="M13.75 15.9165C13.75 16.4918 13.2836 16.9582 12.7083 16.9582C12.133 16.9582 11.6667 16.4918 11.6667 15.9165C11.6667 15.3412 12.133 14.8749 12.7083 14.8749C13.2836 14.8749 13.75 15.3412 13.75 15.9165Z" fill="black"/>
</g>
<defs>
<clipPath id="clip0_1083_50505">
<path d="M0 12.5C0 8.30236 0 6.20354 0.768086 4.57956C1.55942 2.90642 2.90642 1.55942 4.57956 0.768086C6.20354 0 8.30236 0 12.5 0C16.6976 0 18.7965 0 20.4204 0.768086C22.0936 1.55942 23.4406 2.90642 24.2319 4.57956C25 6.20354 25 8.30236 25 12.5C25 16.6976 25 18.7965 24.2319 20.4204C23.4406 22.0936 22.0936 23.4406 20.4204 24.2319C18.7965 25 16.6976 25 12.5 25C8.30236 25 6.20354 25 4.57956 24.2319C2.90642 23.4406 1.55942 22.0936 0.768086 20.4204C0 18.7965 0 16.6976 0 12.5Z" fill="white"/>
</clipPath>
</defs>
</svg>

`;

__MERGIFY_DEBUG__ = false;

function debug(...args) {
    if (!__MERGIFY_DEBUG__) return;
    console.log(...args);
}

// Matches timestamps generated by the Mergify engine in merge queue reports.
const MERGIFY_TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC$/;
const TIMESTAMP_CONVERTED_ATTR = "data-mergify-local-time";

const LOCAL_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
});

function formatLocalTime(date) {
    return LOCAL_TIME_FORMATTER.format(date);
}

// Whether a comment container belongs to the Mergify bot.
function isMergifyBotComment(container) {
    const authorLink = container.querySelector(
        'a.author[href="/apps/mergify"]',
    );
    if (authorLink) return true;

    const avatar = container.querySelector("img.avatar");
    if (avatar && /mergify/i.test(avatar.getAttribute("src") || "")) {
        return true;
    }

    return false;
}

// Replaces UTC timestamps in Mergify comments with local times.
function convertMergifyTimestamps() {
    const codeElements = document.querySelectorAll(
        `.comment-body code:not([${TIMESTAMP_CONVERTED_ATTR}])`,
    );

    for (const code of codeElements) {
        const match = code.textContent.match(MERGIFY_TIMESTAMP_REGEX);
        if (!match) continue;

        const container = code.closest(
            ".TimelineItem, .js-comment-container, .timeline-comment",
        );
        if (!container || !isMergifyBotComment(container)) continue;

        const date = new Date(`${match[1]}T${match[2]}:00Z`);
        if (Number.isNaN(date.getTime())) continue;

        const originalUtc = code.textContent;
        code.textContent = formatLocalTime(date);
        code.setAttribute(TIMESTAMP_CONVERTED_ATTR, "true");
        code.setAttribute("title", originalUtc);
        code.style.cursor = "help";
    }
}

function parseSvg(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    return doc.documentElement;
}

const BUTTONS = [
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

function postCommand(command) {
    const input = document.querySelector("#new_comment_field");
    input.removeAttribute("disabled");
    input.value = `@mergifyio ${command}`;
    const button = Array.from(
        document.querySelectorAll("#partial-new-comment-form-actions button"),
    ).find((el) => el.textContent.trim() === "Comment");
    button.removeAttribute("disabled");
    button.click();
}

function isPullRequestOpen() {
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

function wasMergedByMergify() {
    const timelineItems = document.querySelectorAll(".TimelineItem");
    for (const item of timelineItems) {
        if (!item.textContent.includes("merged commit")) continue;
        if (item.querySelector('a[href="/apps/mergify"]')) return true;
    }
    return false;
}

const MERGED_MESSAGES = [
    "Merged while you weren't looking \u2728",
    "Another one bites the queue \ud83c\udfb6",
    "Delivered. You're welcome \ud83d\ude0e",
    "Merged faster than you can say 'LGTM'",
    "One less PR on your plate \ud83c\udf7d\ufe0f",
    "Clean merge, zero drama \u2705",
    "Shipped it! Back to coffee \u2615",
    "This PR has left the queue \ud83d\ude80",
    "Merged. No humans were harmed \ud83e\udd16",
    "Queue in, merge out. Easy \ud83c\udfaf",
    "That's a wrap on this one \ud83c\udf2f",
    "Deployed to main, guilt-free \ud83c\udf1f",
];

function getMergedMessage() {
    // Use PR number as seed for consistent message per PR
    const data = getPullRequestData();
    const index = Number.parseInt(data.pull, 10) % MERGED_MESSAGES.length;
    return MERGED_MESSAGES[index];
}

// Descriptions that indicate the PR is actually in the merge queue
const QUEUED_DESCRIPTIONS = [
    "In merge queue",
    "Queued for merge",
    "Running merge queue checks",
    "Merge queue checks ended",
];

function isMergifyQueueCheckQueued(text) {
    return QUEUED_DESCRIPTIONS.some((desc) => text.includes(desc));
}

let lastKnownQueueState = false;
let queueStateInitialized = false;
let lastPullRequestUrl = null;

function resetQueueState() {
    lastKnownQueueState = false;
    queueStateInitialized = false;
    lastPullRequestUrl = null;
}

function isPullRequestQueued() {
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

async function fetchQueueState() {
    const urlAtFetch = window.location.pathname;
    const data = getPullRequestData();
    try {
        const response = await fetch(
            `/${data.org}/${data.repo}/pull/${data.pull}/checks`,
        );
        // Discard result if user navigated away during fetch
        if (window.location.pathname !== urlAtFetch) return;
        if (!response.ok) return;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find the Mergify Merge Queue check and its description
        const items = doc.querySelectorAll(
            ".merge-status-item, li, [class*='check']",
        );
        for (const item of items) {
            if (!item.textContent.includes("Mergify Merge Queue")) continue;
            lastKnownQueueState = isMergifyQueueCheckQueued(item.textContent);
            return;
        }
        lastKnownQueueState = false;
    } catch (error) {
        debug("Failed to fetch queue state:", error);
    }
}

function getPullRequestData() {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/");
    return {
        org: parts[1],
        repo: parts[2],
        pull: parts[4],
    };
}

function getLogoSvg() {
    const githubColorMode =
        document.documentElement.getAttribute("data-color-mode");
    if (githubColorMode === "auto") {
        const isDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
        if (isDark) {
            return LOGO_WHITE_SVG;
        }
        return LOGO_BLACK_SVG;
    }

    if (githubColorMode === "dark") {
        return LOGO_WHITE_SVG;
    }

    if (githubColorMode === "light") {
        return LOGO_BLACK_SVG;
    }
    // fallback to black
    return LOGO_BLACK_SVG;
}

function getEventLogLink() {
    const data = getPullRequestData();
    return `https://dashboard.mergify.com/event-logs?login=${data.org}&repository=${data.repo}&pullRequestNumber=${data.pull}`;
}

function getMergeQueueLink() {
    const data = getPullRequestData();
    return `https://dashboard.mergify.com/queues?login=${data.org}&repository=${data.repo}&branch=main&pull-request-number=${data.pull}`;
}

function buildMergeBoxButton(command, label, tooltip, disabled, variant) {
    const button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("title", tooltip);
    if (disabled) {
        button.setAttribute("disabled", "disabled");
    }
    button.onclick = () => postCommand(command);
    button.style.cssText =
        "border:none;border-radius:6px;padding:0 12px;font-size:14px;line-height:21px;height:32px;cursor:pointer;font-family:inherit;font-weight:600;";

    if (variant === "primary") {
        button.style.backgroundColor = "#238636";
        button.style.color = "white";
    } else if (variant === "danger") {
        button.style.backgroundColor = "#da3633";
        button.style.color = "white";
    } else {
        button.style.backgroundColor = "#21262d";
        button.style.color = "#e6edf3";
        button.style.border = "1px solid #30363d";
        button.style.fontWeight = "normal";
    }

    if (disabled) {
        button.style.opacity = "0.5";
        button.style.cursor = "not-allowed";
    }

    button.textContent = label;
    return button;
}

function buildQueueButton(pullIsOpen, pullIsQueued) {
    const btn = pullIsQueued
        ? buildMergeBoxButton(
              "dequeue",
              "Dequeue",
              "Remove the pull request from the merge queue",
              false,
              "danger",
          )
        : buildMergeBoxButton(
              "queue",
              "Queue",
              "Add the pull request to the merge queue",
              !pullIsOpen,
              "primary",
          );
    btn.setAttribute("data-mergify-queue-btn", "true");

    // Wrap onclick to optimistically flip state after posting the command
    const originalOnclick = btn.onclick;
    btn.onclick = () => {
        originalOnclick();
        lastKnownQueueState = !pullIsQueued;
        const row = document.querySelector("#mergify");
        if (row) updateMergifyQueueButton(row);
    };

    return btn;
}

function updateMergifyQueueButton(row) {
    const pullIsOpen = isPullRequestOpen();
    const pullIsQueued = isPullRequestQueued();
    const oldBtn = row.querySelector("[data-mergify-queue-btn]");
    if (!oldBtn) return;

    const isCurrentlyDequeue = oldBtn.textContent.trim() === "Dequeue";
    if (isCurrentlyDequeue === pullIsQueued) return;

    const newBtn = buildQueueButton(pullIsOpen, pullIsQueued);
    oldBtn.replaceWith(newBtn);
    debug("Mergify queue button updated:", pullIsQueued ? "Dequeue" : "Queue");
}

function buildMergifyRow() {
    const pullIsOpen = isPullRequestOpen();
    const pullIsQueued = isPullRequestQueued();

    const row = document.createElement("div");
    row.id = "mergify";
    row.style.cssText =
        "padding:10px 16px;border-top:1px solid var(--borderColor-default, #30363d);display:flex;align-items:center;gap:10px;";

    // Left side: logo + label + links
    const logo = document.createElement("div");
    logo.style.cssText = "flex-shrink:0;display:flex;";
    const svgEl = parseSvg(getLogoSvg());
    svgEl.setAttribute("width", "20");
    svgEl.setAttribute("height", "20");
    logo.appendChild(svgEl);
    row.appendChild(logo);

    const info = document.createElement("div");
    info.style.cssText =
        "flex:1;display:flex;align-items:center;gap:6px;font-size:13px;";

    const label = document.createElement("span");
    label.style.fontWeight = "600";
    label.textContent = "Mergify";
    info.appendChild(label);

    const dot1 = document.createElement("span");
    dot1.style.color = "var(--fgColor-muted, #7d8590)";
    dot1.textContent = "\u00b7";
    info.appendChild(dot1);

    const queueLink = document.createElement("a");
    queueLink.href = getMergeQueueLink();
    queueLink.target = "_blank";
    queueLink.rel = "noopener noreferrer";
    queueLink.textContent = "queue";
    queueLink.style.cssText =
        "color:var(--fgColor-accent, #58a6ff);text-decoration:none;font-size:12px;";
    info.appendChild(queueLink);

    const dot2 = document.createElement("span");
    dot2.style.color = "var(--fgColor-muted, #7d8590)";
    dot2.textContent = "\u00b7";
    info.appendChild(dot2);

    const logsLink = document.createElement("a");
    logsLink.href = getEventLogLink();
    logsLink.target = "_blank";
    logsLink.rel = "noopener noreferrer";
    logsLink.textContent = "logs";
    logsLink.style.cssText =
        "color:var(--fgColor-accent, #58a6ff);text-decoration:none;font-size:12px;";
    info.appendChild(logsLink);

    row.appendChild(info);

    if (pullIsOpen) {
        // Right side: buttons (only for open PRs)
        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:6px;";

        buttons.appendChild(buildQueueButton(pullIsOpen, pullIsQueued));

        for (const btn of BUTTONS) {
            buttons.appendChild(
                buildMergeBoxButton(
                    btn.command,
                    btn.label,
                    btn.tooltip,
                    btn.disableOnClosedPR && !pullIsOpen,
                    "secondary",
                ),
            );
        }

        row.appendChild(buttons);
    } else if (wasMergedByMergify()) {
        const status = document.createElement("span");
        status.style.cssText =
            "color:var(--fgColor-muted, #7d8590);font-size:13px;";
        status.textContent = getMergedMessage();
        row.appendChild(status);
    }

    return row;
}

function isGitHubPullRequestPage() {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/");
    return parts.length >= 5 && parts[3] === "pull";
}

function findTimelineActions() {
    const mergeBoxDiv = document.querySelector(
        "div[class=discussion-timeline-actions]",
    );
    if (mergeBoxDiv && mergeBoxDiv.tagName === "DIV") {
        return mergeBoxDiv;
    }
}

async function _tryInject() {
    if (!isGitHubPullRequestPage()) {
        debug("Not a pull request page");
        return;
    }

    // Reset queue state when navigating to a different PR
    const currentUrl = window.location.pathname;
    if (currentUrl !== lastPullRequestUrl) {
        lastPullRequestUrl = currentUrl;
        lastKnownQueueState = false;
        queueStateInitialized = false;
    }

    const existingRow = document.querySelector("#mergify");
    if (existingRow) {
        updateMergifyQueueButton(existingRow);
        return;
    }

    const hasMergifyConfiguration = await getMergifyConfigurationStatus();
    if (!isMergifyEnabledOnTheRepo(hasMergifyConfiguration)) {
        debug("Mergify is not enabled on the repo");
        return;
    }

    // Fetch queue state before first render
    if (!queueStateInitialized) {
        queueStateInitialized = true;
        await fetchQueueState();
        debug("Queue state fetched:", lastKnownQueueState);
    }

    // New merge box — the mergebox-partial may be inside discussion-timeline-actions
    // or a separate element in the page (GitHub layout varies)
    const mergeBoxPartial = document.querySelector(
        '[data-testid="mergebox-partial"]',
    );
    if (mergeBoxPartial) {
        const mergeBoxContainer =
            mergeBoxPartial.querySelector(".border.rounded-2");
        if (mergeBoxContainer) {
            mergeBoxContainer.appendChild(buildMergifyRow());
            debug("Mergify section injected inside merge box container");
            return;
        }
    }

    let detailSection = findTimelineActions();
    if (detailSection) {
        // Fallback: look for merge box inside discussion-timeline-actions
        const mergeBoxContainer = detailSection.querySelector(
            ".merge-pr .border.rounded-2",
        );
        if (mergeBoxContainer) {
            mergeBoxContainer.appendChild(buildMergifyRow());
            debug("Mergify section injected inside merge-pr container");
        } else {
            debug("Merge box container not found yet, waiting for render");
        }
        return;
    }
    // Classic merge box
    detailSection = document.querySelector(".mergeability-details");
    if (detailSection) {
        detailSection.insertBefore(buildMergifyRow(), detailSection.firstChild);
        debug("Mergify section injected in classic merge box");
        return;
    }
    debug("No merge box found");
}

let injecting = false;
let pendingInjection = false;

function tryInject() {
    debug(`Mergify extension injecting: ${injecting} / ${pendingInjection}`);
    if (injecting) {
        pendingInjection = true;
        return;
    }
    injecting = true;
    _tryInject().finally(() => {
        injecting = false;
        if (pendingInjection) {
            pendingInjection = false;
            tryInject();
        }
    });
}

function isMergifyEnabledOnTheRepo(hasMergifyConfiguration) {
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

async function getMergifyConfigurationStatus() {
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

class MergifyCache {
    /**
     * @param {number} expirationMs - Cache expiration time in milliseconds (defaults to 1 day)
     */
    constructor(expirationMs = 24 * 60 * 60 * 1000) {
        this.CACHE_KEY_PREFIX = "mergify_browser_extension";
        this.expirationMs = expirationMs;
    }

    key(owner, repo) {
        return `${this.CACHE_KEY_PREFIX}_${owner}_${repo}`;
    }

    update(owner, repo, isMergifyEnabled) {
        const key = this.key(owner, repo);
        const data = {
            isMergifyEnabled,
            timestamp: Date.now(),
        };

        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error("Failed to store Mergify status in cache:", error);
        }
    }

    get(owner, repo) {
        const key = this.key(owner, repo);

        try {
            const cachedData = localStorage.getItem(key);
            if (!cachedData) {
                return null;
            }

            const data = JSON.parse(cachedData);

            // Check if cache entry has expired
            if (Date.now() - data.timestamp > this.expirationMs) {
                localStorage.removeItem(key);
                return null;
            }

            return data.isMergifyEnabled;
        } catch (error) {
            console.error(
                "Failed to retrieve Mergify status from cache:",
                error,
            );
            return null;
        }
    }
}

// Coalesces rapid-fire calls (e.g. from MutationObserver) into a single update per frame.
let pageUpdateScheduled = false;
function onPageUpdate() {
    if (pageUpdateScheduled) return;
    pageUpdateScheduled = true;
    requestAnimationFrame(() => {
        pageUpdateScheduled = false;
        tryInject();
        convertMergifyTimestamps();
    });
}

(async () => {
    // For SPA application page is not reloaded so we need to listen to history changes
    // Patch history methods
    const _push = history.pushState;
    history.pushState = function (...args) {
        _push.apply(this, args);
        onPageUpdate();
    };
    const _replace = history.replaceState;
    history.replaceState = function (...args) {
        _replace.apply(this, args);
        onPageUpdate();
    };
    // Back/forward navigation
    window.addEventListener("popstate", onPageUpdate);

    // On Page load
    onPageUpdate();

    // On DOM change
    const observer = new MutationObserver(onPageUpdate);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
})();

// Required for testing only, module does not exists in an extension
try {
    module.exports = {
        MergifyCache,
        findTimelineActions,
        isPullRequestOpen,
        isPullRequestQueued,
        resetQueueState,
        wasMergedByMergify,
        getMergedMessage,
        MERGED_MESSAGES,
        isMergifyEnabledOnTheRepo,
        getPullRequestData,
        getMergifyConfigurationStatus,
        convertMergifyTimestamps,
        isMergifyBotComment,
        formatLocalTime,
    };
} catch (_error) {}
