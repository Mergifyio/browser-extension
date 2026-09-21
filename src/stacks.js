import { StackContextCache } from "./cache.js";
import { debug } from "./debug.js";
import { findFirstElement } from "./dom.js";
import { getLogoSvg, parseSvg } from "./logo.js";

export const REVISION_MARKER_PREFIX = "<!-- mergify-revision-data: ";
export const MARKER_SUFFIX = " -->";

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
export const _stackContextCache = new StackContextCache();
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

// The visible heading mergify-cli gives the revision-history comment. It is
// the only comment we read: the sticky stack comment is GitHub's job now
// (its native Stacks UI lists the pull requests), so matching it here would
// only buy an edit_form fetch of a body carrying no marker we parse.
const MERGIFY_COMMENT_TEXT_RE = /Revision history/i;

const COMMENT_CONTAINERS =
    ".TimelineItem, .js-comment-container, .timeline-comment";

// Whether GitHub rendered the conversation timeline into this scope at all.
// A scope that has it is authoritative about which comments the pull request
// carries, so a miss there needs no second opinion from the network.
function hasConversationTimeline(scope) {
    return scope.querySelector(COMMENT_CONTAINERS) !== null;
}

function findMergifyCommentIdsIn(scope) {
    const ids = new Set();
    const containers = scope.querySelectorAll(COMMENT_CONTAINERS);
    for (const c of containers) {
        const body = c.querySelector(".comment-body");
        if (!body) continue;
        const text = body.textContent || "";
        if (!MERGIFY_COMMENT_TEXT_RE.test(text)) continue;
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
    if (cached) {
        const age = Date.now() - cached.timestamp;
        const ttl =
            cached.ids.length > 0
                ? COMMENTS_CACHE_TTL_MS
                : COMMENTS_NEGATIVE_CACHE_TTL_MS;
        if (age < ttl) return cached.ids;
    }
    try {
        const r = await fetch(`/${org}/${repo}/pull/${prNumber}`);
        if (!r.ok) return [];
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const ids = findMergifyCommentIdsIn(doc);
        // Cache hits and misses both. Empty result uses a shorter TTL so we
        // discover comments soon after they appear without re-downloading the
        // ~500KB Conversation HTML on every tryInject tick.
        _remoteCommentIdsCache.set(key, { ids, timestamp: Date.now() });
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
    if (ids.length === 0 && !hasConversationTimeline(document)) {
        // The Files tab doesn't render conversation comments — fall back to
        // the Conversation page HTML to discover Mergify-related comment IDs.
        // Only when the timeline is absent: where it IS rendered, a miss is
        // the answer, and the fallback costs a ~500KB download that the
        // negative cache only holds for COMMENTS_NEGATIVE_CACHE_TTL_MS. Every
        // pull request carrying no Mergify comment sits on this path, so
        // without the guard a tab left open re-downloads that page a minute
        // for as long as it stays open. The trade is a Mergify comment folded
        // behind GitHub's "load more" on a long timeline, which the fallback
        // would not have surfaced either — the server HTML elides it too.
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

export function buildContextPanel(revisionData, currentPull) {
    if (!revisionData) return null;

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
    root.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex-direction:column;";
    body.appendChild(buildRevisionColumn(revisionData, currentPull));
    root.appendChild(body);

    const hashInput = JSON.stringify({
        r: {
            n: revisionData.pull_number,
            es: revisionData.entries.map(
                (e) => `${e.number}/${e.change_type}/${e.new_sha}`,
            ),
        },
    });
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
        hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
    }
    root.setAttribute("data-mergify-hash", String(hash));

    return root;
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

export function removeContextPanel() {
    document.querySelector("#mergify-context")?.remove();
}

export async function renderMergifyContext(currentPull) {
    const generation = ++_contextRenderGeneration;

    // Cache-first render: build the panel from the last known good revision
    // data so it appears before the network roundtrips settle. The network
    // refresh below replaces it in place (injectContextPanel dedupes via
    // data-mergify-hash, so identical data is a no-op).
    const cached = _stackContextCache.get(
        currentPull.org,
        currentPull.repo,
        currentPull.number,
    );
    if (cached) {
        try {
            const cachedPanel = buildContextPanel(
                cached.revisionData,
                currentPull,
            );
            if (cachedPanel) injectContextPanel(cachedPanel);
        } catch (e) {
            debug("Cache-first render failed; discarding entry:", e);
            _stackContextCache.remove(
                currentPull.org,
                currentPull.repo,
                currentPull.number,
            );
        }
    }

    const bodies = await fetchCommentBodies(
        currentPull.org,
        currentPull.repo,
        currentPull.number,
    );
    if (generation !== _contextRenderGeneration) return;
    if (bodies.length === 0) {
        _stackContextCache.remove(
            currentPull.org,
            currentPull.repo,
            currentPull.number,
        );
        removeContextPanel();
        return;
    }

    const revisionData = parseRevisionMarker(bodies, currentPull.number);
    const panel = buildContextPanel(revisionData, currentPull);
    if (!panel) {
        _stackContextCache.remove(
            currentPull.org,
            currentPull.repo,
            currentPull.number,
        );
        removeContextPanel();
        return;
    }

    _stackContextCache.update(
        currentPull.org,
        currentPull.repo,
        currentPull.number,
        revisionData,
    );

    injectContextPanel(panel);
}

export function resetStackState() {
    _contextRenderGeneration += 1;
    _commentBodyCache.clear();
    _remoteCommentIdsCache.clear();
    removeContextPanel();
}
