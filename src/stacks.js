import { PrStatusCache } from "./cache.js";
import { debug } from "./debug.js";
import { findFirstElement, readPrStatusFromDocument } from "./dom.js";
import { getLogoSvg, parseSvg } from "./logo.js";

export const STACK_MARKER_PREFIX = "<!-- mergify-stack-data: ";
export const REVISION_MARKER_PREFIX = "<!-- mergify-revision-data: ";
export const MARKER_SUFFIX = " -->";

export const STACK_TITLE_ROW_RE =
    /^\| \d+ \| (.+?) \| \[#(\d+)\]\([^)]+\) \|/gm;

export const DOT_COLORS = {
    initial: "var(--fgColor-muted, #7d8590)",
    amend: "var(--fgColor-accent, #58a6ff)",
    rebase: "var(--fgColor-done, #a371f7)",
};

export const COMMENT_FETCH_CONCURRENCY = 4;
export const COMMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
export const COMMENTS_NEGATIVE_CACHE_TTL_MS = 60 * 1000;

export const CONTEXT_PANEL_TARGETS = [
    '[data-testid="issue-pr-conversation-content"]',
    "#discussion_bucket",
    ".js-discussion",
];

// Module-level state
export const _commentBodyCache = new Map();
export const _inflightStatusFetches = new Map();
export const _prStatusCache = new PrStatusCache();
export let _contextRenderGeneration = 0;

export function extractMarkerJson(body, prefix) {
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

export function extractStackTitles(body) {
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
export function extractRevisionRowReasons(body) {
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

export function parseStackMarker(commentBodies, pullNumber) {
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

export function parseRevisionMarker(commentBodies, pullNumber) {
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

function findMergifyCommentIdsIn(scope) {
    const ids = new Set();
    const containers = scope.querySelectorAll(
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

export function findMergifyCommentIds() {
    return findMergifyCommentIdsIn(document);
}

// On the Files tab, GitHub doesn't render the conversation timeline at all,
// so the local DOM scan returns nothing. Fall back to fetching the
// Conversation page's HTML and searching there. Result is cached per-PR
// with a short TTL so subsequent ticks don't re-fetch the ~500KB page.
const _remoteCommentIdsCache = new Map();

export async function findMergifyCommentIdsRemote(org, repo, prNumber) {
    const key = `${org}/${repo}/${prNumber}`;
    const cached = _remoteCommentIdsCache.get(key);
    if (cached && Date.now() - cached.timestamp < COMMENTS_CACHE_TTL_MS) {
        return cached.ids;
    }
    try {
        const r = await fetch(`/${org}/${repo}/pull/${prNumber}`);
        if (!r.ok) return [];
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const ids = findMergifyCommentIdsIn(doc);
        if (ids.length > 0) {
            _remoteCommentIdsCache.set(key, { ids, timestamp: Date.now() });
        }
        return ids;
    } catch (e) {
        debug("findMergifyCommentIdsRemote failed", e);
        return [];
    }
}

export async function fetchCommentBodyMarkdown(org, repo, commentId) {
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

export async function fetchCommentBodies(org, repo, prNumber) {
    let ids = findMergifyCommentIds();
    if (ids.length === 0) {
        // The Files tab doesn't render conversation comments — fall back to
        // the Conversation page HTML to discover Mergify-related comment IDs.
        ids = await findMergifyCommentIdsRemote(org, repo, prNumber);
    }
    if (ids.length === 0) return [];
    const bodies = [];
    const queue = ids.slice();
    const workerCount = Math.min(COMMENT_FETCH_CONCURRENCY, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
            const id = queue.shift();
            const cached = _commentBodyCache.get(id);
            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (cached.body && age < COMMENTS_CACHE_TTL_MS) {
                    bodies.push(cached.body);
                    continue;
                }
                // Negative cache: a recent failure is remembered for a short
                // back-off window so we don't refetch on every tryInject tick.
                if (!cached.body && age < COMMENTS_NEGATIVE_CACHE_TTL_MS) {
                    continue;
                }
            }
            const body = await fetchCommentBodyMarkdown(org, repo, id);
            _commentBodyCache.set(id, {
                body: body || null,
                timestamp: Date.now(),
            });
            if (body) bodies.push(body);
        }
    });
    await Promise.all(workers);
    return bodies;
}

export function clearCommentsCache() {
    _commentBodyCache.clear();
    _remoteCommentIdsCache.clear();
}

export async function fetchPrStatus(org, repo, num) {
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

function _statusKey(item) {
    return `${item.org}/${item.repo}/${item.num}/${item.head_sha}`;
}

export async function gatherPrStatuses(
    items,
    cache,
    onResolve,
    concurrency = 4,
) {
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
            // Dedupe concurrent fetches for the same PR — multiple tryInject
            // ticks during React reconciliation can otherwise spawn the same
            // request many times before the first response lands.
            const key = _statusKey(item);
            let promise = _inflightStatusFetches.get(key);
            if (!promise) {
                promise = fetchPrStatus(item.org, item.repo, item.num);
                _inflightStatusFetches.set(key, promise);
                promise.finally(() => _inflightStatusFetches.delete(key));
            }
            const status = await promise;
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

export function readCurrentPrStatus() {
    return readPrStatusFromDocument(document);
}

export function buildContextPanel(stackData, revisionData, currentPull) {
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

export function buildStackColumn(stackData, revisionData, currentPull) {
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

export function buildRevisionColumn(revisionData, currentPull) {
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

export function updateStackDotStatus(panelEl, prNumber, status) {
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

export function findContextPanelTarget() {
    return findFirstElement(CONTEXT_PANEL_TARGETS);
}

export function injectContextPanel(panel) {
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

export function removeContextSurfaces(currentPull) {
    document.querySelector("#mergify-context")?.remove();
    injectStackNav(null, currentPull);
}

export async function renderMergifyContext(currentPull) {
    const generation = ++_contextRenderGeneration;
    const bodies = await fetchCommentBodies(
        currentPull.org,
        currentPull.repo,
        currentPull.number,
    );
    if (generation !== _contextRenderGeneration) return;
    if (bodies.length === 0) {
        removeContextSurfaces(currentPull);
        return;
    }

    const stackData = parseStackMarker(bodies, currentPull.number);
    const revisionData = parseRevisionMarker(bodies, currentPull.number);
    const panel = buildContextPanel(stackData, revisionData, currentPull);
    if (!panel) {
        removeContextSurfaces(currentPull);
        return;
    }
    injectContextPanel(panel);
    injectStackNav(stackData, currentPull);

    if (!stackData) return;
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
        const live = document.querySelector("#mergify-context");
        if (live) {
            updateStackDotStatus(live, currentPull.number, currentStatus);
        }
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
        const panel = document.querySelector("#mergify-context");
        if (panel) updateStackDotStatus(panel, item.num, status);
        const nav = document.querySelector("#mergify-stack-nav");
        if (nav) updateStackDotStatus(nav, item.num, status);
    }).catch((e) => debug("status fetch failed:", e));
}

export const STACK_NAV_HIDDEN_KEY = "mergify_browser_extension_stack_nav_hidden";

function isStackNavHidden() {
    try {
        return localStorage.getItem(STACK_NAV_HIDDEN_KEY) === "1";
    } catch (_e) {
        return false;
    }
}

function setStackNavHidden() {
    try {
        localStorage.setItem(STACK_NAV_HIDDEN_KEY, "1");
    } catch (_e) {}
}

function djb2Hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return String(h);
}

export function buildStackNav(stackData, currentPull) {
    if (!stackData?.pulls || stackData.pulls.length < 2) {
        return null;
    }
    const idx = stackData.pulls.findIndex(
        (p) => p.number === currentPull.number,
    );
    if (idx === -1) return null;
    const prev = idx > 0 ? stackData.pulls[idx - 1] : null;
    const next =
        idx < stackData.pulls.length - 1 ? stackData.pulls[idx + 1] : null;

    // Standalone floating pill anchored to the viewport — fully decoupled
    // from GitHub's layout so toolbar/header redesigns don't break us. Lives
    // directly under <body>.
    const root = document.createElement("div");
    root.id = "mergify-stack-nav";
    // Hash of the displayed content. Used by injectStackNav to skip
    // identical re-renders. This matters during hover storms: GitHub's
    // hover-card popover mutates the DOM, our MutationObserver re-fires
    // tryInject → renderMergifyContext → injectStackNav. Without the
    // dedup, we'd `replaceWith` on every hover and detach the anchor mid-
    // click, eating the click event.
    root.setAttribute(
        "data-mergify-hash",
        djb2Hash(
            JSON.stringify({
                cur: currentPull.number,
                sub: currentPull.subpath || "",
                org: currentPull.org,
                repo: currentPull.repo,
                len: stackData.pulls.length,
                idx,
                prev: prev ? `${prev.number}/${prev.title}` : null,
                next: next ? `${next.number}/${next.title}` : null,
            }),
        ),
    );
    root.style.cssText =
        "position:fixed;bottom:16px;right:16px;z-index:50;" +
        "display:inline-flex;align-items:center;gap:10px;" +
        "padding:6px 8px 6px 12px;font-size:12px;" +
        "background:var(--bgColor-default, #0d1117);" +
        "color:var(--fgColor-default, #f0f6fc);" +
        "border:1px solid var(--borderColor-default, #30363d);" +
        "border-radius:999px;box-sizing:border-box;" +
        "box-shadow:0 8px 24px rgba(0,0,0,0.25);" +
        "font-variant-numeric:tabular-nums;max-width:560px;";

    const stackLabel = document.createElement("span");
    stackLabel.style.cssText =
        "color:var(--fgColor-muted, #7d8590);font-weight:600;font-size:11px;flex-shrink:0;";
    stackLabel.textContent = `${idx + 1}/${stackData.pulls.length}`;

    function buildArrow(direction) {
        return direction === "prev" ? "←" : "→";
    }

    function renderEmpty(direction) {
        const muted = document.createElement("span");
        muted.style.cssText =
            "color:var(--fgColor-muted, #7d8590);opacity:0.4;" +
            "min-width:24px;text-align:center;flex-shrink:0;";
        muted.textContent = buildArrow(direction);
        muted.setAttribute("data-mergify-stack-nav", `${direction}-empty`);
        return muted;
    }

    function buildLink(pull, direction) {
        const a = document.createElement("a");
        a.setAttribute("data-mergify-stack-nav", direction);
        a.setAttribute("data-mergify-stack-nav-num", String(pull.number));
        // Opt out of GitHub's Turbo Drive — without this, Turbo intercepts
        // the click, calls preventDefault, then fails to actually navigate
        // because our anchor isn't in any Turbo frame. The data-turbo
        // attribute makes Turbo ignore the link so the browser's default
        // navigation runs.
        a.setAttribute("data-turbo", "false");
        const tail = currentPull.subpath ? `/${currentPull.subpath}` : "";
        a.href = `/${currentPull.org}/${currentPull.repo}/pull/${pull.number}${tail}`;
        a.title = `Open #${pull.number}: ${pull.title}`;
        a.style.cssText =
            "display:inline-flex;align-items:center;gap:6px;min-width:0;" +
            "color:var(--fgColor-accent, #58a6ff);text-decoration:none;";
        a.onmouseenter = () => {
            a.style.textDecoration = "underline";
        };
        a.onmouseleave = () => {
            a.style.textDecoration = "none";
        };
        return a;
    }

    function buildDot(prNumber) {
        const dot = document.createElement("span");
        dot.setAttribute("data-mergify-status-dot", "");
        dot.setAttribute("data-mergify-pr-num", String(prNumber));
        dot.setAttribute("data-mergify-status", "unknown");
        dot.style.cssText =
            "width:8px;height:8px;border-radius:50%;flex-shrink:0;" +
            "background:var(--fgColor-muted, #7d8590);";
        return dot;
    }

    function renderPrev(pull) {
        if (!pull) return renderEmpty("prev");
        const a = buildLink(pull, "prev");
        const arrow = document.createElement("span");
        arrow.textContent = buildArrow("prev");
        arrow.style.cssText = "flex-shrink:0;";
        const num = document.createElement("span");
        num.textContent = `#${pull.number}`;
        num.style.cssText = "flex-shrink:0;";
        a.append(arrow, num);
        return a;
    }

    function renderNext(pull) {
        if (!pull) return renderEmpty("next");
        const a = buildLink(pull, "next");
        const dot = buildDot(pull.number);
        const num = document.createElement("span");
        num.textContent = `#${pull.number}`;
        num.style.cssText = "flex-shrink:0;";
        const title = document.createElement("span");
        title.textContent = pull.title;
        title.style.cssText =
            "color:var(--fgColor-default, #f0f6fc);" +
            "max-width:280px;overflow:hidden;text-overflow:ellipsis;" +
            "white-space:nowrap;min-width:0;";
        const arrow = document.createElement("span");
        arrow.textContent = buildArrow("next");
        arrow.style.cssText = "flex-shrink:0;";
        a.append(dot, num, title, arrow);
        return a;
    }

    const close = document.createElement("button");
    close.setAttribute("type", "button");
    close.setAttribute("data-mergify-stack-nav-close", "");
    close.setAttribute(
        "title",
        "Hide. Clear localStorage 'mergify_browser_extension_stack_nav_hidden' to restore.",
    );
    close.textContent = "×";
    close.style.cssText =
        "background:transparent;border:none;cursor:pointer;flex-shrink:0;" +
        "padding:0 4px;color:var(--fgColor-muted, #7d8590);" +
        "font-size:16px;line-height:1;border-radius:50%;";
    close.onmouseenter = () => {
        close.style.color = "var(--fgColor-default, #f0f6fc)";
    };
    close.onmouseleave = () => {
        close.style.color = "var(--fgColor-muted, #7d8590)";
    };

    root.append(renderPrev(prev), stackLabel, renderNext(next), close);
    return root;
}

// Document-level capture-phase click delegation, installed exactly once.
// We can't bind handlers directly on the pill's elements because Turbo
// morphs the DOM during navigation/scroll updates and matches our pill by
// id — preserving the markup but stripping inline event-handler properties
// (.onclick is a JS property, not part of the morphed HTML). Delegating at
// document level survives any DOM swap. Capture phase ensures we run before
// Turbo's own bubble-phase clickBubbled handler can preventDefault without
// actually navigating.
let _stackNavDelegated = false;
function ensureStackNavClickDelegate() {
    if (_stackNavDelegated) return;
    _stackNavDelegated = true;
    document.addEventListener(
        "click",
        (e) => {
            if (
                e.button !== 0 ||
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey
            ) {
                return;
            }
            const close = e.target?.closest?.(
                "#mergify-stack-nav [data-mergify-stack-nav-close]",
            );
            if (close) {
                e.preventDefault();
                e.stopPropagation();
                setStackNavHidden();
                document.querySelector("#mergify-stack-nav")?.remove();
                return;
            }
            const link = e.target?.closest?.(
                "#mergify-stack-nav a[data-mergify-stack-nav]",
            );
            if (link?.href) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = link.href;
            }
        },
        true,
    );
}

export function injectStackNav(stackData, currentPull) {
    ensureStackNavClickDelegate();
    const existing = document.querySelector("#mergify-stack-nav");
    if (isStackNavHidden()) {
        if (existing) existing.remove();
        return;
    }
    const fresh = buildStackNav(stackData, currentPull);
    if (!fresh) {
        if (existing) existing.remove();
        return;
    }
    if (existing) {
        const oldHash = existing.getAttribute("data-mergify-hash");
        const newHash = fresh.getAttribute("data-mergify-hash");
        if (oldHash && newHash && oldHash === newHash) return;
        existing.replaceWith(fresh);
    } else {
        document.body.appendChild(fresh);
    }
}

export function resetStackState() {
    _contextRenderGeneration += 1;
    _commentBodyCache.clear();
    const panel = document.querySelector("#mergify-context");
    if (panel) panel.remove();
    document.querySelector("#mergify-stack-nav")?.remove();
}
