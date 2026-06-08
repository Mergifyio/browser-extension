import { debug } from "./debug.js";
import { getPullRequestData, isGitHubPullRequestPage } from "./dom.js";
import { fetchQueueState, QUEUE_POLL_INTERVAL } from "./queue.js";

export const PAYLOAD_VERSION = 1;

const PAYLOAD_STATES = new Set([
    "waiting",
    "checking",
    "frozen",
    "bisecting",
    "merged",
    "dequeued",
]);

// Mirrors engine's MERGIFY_COMMENT_PAYLOAD_REGEX (see hidden_payload.py).
// The `m` flag lets `^` anchor at the start of any line, so the marker
// block matches even when wrapped inside `<!--- ... -->`.
const MARKER_REGEX =
    /^DO NOT EDIT\n-\*- Mergify Payload -\*-\n(.+)\n-\*- Mergify Payload End -\*-/m;

// Quick marker test that skips the JSON capture group for fast detection.
const MARKER_PRESENT_REGEX = /-\*- Mergify Payload -\*-/;

export function parsePayload(commentSource) {
    if (typeof commentSource !== "string") return null;
    const match = MARKER_REGEX.exec(commentSource);
    if (!match) return null;

    let raw;
    try {
        raw = JSON.parse(match[1]);
    } catch (err) {
        debug("mqPayload: invalid JSON", err);
        return null;
    }

    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.version !== "number") return null;
    if (raw.version > PAYLOAD_VERSION) {
        debug(
            "mqPayload: payload version",
            raw.version,
            "exceeds supported",
            PAYLOAD_VERSION,
        );
        return null;
    }
    if (!PAYLOAD_STATES.has(raw.state)) return null;
    if (!Array.isArray(raw.required_conditions)) return null;

    return raw;
}

// Pull the raw markdown source out of an inline edit-form <textarea>.
// GitHub renders these only when the user has opened/expanded the comment
// edit form (or sometimes preemptively on hover). When present, they hold
// the unrendered markdown — including HTML comments — verbatim.
function _readInlineTextareaSource(timelineItem) {
    const ta = timelineItem.querySelector(
        "textarea.CommentBox-input, textarea.js-comment-field",
    );
    if (!ta) return null;
    // Prefer the live `.value` (reflects user edits / engine updates)
    // and fall back to textContent for environments that don't set `.value`.
    const src = ta.value != null && ta.value !== "" ? ta.value : ta.textContent;
    return typeof src === "string" ? src : null;
}

// Find the issuecomment numeric ID for a TimelineItem if the item is hosted
// inside (or contains) an `id="issuecomment-<n>"` container.
function _readCommentIdFor(timelineItem) {
    const idHolder =
        timelineItem.closest('[id^="issuecomment-"]') ||
        timelineItem.querySelector('[id^="issuecomment-"]');
    if (!idHolder) return null;
    const m = /^issuecomment-(\d+)$/.exec(idHolder.id);
    return m ? m[1] : null;
}

// Walk the timeline and find every Mergify-authored TimelineItem along with
// any inline source / fetchable comment id we can pull a payload from.
// Returns an array in DOM order: [{ item, inlineSource, commentId }].
function _collectMergifyCandidates(root = document) {
    const items = root.querySelectorAll(".TimelineItem");
    const out = [];
    for (const item of items) {
        if (!item.querySelector('a[href="/apps/mergify"]')) continue;
        const inlineSource = _readInlineTextareaSource(item);
        const commentId = _readCommentIdFor(item);
        out.push({ item, inlineSource, commentId });
    }
    return out;
}

// Resolve the latest Mergify status comment's payload synchronously, using
// only inline DOM data (no network). Returns { payload, commentId } if the
// inline textarea route works, or { payload: null, commentId } if we found
// a fetchable candidate but no inline marker — `commentId` is then usable
// for the async fetch fallback. Returns null if no Mergify comment exists.
//
// Most Mergify-authored TimelineItems are events (labels, reviewers, queue
// breadcrumbs) without a payload marker; only status comments carry it.
// Walking the candidate list in reverse and returning the first one with a
// marker correctly picks the latest status comment instead of the
// latest-anything-Mergify-touched.
export function findLatestStatusCommentSync(root = document) {
    const candidates = _collectMergifyCandidates(root);
    if (candidates.length === 0) return null;

    for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        if (c.inlineSource && MARKER_PRESENT_REGEX.test(c.inlineSource)) {
            return {
                payload: parsePayload(c.inlineSource),
                commentId: c.commentId,
            };
        }
    }

    // No inline marker found. Fall back to the latest candidate that hosts an
    // issuecomment-* node so the async fetch can try its edit_form. Events
    // without a commentId aren't fetchable; skip them.
    for (let i = candidates.length - 1; i >= 0; i--) {
        if (candidates[i].commentId) {
            return { payload: null, commentId: candidates[i].commentId };
        }
    }

    return null;
}

async function _fetchCommentMarkdown(commentId) {
    const data = getPullRequestData();
    if (!data?.org || !data.repo) return null;
    try {
        const r = await fetch(
            `/${data.org}/${data.repo}/issue_comments/${commentId}/edit_form`,
        );
        if (!r.ok) return null;
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const ta = doc.querySelector("textarea");
        return ta ? ta.value || ta.textContent || "" : null;
    } catch (e) {
        debug("mqPayload: edit_form fetch failed", e);
        return null;
    }
}

// Resolve the latest Mergify status comment's payload, falling back to a
// network fetch of the comment's edit_form when the inline textarea isn't
// materialized. Returns { payload, commentId } or null when there's no
// Mergify status comment at all.
export async function resolveLatestStatusCommentPayload(root = document) {
    const sync = findLatestStatusCommentSync(root);
    if (!sync) return null;
    if (sync.payload) return sync;
    if (!sync.commentId) return { payload: null, commentId: null };
    const markdown = await _fetchCommentMarkdown(sync.commentId);
    if (!markdown) return { payload: null, commentId: sync.commentId };
    const payload = parsePayload(markdown);
    return { payload, commentId: sync.commentId };
}

let _onChange = null;
let _current = null;

// Payload-side state.
let _payloadGeneration = 0;
let _payloadPollTimer = null;
let _timelineObserver = null;
let _inPayloadMode = false;

// Fallback-side state (preserved from previous implementation).
let _fallbackTimer = null;
let _fallbackGeneration = 0;

function _equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function _emit(state) {
    if (!_onChange) return;
    if (_equal(state, _current)) return;
    _current = state;
    _onChange(state);
}

async function _runFallbackPoll() {
    const generation = _fallbackGeneration;
    const queued = await fetchQueueState();
    if (generation !== _fallbackGeneration) return;
    if (!_onChange) return;
    _emit({ source: "fallback", queued: !!queued });
}

function _scheduleFallbackPoll() {
    if (_fallbackTimer != null) return;
    const generation = _fallbackGeneration;
    _fallbackTimer = setTimeout(async () => {
        _fallbackTimer = null;
        if (generation !== _fallbackGeneration) return;
        if (!isGitHubPullRequestPage()) return;
        await _runFallbackPoll();
        if (generation !== _fallbackGeneration) return;
        if (isGitHubPullRequestPage() && _onChange) _scheduleFallbackPoll();
    }, QUEUE_POLL_INTERVAL);
}

function _startFallback() {
    void _runFallbackPoll();
    _scheduleFallbackPoll();
}

function _stopFallback() {
    _fallbackGeneration++;
    if (_fallbackTimer != null) {
        clearTimeout(_fallbackTimer);
        _fallbackTimer = null;
    }
}

// Re-resolve the latest Mergify status comment and emit if its payload has
// changed. This is the freshness mechanism for payload mode. It MUST be
// triggered by both a periodic timer AND the timeline observer, because:
//
//   - The timeline observer (MutationObserver on document.body) catches DOM
//     tree mutations: new comments appearing, comments being edited (which
//     re-renders the body), etc.
//   - The periodic timer is load-bearing because inline `.value` mutations
//     on a <textarea> do NOT fire MutationObserver. MO observes DOM tree
//     mutations, not property assignments. If the engine updates the
//     payload by silently rewriting the textarea's `.value` (no DOM
//     reflow), only the periodic re-read picks it up.
async function _resolveAndEmit() {
    const generation = _payloadGeneration;
    let result;
    try {
        result = await resolveLatestStatusCommentPayload();
    } catch (e) {
        debug("mqPayload: resolveLatestStatusCommentPayload threw", e);
        return;
    }
    if (generation !== _payloadGeneration) return;
    if (!_onChange) return;

    if (!result) {
        debug("mqPayload: resolve returned null (no Mergify comment found)");
        return;
    }
    debug(
        "mqPayload: resolve returned",
        result.payload
            ? `payload(state=${result.payload.state})`
            : "null payload",
        "commentId=",
        result.commentId,
    );
    if (result.payload) {
        if (!_inPayloadMode) {
            _stopFallback();
            _inPayloadMode = true;
        }
        _emit({ source: "payload", payload: result.payload });
    }
}

function _schedulePayloadPoll() {
    if (_payloadPollTimer != null) return;
    const generation = _payloadGeneration;
    _payloadPollTimer = setTimeout(async () => {
        _payloadPollTimer = null;
        if (generation !== _payloadGeneration) return;
        if (!isGitHubPullRequestPage()) return;
        await _resolveAndEmit();
        if (generation !== _payloadGeneration) return;
        if (isGitHubPullRequestPage() && _onChange) _schedulePayloadPoll();
    }, QUEUE_POLL_INTERVAL);
}

const TIMELINE_OBSERVER_DEBOUNCE_MS = 800;
let _timelineObserverDebounce = null;

function _installTimelineObserver() {
    if (_timelineObserver) return;
    _timelineObserver = new MutationObserver(() => {
        if (!_onChange) return;
        // Once we're in payload mode, the periodic poll (QUEUE_POLL_INTERVAL)
        // owns freshness — refetching edit_form on every page mutation would
        // hammer GitHub. The engine edits the same status comment in place;
        // there's no second one to catch.
        if (_inPayloadMode) return;
        // Coalesce bursts of mutations (GitHub re-renders heavily on PR
        // pages) into a single resolve attempt at the tail.
        if (_timelineObserverDebounce != null) {
            clearTimeout(_timelineObserverDebounce);
        }
        _timelineObserverDebounce = setTimeout(() => {
            _timelineObserverDebounce = null;
            void _resolveAndEmit();
        }, TIMELINE_OBSERVER_DEBOUNCE_MS);
    });
    _timelineObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

export function attach(callback) {
    detach();
    _onChange = callback;

    const sync = findLatestStatusCommentSync();
    debug(
        "mqPayload: attach() sync resolve =",
        sync == null
            ? "null"
            : sync.payload
              ? `payload(state=${sync.payload.state})`
              : `null payload, commentId=${sync.commentId}`,
    );
    if (sync?.payload) {
        _inPayloadMode = true;
        _emit({ source: "payload", payload: sync.payload });
        _installTimelineObserver();
        _schedulePayloadPoll();
        return;
    }

    // No sync payload. Two sub-cases:
    //  - We found a Mergify status comment but its source isn't inline
    //    (no marker in textarea, or no textarea at all) → kick the async
    //    resolver and run legacy fallback in the meantime.
    //  - No Mergify comment in the timeline at all → pure fallback mode +
    //    timeline observer so we upgrade as soon as one appears.
    _startFallback();
    _installTimelineObserver();
    _schedulePayloadPoll();

    if (sync?.commentId) {
        void _resolveAndEmit();
    }
}

// Force an immediate freshness pass, bypassing the periodic poll's timer.
// Wired to tab focus / visibility-regain in the orchestrator: browsers
// throttle setTimeout in background tabs, so a poll scheduled for
// QUEUE_POLL_INTERVAL can be far staler than that by the time the user returns.
// Re-resolving on focus makes the queue button reflect changes made outside the
// page (a CLI dequeue, a teammate's @mergifyio command, the engine merging the
// PR) the moment they look back at it.
//
// Routes to whichever mode is active, mirroring the periodic poll, and emits
// through the same callback — so a row only re-renders when something actually
// changed:
//   - payload mode  → re-read the latest status-comment payload
//   - fallback mode → re-fetch the check-run queue state
export async function refreshNow() {
    if (!_onChange) return;
    if (!isGitHubPullRequestPage()) return;
    if (_inPayloadMode) {
        await _resolveAndEmit();
    } else {
        await _runFallbackPoll();
    }
}

export function detach() {
    _payloadGeneration++;
    if (_timelineObserver) {
        _timelineObserver.disconnect();
        _timelineObserver = null;
    }
    if (_timelineObserverDebounce != null) {
        clearTimeout(_timelineObserverDebounce);
        _timelineObserverDebounce = null;
    }
    if (_payloadPollTimer != null) {
        clearTimeout(_payloadPollTimer);
        _payloadPollTimer = null;
    }
    _stopFallback();
    _inPayloadMode = false;
    _current = null;
    _onChange = null;
}

export function getCurrent() {
    return _current;
}
