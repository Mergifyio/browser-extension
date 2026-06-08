const {
    parsePayload,
    PAYLOAD_VERSION,
    findLatestStatusCommentSync,
    resolveLatestStatusCommentPayload,
} = require("../mqPayload");

const validJson = JSON.stringify({
    version: 1,
    state: "checking",
    queue_rule_name: "default",
    queued_at: "2026-05-29T10:14:02Z",
    estimated_time_of_merge: "2026-05-29T10:42:18Z",
    speculative_check_pr: 12345,
    required_conditions: [
        { description: "base=main", match: true, subconditions: [] },
        {
            description: "any of",
            match: false,
            subconditions: [
                {
                    description: "check-success=ci/test",
                    match: false,
                    subconditions: [],
                },
            ],
        },
    ],
});

const wrap = (json) =>
    `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n${json}\n-*- Mergify Payload End -*-\n-->`;

describe("parsePayload", () => {
    test("returns the parsed payload when marker block is well-formed", () => {
        const out = parsePayload(wrap(validJson));
        expect(out).not.toBeNull();
        expect(out.state).toBe("checking");
        expect(out.speculative_check_pr).toBe(12345);
        expect(out.required_conditions[1].subconditions[0].description).toBe(
            "check-success=ci/test",
        );
    });

    test("returns null when marker block is missing", () => {
        expect(parsePayload("just a regular comment body")).toBeNull();
    });

    test("returns null when marker block is truncated", () => {
        const truncated = `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n${validJson}\n-->`;
        expect(parsePayload(truncated)).toBeNull();
    });

    test("returns null on malformed JSON", () => {
        expect(parsePayload(wrap("{not valid json"))).toBeNull();
    });

    test("returns null when version is higher than supported", () => {
        const future = JSON.stringify({
            ...JSON.parse(validJson),
            version: PAYLOAD_VERSION + 1,
        });
        expect(parsePayload(wrap(future))).toBeNull();
    });

    test("returns null when state literal is unknown", () => {
        const bad = JSON.stringify({
            ...JSON.parse(validJson),
            state: "exploded",
        });
        expect(parsePayload(wrap(bad))).toBeNull();
    });

    test("returns null when required_conditions is not an array", () => {
        const bad = JSON.stringify({
            ...JSON.parse(validJson),
            required_conditions: {},
        });
        expect(parsePayload(wrap(bad))).toBeNull();
    });

    test("ignores unknown top-level keys (forward compat)", () => {
        const future = JSON.stringify({
            ...JSON.parse(validJson),
            some_new_key: 42,
        });
        const out = parsePayload(wrap(future));
        expect(out).not.toBeNull();
        expect(out.state).toBe("checking");
    });

    test("parses raw markdown source (no HTML wrapping) as engine writes it", () => {
        // The engine writes the marker block inside an HTML comment in the
        // markdown source. The raw markdown delivered by edit_form looks like:
        //   <!---
        //   DO NOT EDIT
        //   -*- Mergify Payload -*-
        //   {...}
        //   -*- Mergify Payload End -*-
        //   -->
        // The leading `<!---` line and trailing `-->` are part of the source,
        // and the regex anchors on `^DO NOT EDIT` with the `m` flag.
        const markdown = `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n${validJson}\n-*- Mergify Payload End -*-\n-->\n\nMergify is checking your pull request.`;
        const out = parsePayload(markdown);
        expect(out).not.toBeNull();
        expect(out.state).toBe("checking");
    });
});

const MARKER_SOURCE = `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n{"version":1,"state":"checking","queue_rule_name":null,"queued_at":null,"estimated_time_of_merge":null,"speculative_check_pr":null,"required_conditions":[]}\n-*- Mergify Payload End -*-\n-->`;

// Build a TimelineItem fixture.
//  - bot:           if true, includes the `a[href="/apps/mergify"]` author link
//  - inlineSource:  if non-null, embeds a textarea.CommentBox-input with that value
//  - commentId:     if non-null, wraps the timeline item in an issuecomment-<id> div
function buildTimelineItem({ bot, inlineSource, commentId } = {}) {
    const item = document.createElement("div");
    item.className = "TimelineItem";
    if (bot) {
        const author = document.createElement("a");
        author.setAttribute("href", "/apps/mergify");
        item.appendChild(author);
    }
    const commentBody = document.createElement("div");
    commentBody.className = "comment-body";
    item.appendChild(commentBody);
    if (inlineSource != null) {
        const ta = document.createElement("textarea");
        ta.className = "CommentBox-input";
        // <textarea>.value is the live property; we set it directly so the
        // resolver picks it up.
        ta.value = inlineSource;
        item.appendChild(ta);
    }
    if (commentId != null) {
        const wrapper = document.createElement("div");
        wrapper.id = `issuecomment-${commentId}`;
        wrapper.appendChild(item);
        return wrapper;
    }
    return item;
}

describe("findLatestStatusCommentSync", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("returns payload synchronously when inline textarea has the marker", () => {
        document.body.appendChild(
            buildTimelineItem({ bot: true, inlineSource: MARKER_SOURCE }),
        );
        const result = findLatestStatusCommentSync();
        expect(result).not.toBeNull();
        expect(result.payload).not.toBeNull();
        expect(result.payload.state).toBe("checking");
    });

    test("returns payload=null when Mergify comment exists but has no inline textarea", () => {
        document.body.appendChild(
            buildTimelineItem({ bot: true, commentId: "12345" }),
        );
        const result = findLatestStatusCommentSync();
        expect(result).not.toBeNull();
        expect(result.payload).toBeNull();
        expect(result.commentId).toBe("12345");
    });

    test("returns null when no Mergify-authored TimelineItem exists", () => {
        document.body.appendChild(
            buildTimelineItem({ bot: false, inlineSource: MARKER_SOURCE }),
        );
        expect(findLatestStatusCommentSync()).toBeNull();
    });

    test("picks the newest in DOM order when multiple Mergify comments exist", () => {
        const firstSource = `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n{"version":1,"state":"waiting","queue_rule_name":null,"queued_at":null,"estimated_time_of_merge":null,"speculative_check_pr":null,"required_conditions":[]}\n-*- Mergify Payload End -*-\n-->`;
        document.body.appendChild(
            buildTimelineItem({ bot: true, inlineSource: firstSource }),
        );
        document.body.appendChild(
            buildTimelineItem({ bot: true, inlineSource: MARKER_SOURCE }),
        );
        const result = findLatestStatusCommentSync();
        expect(result.payload.state).toBe("checking");
    });

    test("skips later Mergify-authored events that have no marker and picks the latest status comment", () => {
        // Real PRs have many Mergify-authored TimelineItems that are events
        // (labels added, reviewers requested, queue breadcrumbs) AFTER the
        // status comment in DOM order. The status comment is the only one
        // with the payload marker; the resolver must skip the events and
        // pick the latest comment WITH a marker.
        document.body.appendChild(
            buildTimelineItem({ bot: true, inlineSource: MARKER_SOURCE }),
        );
        // Two subsequent Mergify events without textareas or commentIds —
        // these are not status comments.
        document.body.appendChild(buildTimelineItem({ bot: true }));
        document.body.appendChild(buildTimelineItem({ bot: true }));
        const result = findLatestStatusCommentSync();
        expect(result).not.toBeNull();
        expect(result.payload).not.toBeNull();
        expect(result.payload.state).toBe("checking");
    });

    test("falls back to the latest commentId-bearing candidate when no inline marker is present", () => {
        // None of the candidates have a hydrated textarea with the marker,
        // but two are issuecomment-hosted. The resolver should return the
        // latest commentId for the fetch fallback.
        document.body.appendChild(
            buildTimelineItem({ bot: true, commentId: "100" }),
        );
        document.body.appendChild(buildTimelineItem({ bot: true })); // event
        document.body.appendChild(
            buildTimelineItem({ bot: true, commentId: "200" }),
        );
        document.body.appendChild(buildTimelineItem({ bot: true })); // event
        const result = findLatestStatusCommentSync();
        expect(result).not.toBeNull();
        expect(result.payload).toBeNull();
        expect(result.commentId).toBe("200");
    });
});

describe("resolveLatestStatusCommentPayload", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("returns null when no Mergify comment exists (no fetch)", async () => {
        global.fetch = jest.fn();
        const result = await resolveLatestStatusCommentPayload();
        expect(result).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("returns inline payload without fetching when textarea has marker", async () => {
        global.fetch = jest.fn();
        document.body.appendChild(
            buildTimelineItem({ bot: true, inlineSource: MARKER_SOURCE }),
        );
        const result = await resolveLatestStatusCommentPayload();
        expect(result.payload).not.toBeNull();
        expect(result.payload.state).toBe("checking");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("falls back to edit_form fetch when inline textarea is absent", async () => {
        document.body.appendChild(
            buildTimelineItem({ bot: true, commentId: "9999" }),
        );
        const editFormHtml = `<form><textarea name="comment[body]">${MARKER_SOURCE}</textarea></form>`;
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                text: () => Promise.resolve(editFormHtml),
            }),
        );
        const result = await resolveLatestStatusCommentPayload();
        expect(global.fetch).toHaveBeenCalledWith(
            "/acme/widget/issue_comments/9999/edit_form",
        );
        expect(result.payload).not.toBeNull();
        expect(result.payload.state).toBe("checking");
    });

    test("returns null payload when fetch fails", async () => {
        document.body.appendChild(
            buildTimelineItem({ bot: true, commentId: "9999" }),
        );
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: false, text: () => Promise.resolve("") }),
        );
        const result = await resolveLatestStatusCommentPayload();
        expect(result.payload).toBeNull();
        expect(result.commentId).toBe("9999");
    });
});

const { attach, detach, getCurrent, refreshNow } = require("../mqPayload");

const VALID_PAYLOAD = {
    version: 1,
    state: "checking",
    queue_rule_name: "default",
    queued_at: "2026-05-29T10:14:02Z",
    estimated_time_of_merge: "2026-05-29T10:42:18Z",
    speculative_check_pr: 12345,
    required_conditions: [],
};

function markerFor(payload) {
    return `<!---\nDO NOT EDIT\n-*- Mergify Payload -*-\n${JSON.stringify(payload)}\n-*- Mergify Payload End -*-\n-->`;
}

function appendInlineComment(payload) {
    const item = buildTimelineItem({
        bot: true,
        inlineSource: markerFor(payload),
    });
    document.body.appendChild(item);
    return item.querySelector("textarea.CommentBox-input");
}

describe("attach/detach — payload path", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        detach();
        jest.useFakeTimers();
    });

    afterEach(() => {
        detach();
        jest.useRealTimers();
    });

    test("fires callback once with payload state when inline textarea is present at attach time", () => {
        appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({
            source: "payload",
            payload: expect.objectContaining({ state: "checking" }),
        });
        expect(getCurrent()).toEqual({
            source: "payload",
            payload: expect.any(Object),
        });
    });

    test("re-fires callback when the inline textarea value changes (next periodic poll)", async () => {
        const ta = appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();

        // Engine updates the textarea's `.value`. NOTE: a textarea `.value`
        // assignment does NOT trigger MutationObserver (MO watches DOM tree
        // mutations, not property writes), so freshness here relies on the
        // periodic poll. Advance the clock by QUEUE_POLL_INTERVAL.
        ta.value = markerFor({ ...VALID_PAYLOAD, state: "frozen" });
        await jest.advanceTimersByTimeAsync(15_000);
        // Allow microtasks for _resolveAndEmit's await to settle.
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0].payload.state).toBe("frozen");
    });

    test("does not re-fire when the payload is unchanged", async () => {
        appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();

        await jest.advanceTimersByTimeAsync(15_000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(cb).not.toHaveBeenCalled();
    });

    test("regression: timeline mutations do NOT trigger edit_form refetch once in payload mode", async () => {
        // The mqPayload fetched edit_form on every page mutation, which on
        // mutation-heavy PR pages hammered GitHub. Once the payload is
        // resolved, the periodic poll owns freshness.
        appendInlineComment(VALID_PAYLOAD);
        // Spy on fetch so we can count calls.
        const fetchSpy = jest.fn(() =>
            Promise.resolve({
                ok: false,
                text: () => Promise.resolve(""),
            }),
        );
        global.fetch = fetchSpy;
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();
        fetchSpy.mockClear();

        // Simulate a burst of unrelated DOM mutations (GitHub re-renders heavily).
        for (let i = 0; i < 20; i++) {
            const noise = document.createElement("div");
            noise.textContent = `noise-${i}`;
            document.body.appendChild(noise);
        }
        // Let the timeline observer's debounce (800ms) elapse plus extra.
        await jest.advanceTimersByTimeAsync(2_000);
        for (let i = 0; i < 5; i++) await Promise.resolve();

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(cb).not.toHaveBeenCalled();
    });

    test("detach disconnects observers and timers — subsequent changes do not fire", async () => {
        const ta = appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();
        detach();

        ta.value = markerFor({ ...VALID_PAYLOAD, state: "frozen" });
        await jest.advanceTimersByTimeAsync(30_000);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(cb).not.toHaveBeenCalled();
        expect(getCurrent()).toBeNull();
    });
});

describe("attach/detach — fallback + upgrade", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        detach();
        jest.useFakeTimers();
    });

    afterEach(() => {
        detach();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    function mockChecksFetch(queued) {
        const checksHtml = `<a href="?check_run_id=999"><span>Mergify Merge Queue</span></a>`;
        const runHtml = queued ? "Queued for merge" : "Some other state";
        global.fetch = jest.fn((url) => {
            const u = String(url);
            if (u.includes("/checks")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(checksHtml),
                });
            }
            if (u.includes("/runs/")) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(runHtml),
                });
            }
            // For any other URL (including edit_form), return not-ok so the
            // payload resolver returns null and we stay in fallback mode.
            return Promise.resolve({
                ok: false,
                text: () => Promise.resolve(""),
            });
        });
    }

    // Flush enough microtask ticks for the initial fallback poll's awaited
    // fetches to resolve. We can't use runAllTimersAsync because the fallback
    // recursively schedules itself every QUEUE_POLL_INTERVAL.
    async function flushFallbackPoll() {
        for (let i = 0; i < 10; i++) await Promise.resolve();
    }

    test("emits fallback state when no payload comment is in DOM", async () => {
        mockChecksFetch(true);
        const cb = jest.fn();
        attach(cb);
        await flushFallbackPoll();
        expect(cb).toHaveBeenCalledWith({ source: "fallback", queued: true });
    });

    test("upgrades to payload state when a status comment with inline textarea is added later", async () => {
        mockChecksFetch(false);
        const cb = jest.fn();
        attach(cb);
        await flushFallbackPoll();
        cb.mockClear();

        // Engine posts the MQ status comment with an inline (materialized)
        // edit-form textarea containing the payload marker.
        appendInlineComment(VALID_PAYLOAD);

        // Timeline observer debounces by TIMELINE_OBSERVER_DEBOUNCE_MS (800ms);
        // advance past it and let microtasks settle.
        await jest.advanceTimersByTimeAsync(900);
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({
            source: "payload",
            payload: expect.objectContaining({ state: "checking" }),
        });
    });

    test("regression: a scheduled fallback poll cannot downgrade after upgrade", async () => {
        mockChecksFetch(false);
        const cb = jest.fn();
        attach(cb);
        await flushFallbackPoll(); // initial poll resolves: emits fallback
        cb.mockClear();

        // Advance to just before the next scheduled fallback poll would fire.
        await jest.advanceTimersByTimeAsync(14_000);

        // Upgrade happens (inline textarea materialized with payload).
        appendInlineComment(VALID_PAYLOAD);
        // Timeline observer debounces by TIMELINE_OBSERVER_DEBOUNCE_MS (800ms).
        await jest.advanceTimersByTimeAsync(900);
        for (let i = 0; i < 10; i++) await Promise.resolve();

        // Now flush past the original scheduled fallback poll's firing time
        // plus several more polls.
        await jest.advanceTimersByTimeAsync(60_000);
        await flushFallbackPoll();
        await flushFallbackPoll();

        // No fallback emit should appear after the payload emit.
        const calls = cb.mock.calls.map(([state]) => state.source);
        const payloadIdx = calls.lastIndexOf("payload");
        expect(payloadIdx).toBeGreaterThanOrEqual(0);
        expect(calls.slice(payloadIdx).every((s) => s === "payload")).toBe(
            true,
        );
    });

    test("does not emit stale fallback state after upgrade has occurred", async () => {
        // Make the initial fallback fetch slow so it's still in flight when
        // the upgrade happens.
        let resolveFetch;
        const fetchGate = new Promise((resolve) => {
            resolveFetch = resolve;
        });
        global.fetch = jest.fn((url) => {
            const u = String(url);
            if (u.includes("/checks") || u.includes("/runs/")) {
                return fetchGate.then(() => ({
                    ok: true,
                    text: () =>
                        Promise.resolve(
                            `<a href="?check_run_id=999"><span>Mergify Merge Queue</span></a>`,
                        ),
                }));
            }
            return Promise.resolve({
                ok: false,
                text: () => Promise.resolve(""),
            });
        });

        const cb = jest.fn();
        attach(cb);

        // Upgrade happens before the fallback fetch resolves.
        appendInlineComment(VALID_PAYLOAD);
        // Timeline observer debounces by TIMELINE_OBSERVER_DEBOUNCE_MS (800ms).
        await jest.advanceTimersByTimeAsync(900);
        for (let i = 0; i < 10; i++) await Promise.resolve();

        // Now let the in-flight fetch resolve.
        resolveFetch();
        for (let i = 0; i < 10; i++) await Promise.resolve();

        // There must be a payload emit and NO fallback emit AFTER it.
        const calls = cb.mock.calls.map(([state]) => state.source);
        const payloadIdx = calls.lastIndexOf("payload");
        expect(payloadIdx).toBeGreaterThanOrEqual(0);
        expect(calls.slice(payloadIdx).every((s) => s === "payload")).toBe(
            true,
        );
    });
});

describe("refreshNow — immediate focus/visibility refresh", () => {
    // The fallback-mode test assigns global.fetch directly;
    // jest.restoreAllMocks() only restores spyOn spies, not direct property
    // assignments, so capture and restore the original ourselves to avoid
    // leaking the mock into later tests.
    let originalFetch;
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.replaceState({}, "", "/acme/widget/pull/42");
        originalFetch = global.fetch;
        detach();
    });

    afterEach(() => {
        detach();
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test("is a no-op when not attached", async () => {
        await expect(refreshNow()).resolves.toBeUndefined();
    });

    test("does nothing when not on a pull request page", async () => {
        window.history.replaceState({}, "", "/acme/widget/pulls");
        appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();

        await refreshNow();
        expect(cb).not.toHaveBeenCalled();
    });

    test("payload mode: re-resolves and emits immediately without waiting for the poll", async () => {
        const ta = appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();

        // Engine rewrites the textarea `.value` (no DOM-tree mutation, so the
        // MutationObserver won't catch it). refreshNow must pick it up right
        // away instead of waiting for the next QUEUE_POLL_INTERVAL tick.
        ta.value = markerFor({ ...VALID_PAYLOAD, state: "frozen" });
        await refreshNow();

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0]).toEqual({
            source: "payload",
            payload: expect.objectContaining({ state: "frozen" }),
        });
    });

    test("payload mode: does not re-emit when the payload is unchanged", async () => {
        appendInlineComment(VALID_PAYLOAD);
        const cb = jest.fn();
        attach(cb);
        cb.mockClear();

        await refreshNow();
        expect(cb).not.toHaveBeenCalled();
    });

    test("fallback mode: re-fetches the check-run queue state immediately", async () => {
        let queued = false;
        global.fetch = jest.fn((url) => {
            const u = String(url);
            if (u.includes("/checks")) {
                return Promise.resolve({
                    ok: true,
                    text: () =>
                        Promise.resolve(
                            `<a href="?check_run_id=999"><span>Mergify Merge Queue</span></a>`,
                        ),
                });
            }
            if (u.includes("/runs/")) {
                return Promise.resolve({
                    ok: true,
                    text: () =>
                        Promise.resolve(
                            queued ? "Queued for merge" : "Some other state",
                        ),
                });
            }
            // edit_form etc. — keep us in fallback mode.
            return Promise.resolve({
                ok: false,
                text: () => Promise.resolve(""),
            });
        });

        const cb = jest.fn();
        attach(cb);
        // Let the initial fallback poll settle (emits queued:false).
        for (let i = 0; i < 10; i++) await Promise.resolve();
        cb.mockClear();

        // Queue state flips outside the page; focus refresh must observe it.
        queued = true;
        await refreshNow();

        expect(cb).toHaveBeenCalledWith({ source: "fallback", queued: true });
    });
});
