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

const STACK_MARKER_PREFIX = "<!-- mergify-stack-data: ";
const REVISION_MARKER_PREFIX = "<!-- mergify-revision-data: ";
const MARKER_SUFFIX = " -->";

function extractMarkerJson(body, prefix) {
    const results = [];
    let idx = 0;
    while (true) {
        const start = body.indexOf(prefix, idx);
        if (start === -1) break;
        const jsonStart = start + prefix.length;
        const end = body.indexOf(MARKER_SUFFIX, jsonStart);
        if (end === -1) break;
        results.push(body.slice(jsonStart, end));
        idx = end + MARKER_SUFFIX.length;
    }
    return results;
}

const STACK_TITLE_ROW_RE = /^\| \d+ \| (.+?) \| \[#(\d+)\]\([^)]+\) \|/gm;

function extractStackTitles(body) {
    const titles = {};
    for (const match of body.matchAll(STACK_TITLE_ROW_RE)) {
        const title = match[1].replace(/\\\|/g, "|").trim();
        titles[Number.parseInt(match[2], 10)] = title;
    }
    return titles;
}

// Extract the per-row reason ("note") from the rendered revision-history
// markdown table. The JSON marker doesn't include reasons, but mergify-cli
// emits them in the 5-column markdown form: | # | Type | Changes | Reason | Date |
// Returns { [number]: reason } only for entries whose reason cell is non-empty.
function extractRevisionRowReasons(body) {
    const out = {};
    for (const line of body.split("\n")) {
        if (!line.startsWith("| ")) continue;
        if (/^\|\s*-+/.test(line)) continue;
        const cells = line
            .split(/\s*\|\s*/)
            .slice(1, -1)
            .map((s) => s.trim());
        if (cells.length !== 5) continue;
        const num = Number.parseInt(cells[0], 10);
        if (Number.isNaN(num)) continue;
        if (cells[3]) out[num] = cells[3];
    }
    return out;
}

function parseStackMarker(commentBodies, pullNumber) {
    let latest = null;
    for (const body of commentBodies) {
        for (const raw of extractMarkerJson(body, STACK_MARKER_PREFIX)) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.schema_version !== 1) continue;
                // Each PR in a stack has its own stack comment; the only
                // difference is which entry has is_current=true. If the marker
                // doesn't mark *this* PR as current, we fetched the wrong
                // comment (e.g. SPA navigation grabbed a stale DOM ID). Reject
                // it and let the next tick try again with a settled DOM.
                const matchesCurrent = parsed.pulls?.some(
                    (p) => p.is_current && p.number === pullNumber,
                );
                if (!matchesCurrent) continue;
                const titles = extractStackTitles(body);
                latest = {
                    ...parsed,
                    pulls: parsed.pulls.map((p) => ({
                        ...p,
                        title: titles[p.number] || `PR #${p.number}`,
                    })),
                };
            } catch (_e) {
                debug("parseStackMarker: failed to parse marker JSON", _e);
            }
        }
    }
    return latest;
}

function parseRevisionMarker(commentBodies, pullNumber) {
    let latest = null;
    for (const body of commentBodies) {
        for (const raw of extractMarkerJson(body, REVISION_MARKER_PREFIX)) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.schema_version !== 1) continue;
                if (parsed.pull_number !== pullNumber) continue;
                const reasons = extractRevisionRowReasons(body);
                latest = {
                    ...parsed,
                    entries: parsed.entries.map((e) => ({
                        ...e,
                        reason: reasons[e.number] || null,
                    })),
                };
            } catch (_e) {
                debug("parseRevisionMarker: failed to parse marker JSON", _e);
            }
        }
    }
    return latest;
}

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

// GitHub's markdown renderer strips HTML comments from rendered .comment-body
// nodes, so the JSON markers (which live inside `<!-- ... -->`) never reach
// the DOM. We can't read them from .comment-body. The unauthenticated
// api.github.com REST API works for public repos but 404s on private ones,
// so we use the github.com web's per-comment edit_form endpoint instead:
// it's authenticated by the user's session cookie, returns the raw markdown
// inside a <textarea>, and works on any repo the user can read. To keep
// fetch volume down, we only hit comments whose visible text suggests they
// were posted by mergify-cli (Mergify stack / Revision history).
// Cache by comment ID (not by PR) so SPA navigations between PRs in the same
// stack don't poison a per-PR entry with stale DOM contents seen mid-React-
// reconciliation. The DOM scan for IDs runs every call (cheap); only the
// fetch is cached.
const COMMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMENT_FETCH_CONCURRENCY = 4;
const _commentBodyCache = new Map();

function clearCommentsCache() {
    _commentBodyCache.clear();
}

function findMergifyCommentIds() {
    const ids = new Set();
    const containers = document.querySelectorAll(
        ".TimelineItem, .js-comment-container, .timeline-comment",
    );
    for (const c of containers) {
        const body = c.querySelector(".comment-body");
        if (!body) continue;
        const text = body.textContent || "";
        if (!/Mergify stack|Revision history/i.test(text)) continue;
        const idEl = c.querySelector('[id^="issuecomment-"]');
        const m = idEl?.id?.match(/issuecomment-(\d+)/);
        if (m) ids.add(m[1]);
    }
    return [...ids];
}

async function fetchCommentBodyMarkdown(org, repo, commentId) {
    try {
        const r = await fetch(
            `/${org}/${repo}/issue_comments/${commentId}/edit_form`,
        );
        if (!r.ok) return null;
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const ta = doc.querySelector("textarea");
        return ta ? ta.value || ta.textContent || "" : null;
    } catch (e) {
        debug("fetchCommentBodyMarkdown failed", e);
        return null;
    }
}

async function fetchCommentBodies(org, repo, _prNumber) {
    const ids = findMergifyCommentIds();
    if (ids.length === 0) return [];
    const bodies = [];
    const queue = ids.slice();
    const workerCount = Math.min(COMMENT_FETCH_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            const id = queue.shift();
            const cached = _commentBodyCache.get(id);
            if (
                cached &&
                Date.now() - cached.timestamp < COMMENTS_CACHE_TTL_MS
            ) {
                bodies.push(cached.body);
                continue;
            }
            const body = await fetchCommentBodyMarkdown(org, repo, id);
            if (body) {
                _commentBodyCache.set(id, { body, timestamp: Date.now() });
                bodies.push(body);
            }
        }
    });
    await Promise.all(workers);
    return bodies;
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
let _contextRenderGeneration = 0;

function resetQueueState() {
    lastKnownQueueState = false;
    queueStateInitialized = false;
    lastPullRequestUrl = null;
    _contextRenderGeneration += 1;
    clearCommentsCache();
    const panel = document.querySelector("#mergify-context");
    if (panel) panel.remove();
    const nav = document.querySelector("#mergify-stack-nav");
    if (nav) nav.remove();
    if (queuePollTimer) {
        clearTimeout(queuePollTimer);
        queuePollTimer = null;
    }
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

function getPullRequestData() {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/");
    return {
        org: parts[1],
        repo: parts[2],
        pull: parts[4],
        subpath: parts[5] || "",
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

let queuePollTimer = null;
const QUEUE_POLL_INTERVAL = 15000;

function scheduleQueueStatePoll() {
    if (queuePollTimer) return;
    queuePollTimer = setTimeout(async () => {
        queuePollTimer = null;
        if (!isGitHubPullRequestPage()) return;
        const previousState = lastKnownQueueState;
        await fetchQueueState();
        if (previousState !== lastKnownQueueState) {
            const row = document.querySelector("#mergify");
            if (row) updateMergifyRow(row);
        }
        if (isGitHubPullRequestPage()) scheduleQueueStatePoll();
    }, QUEUE_POLL_INTERVAL);
}

function findLastMergifyCommand() {
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

function deriveQueueButtonState() {
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

function postCommandAndUpdate(command) {
    postCommand(command);
    const row = document.querySelector("#mergify");
    if (row) updateMergifyRow(row);
}

function buildQueueButton(state) {
    let btn;
    switch (state) {
        case "queuing":
        case "dequeuing":
            btn = buildMergeBoxButton(
                state === "queuing" ? "queue" : "dequeue",
                state === "queuing" ? "Queuing\u2026" : "Dequeuing\u2026",
                "Waiting for Mergify to process\u2026",
                true,
                "secondary",
            );
            break;
        case "queued":
            btn = buildMergeBoxButton(
                "dequeue",
                "Dequeue",
                "Remove the pull request from the merge queue",
                false,
                "danger",
            );
            btn.onclick = () => postCommandAndUpdate("dequeue");
            break;
        default:
            btn = buildMergeBoxButton(
                "queue",
                "Queue",
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

function updateMergifyRow(row) {
    const state = deriveQueueButtonState();
    const oldBtn = row.querySelector("[data-mergify-queue-btn]");

    if (state === "merged" || state === "closed") {
        if (oldBtn) {
            // PR was open, now merged/closed — rebuild entire row
            const newRow = buildMergifyRow();
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

function buildMergifyRow() {
    const state = deriveQueueButtonState();

    const row = document.createElement("div");
    row.id = "mergify";
    row.style.cssText =
        "padding:10px 16px;border-top:1px solid var(--borderColor-default, #30363d);display:flex;align-items:center;gap:10px;";

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

    function appendDot() {
        const dot = document.createElement("span");
        dot.style.color = "var(--fgColor-muted, #7d8590)";
        dot.textContent = "\u00b7";
        info.appendChild(dot);
    }

    function appendLink(href, text) {
        appendDot();
        const link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        link.style.cssText =
            "color:var(--fgColor-accent, #58a6ff);text-decoration:none;font-size:12px;";
        info.appendChild(link);
    }

    appendLink(getMergeQueueLink(), "queue");
    appendLink(getEventLogLink(), "logs");

    row.appendChild(info);

    if (state === "merged") {
        const status = document.createElement("span");
        status.style.cssText =
            "color:var(--fgColor-muted, #7d8590);font-size:13px;";
        status.textContent = getMergedMessage();
        row.appendChild(status);
    } else if (state !== "closed") {
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
    return mergeBoxDiv;
}

async function _tryInject() {
    if (!isGitHubPullRequestPage()) {
        debug("Not a pull request page");
        return;
    }

    const currentUrl = window.location.pathname;
    if (currentUrl !== lastPullRequestUrl) {
        resetQueueState();
        lastPullRequestUrl = currentUrl;
    }

    const hasMergifyConfiguration = await getMergifyConfigurationStatus();
    if (!isMergifyEnabledOnTheRepo(hasMergifyConfiguration)) {
        debug("Mergify is not enabled on the repo");
        return;
    }

    const _data = getPullRequestData();
    await renderMergifyContext({
        org: _data.org,
        repo: _data.repo,
        number: Number.parseInt(_data.pull, 10),
        subpath: _data.subpath,
    });

    const existingRow = document.querySelector("#mergify");
    if (existingRow) {
        updateMergifyRow(existingRow);
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
            scheduleQueueStatePoll();
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
            scheduleQueueStatePoll();
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
        scheduleQueueStatePoll();
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

class PrStatusCache {
    constructor(expirationMs = 60 * 60 * 1000) {
        this.PREFIX = "mergify_browser_extension_pr_status";
        this.expirationMs = expirationMs;
    }

    key(org, repo, num, headSha) {
        return `${this.PREFIX}_${org}_${repo}_${num}_${headSha}`;
    }

    get(org, repo, num, headSha) {
        const k = this.key(org, repo, num, headSha);
        try {
            const raw = localStorage.getItem(k);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.timestamp > this.expirationMs) {
                localStorage.removeItem(k);
                return null;
            }
            return data.status;
        } catch (e) {
            console.error("PrStatusCache get failed:", e);
            return null;
        }
    }

    update(org, repo, num, headSha, status) {
        const k = this.key(org, repo, num, headSha);
        try {
            localStorage.setItem(
                k,
                JSON.stringify({ status, timestamp: Date.now() }),
            );
        } catch (e) {
            console.error("PrStatusCache update failed:", e);
        }
    }

    clearAll() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith(this.PREFIX)) keys.push(k);
            }
            for (const k of keys) localStorage.removeItem(k);
        } catch (e) {
            console.error("PrStatusCache clearAll failed:", e);
        }
    }
}

// Clear cached PR statuses on a page reload (covers force-reload too —
// browsers don't expose hard-vs-soft reload to JS, so we treat any reload
// the same way). Normal SPA navigations stay cached.
try {
    const navType = performance.getEntriesByType?.("navigation")?.[0]?.type;
    if (navType === "reload") {
        new PrStatusCache().clearAll();
    }
} catch (_e) {
    // Best effort.
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

const PR_STATUS_SELECTORS = [
    { selector: 'span[data-status="draft"]', status: "draft" },
    { selector: 'span[data-status="pullOpened"]', status: "open" },
    { selector: 'span[data-status="pullMerged"]', status: "merged" },
    { selector: 'span[data-status="pullClosed"]', status: "closed" },
];

function readPrStatusFromDocument(scope) {
    for (const { selector, status } of PR_STATUS_SELECTORS) {
        if (scope.querySelector(selector)) return status;
    }
    return null;
}

async function fetchPrStatus(org, repo, num) {
    try {
        const r = await fetch(`/${org}/${repo}/pull/${num}`);
        if (!r.ok) return "unknown";
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return readPrStatusFromDocument(doc) || "unknown";
    } catch (_e) {
        return "unknown";
    }
}

async function gatherPrStatuses(items, cache, onResolve, concurrency = 4) {
    const queue = items.slice();
    const workerCount = Math.min(concurrency, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            const cached = cache.get(
                item.org,
                item.repo,
                item.num,
                item.head_sha,
            );
            if (cached !== null) {
                onResolve(item, cached);
                continue;
            }
            const status = await fetchPrStatus(item.org, item.repo, item.num);
            // Don't cache "unknown" — it usually means a transient fetch
            // failure, and we want the next tick to retry rather than serve
            // gray for the full TTL.
            if (status !== "unknown") {
                cache.update(
                    item.org,
                    item.repo,
                    item.num,
                    item.head_sha,
                    status,
                );
            }
            onResolve(item, status);
        }
    });
    await Promise.all(workers);
}

function buildStackColumn(stackData, revisionData, currentPull) {
    const col = document.createElement("div");
    col.setAttribute("data-mergify-section", "stack");
    col.style.cssText = revisionData
        ? "padding:10px 14px;border-bottom:1px solid var(--borderColor-default, #30363d);"
        : "padding:10px 14px;";

    const sectionLabel = document.createElement("div");
    sectionLabel.style.cssText =
        "color:var(--fgColor-muted, #7d8590);font-weight:600;" +
        "text-transform:uppercase;font-size:10px;letter-spacing:0.5px;" +
        "margin-bottom:6px;";
    const currentIdx = stackData.pulls.findIndex(
        (p) => p.number === currentPull.number,
    );
    sectionLabel.textContent =
        currentIdx >= 0
            ? `STACK · ${stackData.pulls.length} PRs · you are #${currentIdx + 1}`
            : `STACK · ${stackData.pulls.length} PRs`;
    col.appendChild(sectionLabel);

    const rows = document.createElement("div");
    rows.style.cssText = "display:flex;flex-direction:column;gap:1px;";

    for (const pull of stackData.pulls) {
        const a = document.createElement("a");
        a.setAttribute("data-mergify-pr-row", String(pull.number));
        if (pull.is_current) {
            a.setAttribute("data-mergify-current", "true");
        }
        a.href = `/${currentPull.org}/${currentPull.repo}/pull/${pull.number}`;
        a.style.cssText =
            "display:grid;grid-template-columns:14px auto 1fr auto;" +
            "gap:8px;align-items:center;padding:3px 8px 3px 16px;" +
            "border-radius:3px;" +
            "color:inherit;text-decoration:none;font-size:12px;" +
            (pull.is_current
                ? "background:rgba(31,111,235,0.12);" +
                  "box-shadow:inset 2px 0 0 var(--fgColor-accent, #1f6feb);"
                : "");

        const dot = document.createElement("span");
        dot.setAttribute("data-mergify-status-dot", "");
        dot.setAttribute("data-mergify-status", "unknown");
        dot.setAttribute("data-mergify-pr-num", String(pull.number));
        dot.setAttribute("data-mergify-head-sha", pull.head_sha);
        dot.style.cssText =
            "display:inline-block;width:8px;height:8px;border-radius:50%;" +
            "background:var(--fgColor-muted, #7d8590);";
        a.appendChild(dot);

        const num = document.createElement("span");
        num.style.cssText =
            "color:var(--fgColor-muted, #7d8590);font-variant-numeric:tabular-nums;";
        num.textContent = `#${pull.number}`;
        a.appendChild(num);

        const title = document.createElement("span");
        title.textContent = pull.title;
        title.style.cssText =
            "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        if (pull.is_current) title.style.fontWeight = "600";
        a.appendChild(title);

        const statusLabel = document.createElement("span");
        statusLabel.setAttribute("data-mergify-status-label", "");
        statusLabel.style.cssText =
            "color:var(--fgColor-muted, #7d8590);font-size:10px;" +
            "text-transform:uppercase;letter-spacing:0.4px;";
        a.appendChild(statusLabel);

        rows.appendChild(a);
    }

    col.appendChild(rows);
    return col;
}

function buildRevisionColumn(revisionData, currentPull) {
    const col = document.createElement("div");
    col.setAttribute("data-mergify-section", "revisions");
    col.style.cssText = "padding:10px 14px;";

    if (!revisionData.entries || revisionData.entries.length === 0) {
        const empty = document.createElement("div");
        empty.setAttribute("data-mergify-revisions-empty", "");
        empty.style.cssText =
            "color:var(--fgColor-muted, #7d8590);font-style:italic;font-size:11px;";
        empty.textContent = "No revisions yet";
        col.appendChild(empty);
        return col;
    }

    // Squash runs of consecutive `rebase` entries into one display entry.
    // Adjacent rebases without an amend in between are mostly noise;
    // collapsing them gives a cleaner timeline. The squashed dot's compare
    // URL spans the run (oldest old_sha → newest new_sha) so clicking
    // shows the full delta of the rebase storm.
    const displayEntries = [];
    for (const entry of revisionData.entries) {
        const last = displayEntries[displayEntries.length - 1];
        if (
            entry.change_type === "rebase" &&
            last &&
            last.change_type === "rebase"
        ) {
            last.new_sha = entry.new_sha;
            last.timestamp_iso = entry.timestamp_iso;
            last.last_number = entry.number;
            last.run_count = (last.run_count || 1) + 1;
            if (entry.old_sha && last.old_sha) {
                last.compare_url = `/${currentPull.org}/${currentPull.repo}/compare/${last.old_sha}...${entry.new_sha}`;
            }
            continue;
        }
        displayEntries.push({ ...entry, run_count: 1 });
    }

    const sectionLabel = document.createElement("div");
    sectionLabel.style.cssText =
        "color:var(--fgColor-muted, #7d8590);font-weight:600;" +
        "text-transform:uppercase;font-size:10px;letter-spacing:0.5px;" +
        "margin-bottom:8px;";
    sectionLabel.textContent =
        displayEntries.length === revisionData.entries.length
            ? `REVISIONS · ${revisionData.entries.length} entries`
            : `REVISIONS · ${revisionData.entries.length} entries · ${displayEntries.length} shown`;
    col.appendChild(sectionLabel);

    const timeline = document.createElement("div");
    timeline.style.cssText =
        "display:flex;align-items:flex-start;gap:0;font-size:10px;";

    const total = displayEntries.length;
    const lastIdx = total - 1;
    const collapsed = total > 6;
    const visibleIndexes = collapsed
        ? new Set([0, lastIdx - 2, lastIdx - 1, lastIdx])
        : new Set(displayEntries.map((_, i) => i));

    const DOT_COLORS = {
        initial: "var(--fgColor-muted, #7d8590)",
        amend: "var(--fgColor-accent, #58a6ff)",
        rebase: "var(--fgColor-done, #a371f7)",
    };

    function appendRevDot(entry, isLatest) {
        const a = document.createElement("a");
        a.setAttribute("data-mergify-rev-dot", "");
        a.setAttribute("data-mergify-rev-num", String(entry.number));
        a.setAttribute("data-mergify-change-type", entry.change_type);
        if (entry.run_count > 1) {
            a.setAttribute("data-mergify-rebase-run", String(entry.run_count));
        }
        if (isLatest) a.setAttribute("data-mergify-latest", "true");
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        const typeText =
            entry.run_count > 1
                ? `${entry.change_type} ×${entry.run_count}`
                : entry.change_type;
        a.setAttribute(
            "aria-label",
            `Revision ${entry.number} (${typeText}) — open diff`,
        );
        a.href =
            entry.change_type === "initial" || !entry.compare_url
                ? `/${currentPull.org}/${currentPull.repo}/commit/${entry.new_sha}`
                : entry.compare_url;
        a.style.cssText =
            "display:flex;flex-direction:column;align-items:center;" +
            "gap:4px;width:60px;text-decoration:none;color:inherit;";

        const color =
            DOT_COLORS[entry.change_type] || "var(--fgColor-accent, #58a6ff)";
        const dotEl = document.createElement("span");
        dotEl.style.cssText = isLatest
            ? `width:12px;height:12px;border-radius:50%;background:${color};` +
              "box-shadow:0 0 0 2px var(--bgColor-muted, #161b22),0 0 0 3px " +
              "var(--fgColor-success, #7ee787);"
            : `width:10px;height:10px;border-radius:50%;background:${color};`;
        a.appendChild(dotEl);

        const typeLabel = document.createElement("span");
        typeLabel.style.fontWeight = "600";
        typeLabel.textContent =
            entry.run_count > 1
                ? `${entry.change_type} ×${entry.run_count}`
                : entry.change_type;
        a.appendChild(typeLabel);

        const dateLabel = document.createElement("span");
        dateLabel.style.color = "var(--fgColor-muted, #7d8590)";
        const date = entry.timestamp_iso ? new Date(entry.timestamp_iso) : null;
        dateLabel.title = entry.timestamp_iso || "";
        dateLabel.textContent =
            date && !Number.isNaN(date.getTime())
                ? date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                  })
                : "";
        a.appendChild(dateLabel);

        const shaLabel = document.createElement("span");
        shaLabel.style.cssText =
            "color:var(--fgColor-accent, #58a6ff);font-family:monospace;";
        shaLabel.textContent = entry.new_sha.slice(0, 7);
        a.appendChild(shaLabel);

        if (entry.reason) {
            a.title = entry.reason;
            const reasonLabel = document.createElement("span");
            reasonLabel.setAttribute("data-mergify-rev-reason", "");
            reasonLabel.style.cssText =
                "color:var(--fgColor-muted, #7d8590);max-width:60px;" +
                "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
                "font-style:italic;";
            reasonLabel.textContent = entry.reason;
            a.appendChild(reasonLabel);
        }

        timeline.appendChild(a);
    }

    function appendConnector() {
        const line = document.createElement("span");
        line.style.cssText =
            "height:2px;flex:1;background:var(--borderColor-default, #30363d);" +
            "margin-top:4px;";
        timeline.appendChild(line);
    }

    function appendEllipsis(hiddenCount) {
        const span = document.createElement("span");
        span.setAttribute("data-mergify-rev-ellipsis", "");
        span.style.cssText =
            "color:var(--fgColor-muted, #7d8590);cursor:pointer;" +
            "padding:0 8px;align-self:center;font-weight:600;";
        span.textContent = `· · · (${hiddenCount} more) · · ·`;
        span.onclick = () => {
            timeline.innerHTML = "";
            renderEntries(false);
        };
        timeline.appendChild(span);
    }

    function renderEntries(useCollapsed) {
        let prevWasVisible = false;
        let lastShownIdx = -1;
        for (let i = 0; i < total; i++) {
            const visible = useCollapsed ? visibleIndexes.has(i) : true;
            if (visible) {
                if (prevWasVisible) {
                    if (lastShownIdx === i - 1) {
                        appendConnector();
                    } else {
                        appendEllipsis(i - lastShownIdx - 1);
                    }
                }
                appendRevDot(displayEntries[i], i === lastIdx);
                prevWasVisible = true;
                lastShownIdx = i;
            }
        }
    }

    renderEntries(collapsed);
    col.appendChild(timeline);
    return col;
}

function buildContextPanel(stackData, revisionData, currentPull) {
    if (!stackData && !revisionData) return null;

    const root = document.createElement("div");
    root.id = "mergify-context";
    root.style.cssText =
        "border:1px solid var(--borderColor-default, #30363d);" +
        "border-radius:6px;background:var(--bgColor-muted, #161b22);" +
        "margin:12px 0;font-size:13px;";

    const header = document.createElement("div");
    header.style.cssText =
        "padding:10px 14px;display:flex;align-items:center;gap:8px;" +
        "border-bottom:1px solid var(--borderColor-default, #30363d);";
    const logo = parseSvg(getLogoSvg());
    logo.setAttribute("width", "18");
    logo.setAttribute("height", "18");
    header.appendChild(logo);
    const titleLink = document.createElement("a");
    titleLink.href = "https://docs.mergify.com/stacks/";
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.textContent = "Mergify Stacks";
    titleLink.style.cssText =
        "font-weight:600;color:inherit;text-decoration:none;";
    titleLink.title = "Open Mergify Stacks documentation";
    header.appendChild(titleLink);
    if (stackData) {
        const sep = document.createElement("span");
        sep.style.color = "var(--fgColor-muted, #7d8590)";
        sep.textContent = "·";
        header.appendChild(sep);
        const stackChip = document.createElement("code");
        stackChip.style.cssText =
            "background:var(--bgColor-default, #0d1117);padding:1px 6px;" +
            "border-radius:3px;font-size:12px;";
        stackChip.textContent = stackData.stack_id;
        header.appendChild(stackChip);
    }
    root.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;";
    if (stackData)
        body.appendChild(
            buildStackColumn(stackData, revisionData, currentPull),
        );
    if (revisionData)
        body.appendChild(buildRevisionColumn(revisionData, currentPull));
    root.appendChild(body);

    const hashInput = JSON.stringify({
        s: stackData
            ? {
                  id: stackData.stack_id,
                  nums: stackData.pulls.map((p) => `${p.number}@${p.head_sha}`),
              }
            : null,
        r: revisionData
            ? {
                  n: revisionData.pull_number,
                  es: revisionData.entries.map(
                      (e) => `${e.number}/${e.change_type}/${e.new_sha}`,
                  ),
              }
            : null,
    });
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
        hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
    }
    root.setAttribute("data-mergify-hash", String(hash));

    return root;
}

function updateStackDotStatus(panelEl, prNumber, status) {
    const dot = panelEl.querySelector(
        `[data-mergify-status-dot][data-mergify-pr-num="${prNumber}"]`,
    );
    if (!dot) return;
    dot.setAttribute("data-mergify-status", status);
    const colors = {
        open: "var(--fgColor-success, #3fb950)",
        merged: "var(--fgColor-done, #a371f7)",
        closed: "var(--fgColor-danger, #f85149)",
        draft: "var(--fgColor-muted, #7d8590)",
        unknown: "var(--fgColor-muted, #7d8590)",
    };
    dot.style.background = colors[status] || colors.unknown;
    const row = dot.closest("[data-mergify-pr-row]");
    if (row) {
        const lbl = row.querySelector("[data-mergify-status-label]");
        if (lbl) lbl.textContent = status === "unknown" ? "" : status;
    }
}

function findFirstElement(selectors) {
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

const CONTEXT_PANEL_TARGETS = [
    '[data-testid="issue-pr-conversation-content"]',
    "#discussion_bucket",
    ".js-discussion",
];

function findContextPanelTarget() {
    return findFirstElement(CONTEXT_PANEL_TARGETS);
}

function injectContextPanel(panel) {
    const target = findContextPanelTarget();
    if (!target) return;

    const existing = target.querySelector("#mergify-context");
    if (existing) {
        const oldHash = existing.getAttribute("data-mergify-hash");
        const newHash = panel.getAttribute("data-mergify-hash");
        if (oldHash && newHash && oldHash === newHash) return;
        existing.replaceWith(panel);
        return;
    }
    target.insertBefore(panel, target.firstChild);
}

const _prStatusCache = new PrStatusCache();

async function renderMergifyContext(currentPull) {
    const generation = ++_contextRenderGeneration;
    const bodies = await fetchCommentBodies(
        currentPull.org,
        currentPull.repo,
        currentPull.number,
    );
    if (generation !== _contextRenderGeneration) return;
    if (bodies.length === 0) return;

    const stackData = parseStackMarker(bodies, currentPull.number);
    const revisionData = parseRevisionMarker(bodies, currentPull.number);
    const panel = buildContextPanel(stackData, revisionData, currentPull);
    if (!panel) return;
    injectContextPanel(panel);
    injectStackNav(stackData, currentPull);

    if (!stackData) return;
    const live = document.querySelector("#mergify-context");
    if (!live) return;

    const items = stackData.pulls
        .filter((p) => !p.is_current)
        .map((p) => ({
            org: currentPull.org,
            repo: currentPull.repo,
            num: p.number,
            head_sha: p.head_sha,
        }));

    // Apply the current PR's own live status from the page, and write it
    // through to the cache so a stale entry from a previous visit doesn't
    // outlive a status change the user has now seen with their own eyes.
    const currentStatus = readCurrentPrStatus();
    if (currentStatus) {
        updateStackDotStatus(live, currentPull.number, currentStatus);
        const currentEntry = stackData.pulls.find(
            (p) => p.number === currentPull.number,
        );
        if (currentEntry) {
            _prStatusCache.update(
                currentPull.org,
                currentPull.repo,
                currentPull.number,
                currentEntry.head_sha,
                currentStatus,
            );
        }
    }

    if (items.length === 0) return;

    gatherPrStatuses(items, _prStatusCache, (item, status) => {
        if (generation !== _contextRenderGeneration) return;
        const fresh = document.querySelector("#mergify-context");
        if (!fresh) return;
        updateStackDotStatus(fresh, item.num, status);
    }).catch((e) => debug("status fetch failed:", e));
}

// The `use-sticky-header-module` class is shared across both the Conversation
// tab's StickyPullRequestHeader and the Files tab's PullRequestFilesToolbar
// (the actual toolbar, not the 1px stickyHeaderActivationThreshold sentinel).
function findStackNavTarget() {
    return document.querySelector(
        '[class*="use-sticky-header-module__stickyHeader"]',
    );
}

function buildStackNav(stackData, currentPull) {
    if (!stackData || !stackData.pulls || stackData.pulls.length < 2) {
        return null;
    }
    const idx = stackData.pulls.findIndex(
        (p) => p.number === currentPull.number,
    );
    if (idx === -1) return null;
    const prev = idx > 0 ? stackData.pulls[idx - 1] : null;
    const next =
        idx < stackData.pulls.length - 1 ? stackData.pulls[idx + 1] : null;

    const root = document.createElement("div");
    root.id = "mergify-stack-nav";
    // flex:1 0 100% + min-width:100% + order:99 force the nav onto its own
    // row inside the sticky toolbar's flex container (which we set to
    // flex-wrap:wrap during injection). Symmetric vertical padding (no border)
    // keeps the row content visually centered.
    root.style.cssText =
        "display:grid;grid-template-columns:1fr auto 1fr;gap:12px;" +
        "align-items:center;padding:6px 16px;font-size:11px;" +
        "background:var(--bgColor-muted, #161b22);" +
        "box-shadow:inset 0 1px 0 var(--borderColor-default, #30363d);" +
        "flex:1 0 100%;min-width:100%;order:99;box-sizing:border-box;";

    const stackLabel = document.createElement("span");
    stackLabel.style.cssText =
        "color:var(--fgColor-muted, #7d8590);" +
        "text-transform:uppercase;letter-spacing:0.5px;" +
        "font-size:10px;font-weight:600;text-align:center;" +
        "font-variant-numeric:tabular-nums;";
    stackLabel.textContent = `STACK ${idx + 1}/${stackData.pulls.length}`;

    function renderHalf(pull, direction) {
        const arrow = direction === "prev" ? "←" : "→";
        const align = direction === "prev" ? "left" : "right";
        if (!pull) {
            const muted = document.createElement("span");
            muted.style.cssText =
                `text-align:${align};color:var(--fgColor-muted, #7d8590);` +
                "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
                "font-style:italic;";
            muted.textContent =
                direction === "prev" ? "base of stack" : "tip of stack";
            muted.setAttribute("data-mergify-stack-nav", `${direction}-empty`);
            return muted;
        }
        const a = document.createElement("a");
        a.setAttribute("data-mergify-stack-nav", direction);
        a.setAttribute("data-mergify-stack-nav-num", String(pull.number));
        const tail = currentPull.subpath ? `/${currentPull.subpath}` : "";
        a.href = `/${currentPull.org}/${currentPull.repo}/pull/${pull.number}${tail}`;
        a.title = `Open #${pull.number}: ${pull.title}`;
        a.style.cssText =
            "display:flex;align-items:center;gap:6px;" +
            "color:var(--fgColor-accent, #58a6ff);" +
            "text-decoration:none;white-space:nowrap;overflow:hidden;" +
            (direction === "prev"
                ? "justify-content:flex-start;"
                : "justify-content:flex-end;");
        a.onmouseenter = () => {
            a.style.textDecoration = "underline";
        };
        a.onmouseleave = () => {
            a.style.textDecoration = "none";
        };
        const arrowEl = document.createElement("span");
        arrowEl.style.cssText =
            "color:var(--fgColor-muted, #7d8590);flex-shrink:0;font-size:13px;";
        arrowEl.textContent = arrow;
        const num = document.createElement("span");
        num.style.cssText =
            "color:var(--fgColor-muted, #7d8590);flex-shrink:0;" +
            "font-variant-numeric:tabular-nums;";
        num.textContent = `#${pull.number}`;
        const title = document.createElement("span");
        title.textContent = pull.title;
        title.style.cssText =
            "overflow:hidden;text-overflow:ellipsis;min-width:0;";
        if (direction === "prev") {
            a.appendChild(arrowEl);
            a.appendChild(num);
            a.appendChild(title);
        } else {
            a.appendChild(title);
            a.appendChild(num);
            a.appendChild(arrowEl);
        }
        return a;
    }

    root.appendChild(renderHalf(prev, "prev"));
    root.appendChild(stackLabel);
    root.appendChild(renderHalf(next, "next"));
    return root;
}

function injectStackNav(stackData, currentPull) {
    const target = findStackNavTarget();
    if (!target) return;
    const existing = document.querySelector("#mergify-stack-nav");
    const fresh = buildStackNav(stackData, currentPull);
    if (!fresh) {
        if (existing) {
            existing.remove();
            target.style.flexWrap = "";
            target.style.removeProperty("padding-bottom");
        }
        return;
    }
    // The toolbar is a flex-row. Force flex-wrap so our 100%-width child
    // spills onto a new line below the existing toolbar contents, and stays
    // inside the same sticky element so it inherits stickiness naturally.
    // Zero the toolbar's padding-bottom (with !important — GitHub ships an
    // !important rule for it) so there's no visible gap between our nav and
    // the bottom edge of the sticky bar.
    target.style.flexWrap = "wrap";
    target.style.setProperty("padding-bottom", "0", "important");
    if (existing) {
        existing.replaceWith(fresh);
        return;
    }
    target.appendChild(fresh);
}

function readCurrentPrStatus() {
    return readPrStatusFromDocument(document);
}

// Required for testing only, module does not exists in an extension
try {
    module.exports = {
        MergifyCache,
        PrStatusCache,
        findTimelineActions,
        isPullRequestOpen,
        isPullRequestQueued,
        resetQueueState,
        findLastMergifyCommand,
        deriveQueueButtonState,
        wasMergedByMergify,
        getMergedMessage,
        MERGED_MESSAGES,
        isMergifyEnabledOnTheRepo,
        getPullRequestData,
        getMergifyConfigurationStatus,
        convertMergifyTimestamps,
        isMergifyBotComment,
        formatLocalTime,
        parseStackMarker,
        parseRevisionMarker,
        STACK_MARKER_PREFIX,
        REVISION_MARKER_PREFIX,
        MARKER_SUFFIX,
        fetchPrStatus,
        gatherPrStatuses,
        buildContextPanel,
        updateStackDotStatus,
        injectContextPanel,
        renderMergifyContext,
        fetchCommentBodies,
        clearCommentsCache,
        buildStackNav,
        injectStackNav,
    };
} catch (_error) {}
