// What the queue is doing with a queued pull request, beyond the payload's
// coarse state: the optional fields proposed for the status report's payload
// (Mergifyio/monorepo#46755). The engine does not write them yet; until it
// does every reader below returns null and the row draws the state alone.
//
// Every field is optional and checked for its type, so a payload from an
// engine that writes none, some or a malformed one draws as it does today.

// The queue's step, from its batch outcome. "checking" in the payload covers
// all of them today.
const STEPS = new Set([
    "waiting_for_batch",
    "preparing",
    "waiting_for_checks_slot",
    "checks_running",
    "waiting_for_previous_batches",
    "waiting_for_schedule",
    "blocked_by_frozen_batch",
    "conflict_deferred",
    "checks_postponed",
    "waiting_for_requeue",
    "ready_to_merge",
    "bisecting",
]);

const _int = (v) => (Number.isInteger(v) && v > 0 ? v : null);
const _count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const _str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const _time = (v) => (_str(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const _obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

function _names(v) {
    if (!Array.isArray(v)) return null;
    const names = v.map(_str).filter(Boolean);
    return names.length > 0 ? names : null;
}

// How many failing checks `checks_count` says there are beyond the names
// listed: the list can be capped. 0 when the count is missing, malformed or
// no more than the names, as from an engine that lists every one.
function _moreChecks(names, count) {
    const total = _count(count);
    return names && total !== null && total > names.length
        ? total - names.length
        : 0;
}

function _pulls(v) {
    if (!Array.isArray(v)) return null;
    const pulls = v.map(_int).filter(Boolean);
    return pulls.length > 0 ? pulls : null;
}

// A tree of condition nodes, every node an object with a description, or
// null: a malformed one must not keep the row from drawing its reason.
function _conditionTree(v) {
    const valid = (node) =>
        Boolean(node) &&
        typeof node === "object" &&
        typeof node.description === "string" &&
        (node.subconditions === undefined ||
            (Array.isArray(node.subconditions) &&
                node.subconditions.every(valid)));
    return Array.isArray(v) && v.length > 0 && v.every(valid) ? v : null;
}

// The sanitized optional fields of a payload; null when it carries none.
export function readQueueDetail(payload) {
    if (!payload || typeof payload !== "object") return null;
    const batch = _obj(payload.batch);
    const checks = _obj(payload.checks);
    const bisection = _obj(payload.bisection);
    const freeze = _obj(payload.freeze);
    const pause = _obj(payload.pause);
    const reason = _obj(payload.dequeue_reason);
    const failedChecks = _names(reason.checks);
    const detail = {
        step: STEPS.has(payload.step) ? payload.step : null,
        batch:
            _int(batch.size) && _int(batch.target)
                ? {
                      size: batch.size,
                      target: batch.target,
                      proceedsAt: _time(batch.proceeds_at),
                  }
                : null,
        checks: {
            attempt: _int(checks.attempt),
            maxAttempts: _int(checks.max_attempts),
            timeoutAt: _time(checks.timeout_at),
        },
        bisection:
            _int(bisection.round) && _int(bisection.max_rounds)
                ? { round: bisection.round, maxRounds: bisection.max_rounds }
                : null,
        freeze: _str(freeze.name)
            ? { name: _str(freeze.name), until: _time(freeze.until) }
            : null,
        pauseReason: _str(pause.reason),
        blockedBy: _pulls(payload.blocked_by),
        dequeueReason: _str(reason.label)
            ? {
                  label: _str(reason.label),
                  by: _str(reason.by),
                  checks: failedChecks,
                  moreChecks: _moreChecks(failedChecks, reason.checks_count),
                  // The engine's own sentence, and the conditions as they
                  // stood when it left (nodes of required_conditions).
                  message: _str(reason.message),
                  conditions: _conditionTree(reason.conditions),
              }
            : null,
        // When the pull request left the queue, merged or removed.
        leftAt: _time(payload.left_at),
    };
    const { checks: c, ...rest } = detail;
    const any =
        Object.values(rest).some((v) => v !== null) ||
        Object.values(c).some((v) => v !== null);
    return any ? detail : null;
}

// "14:50", in the viewer's time zone.
export function clockTime(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

const _prList = (pulls) => pulls.map((n) => `#${n}`).join(", ");

// The title, icon and lines a queued row draws for its step, or null to keep
// the state's own. `state` is the payload's.
export function describeQueueStep(state, detail) {
    if (!detail) return null;
    const step = state === "bisecting" ? "bisecting" : detail.step;
    const notes = [];
    switch (step) {
        case "waiting_for_batch": {
            const b = detail.batch;
            if (b) notes.push(`${b.size}/${b.target} pull requests`);
            if (b?.proceedsAt)
                notes.push(`proceeds at ${clockTime(b.proceedsAt)}`);
            return { title: "Waiting for a batch", icon: "clock", notes };
        }
        case "preparing":
            return {
                title: "Preparing checks",
                icon: "git-merge-queue",
                notes: [],
            };
        case "waiting_for_checks_slot":
            return {
                title: "Waiting for a checks slot",
                icon: "clock",
                notes: ["the checks already running must finish first"],
            };
        case "waiting_for_previous_batches":
            return {
                title: "Waiting for the batches ahead",
                icon: "clock",
                notes: [],
            };
        case "waiting_for_schedule":
            return {
                title: "Waiting for the merge schedule",
                icon: "clock",
                notes: ["merges once the schedule allows"],
            };
        case "blocked_by_frozen_batch":
            return {
                title: "Blocked by a frozen batch",
                icon: "lock",
                notes: detail.blockedBy
                    ? [`${_prList(detail.blockedBy)} must merge first`]
                    : [],
            };
        case "conflict_deferred":
            return {
                title: "Checks deferred",
                icon: "clock",
                notes: [
                    detail.blockedBy
                        ? `conflicts with ${_prList(detail.blockedBy)} ahead in the queue`
                        : "conflicts with a pull request ahead in the queue",
                ],
            };
        case "checks_postponed":
            return {
                title: "Checks postponed",
                icon: "clock",
                notes: detail.checks.attempt
                    ? [`retrying (attempt ${detail.checks.attempt})`]
                    : ["retrying"],
            };
        case "waiting_for_requeue":
            return {
                title: "Waiting to be re-queued",
                icon: "git-merge-queue",
                notes: ["not the cause of the failure"],
            };
        case "ready_to_merge":
            return {
                title: "Ready to merge",
                icon: "git-merge",
                notes: ["all checks passed"],
            };
        case "bisecting":
            return {
                title: "Bisecting a failed batch",
                icon: "iterations",
                notes: detail.bisection
                    ? [
                          `round ${detail.bisection.round}/${detail.bisection.maxRounds}`,
                      ]
                    : [],
            };
        case "checks_running": {
            const { attempt, maxAttempts, timeoutAt } = detail.checks;
            if (attempt && maxAttempts && attempt > 1)
                notes.push(`attempt ${attempt}/${maxAttempts}`);
            if (timeoutAt) notes.push(`times out at ${clockTime(timeoutAt)}`);
            return { title: "Checks running", icon: "git-merge-queue", notes };
        }
        default:
            break;
    }
    if (state === "frozen" && detail.freeze) {
        const { name, until } = detail.freeze;
        return {
            title: "Merge queue frozen",
            icon: "lock",
            notes: [until ? `${name} · until ${clockTime(until)}` : name],
        };
    }
    if (state === "paused" && detail.pauseReason) {
        return {
            title: "Merge queue paused",
            icon: "git-merge-queue",
            notes: [detail.pauseReason],
        };
    }
    return null;
}

// The failing checks of a removal, in words: "ci-gate, lint and 3 more".
// Null when it names none.
export function failingChecksText(reason) {
    if (!reason?.checks) return null;
    const names = reason.checks.join(", ");
    return reason.moreChecks ? `${names} and ${reason.moreChecks} more` : names;
}

// Why the pull request was removed, in words: "checks failed on ci-gate",
// "pull request manually dequeued by @octocat". Null when the payload says
// nothing.
export function dequeueReasonText(detail) {
    const reason = detail?.dequeueReason;
    if (!reason) return null;
    let text = reason.label;
    const checks = failingChecksText(reason);
    if (checks) text += ` on ${checks}`;
    if (reason.by) text += ` by @${reason.by}`;
    return text;
}
