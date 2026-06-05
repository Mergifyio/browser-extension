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

import {
    MergifyCache as _MergifyCache,
    PrStatusCache as _PrStatusCache,
    StackContextCache as _StackContextCache,
} from "./cache.js";
import { debug } from "./debug.js";
import { getPullRequestData, isGitHubPullRequestPage } from "./dom.js";
import * as mqPayload from "./mqPayload.js";
import {
    buildMergifyRow,
    fetchQueueStateIfNeeded,
    getMergifyConfigurationStatus,
    isMergifyEnabledOnTheRepo,
    MERGE_BOX_ROW_ATTR,
    resetQueueState,
    scheduleQueueStatePoll,
    startEtaTicker,
    stopEtaTicker,
    updateAllMergifyRows,
} from "./queue.js";
import { renderMergifyContext } from "./stacks.js";
import { convertMergifyTimestamps } from "./timestamps.js";

export * from "./debug.js";
export * from "./dom.js";
export * from "./logo.js";
export * from "./queue.js";
export * from "./stacks.js";
export * from "./timestamps.js";
// Re-export everything for the test suite (which imports from "../mergify").
// Cache classes are re-exported as named exports (not export *) so that
// jest.spyOn can replace them on the module object in tests.
export {
    _MergifyCache as MergifyCache,
    _PrStatusCache as PrStatusCache,
    _StackContextCache as StackContextCache,
};

// Clear cached PR statuses on a page reload (covers force-reload too —
// browsers don't expose hard-vs-soft reload to JS, so we treat any reload
// the same way). Normal SPA navigations stay cached.
try {
    const navType = performance.getEntriesByType?.("navigation")?.[0]?.type;
    if (navType === "reload") {
        new _PrStatusCache().clearAll();
    }
} catch (_e) {
    // Best effort.
}

// Orchestrator-owned state
let lastPullRequestUrl = null;
let injecting = false;
let pendingInjection = false;
let pageUpdateScheduled = false;
let _mqAttached = false;

export function resetForNavigation() {
    resetQueueState(); // also calls resetStackState internally
    mqPayload.detach();
    _mqAttached = false;
    lastPullRequestUrl = null;
}

// Anchors we inject the Mergify row into. Each entry resolves a container in
// the document (or returns null) and tells the injector how to attach the row.
// Multiple anchors can match on the same page — e.g. GitHub is rolling out a
// new merge-status sidebar dialog alongside the legacy bottom merge box — and
// we want the row visible on every variant the user can see.
const MERGE_BOX_ANCHORS = [
    {
        name: "new merge-status sidebar",
        // The new sidebar is rendered as a Primer dialog at the document
        // root. The bottom merge box also exposes a
        // [data-testid="mergebox-border-container"] on its inner section
        // wrapper, so we only treat the testid as the sidebar anchor when
        // it sits OUTSIDE the legacy mergebox-partial.
        find: () => {
            const containers = document.querySelectorAll(
                '[data-testid="mergebox-border-container"]',
            );
            return Array.from(containers).filter(
                (c) => !c.closest('[data-testid="mergebox-partial"]'),
            );
        },
        attach: (container, row) => container.appendChild(row),
        variant: "sidebar",
    },
    {
        name: "merge-box-partial",
        find: () => {
            const partials = document.querySelectorAll(
                '[data-testid="mergebox-partial"]',
            );
            const containers = [];
            for (const partial of partials) {
                // Newer deploys add the testid to the inner section wrapper;
                // older ones only have the utility class. Either anchors the
                // default-variant row.
                const inner =
                    partial.querySelector(
                        '[data-testid="mergebox-border-container"]',
                    ) || partial.querySelector(".border.rounded-2");
                if (inner) containers.push(inner);
            }
            return containers;
        },
        attach: (container, row) => container.appendChild(row),
        variant: "default",
    },
    {
        name: "discussion-timeline-actions merge-pr",
        find: () => {
            const detail = document.querySelector(
                "div[class=discussion-timeline-actions]",
            );
            const inner = detail?.querySelector(".merge-pr .border.rounded-2");
            return inner ? [inner] : [];
        },
        attach: (container, row) => container.appendChild(row),
        variant: "default",
    },
    {
        name: "classic mergeability-details",
        find: () => document.querySelectorAll(".mergeability-details"),
        attach: (container, row) =>
            container.insertBefore(row, container.firstChild),
        variant: "default",
    },
];

export function injectRowIntoMergeBox() {
    let injected = false;
    for (const anchor of MERGE_BOX_ANCHORS) {
        for (const container of anchor.find()) {
            // Idempotency per container: skip if we already attached a row
            // here. Multiple anchors can therefore coexist without growing
            // duplicate rows on repeated MutationObserver ticks.
            if (container.querySelector(`[${MERGE_BOX_ROW_ATTR}]`)) continue;
            anchor.attach(container, buildMergifyRow(anchor.variant));
            debug(`Mergify section injected into ${anchor.name}`);
            injected = true;
        }
    }
    return injected;
}

async function _tryInject() {
    if (!isGitHubPullRequestPage()) {
        // SPA-navigated away from a PR (e.g., back to /pulls). The
        // floating stack-nav pill is body-fixed and outside Turbo's
        // tree, so Turbo won't sweep it for us — clean up our own
        // surfaces. Guarded so MutationObserver re-firing on the new
        // page doesn't churn cleanup work.
        if (lastPullRequestUrl !== null) {
            resetForNavigation();
        }
        debug("Not a pull request page");
        return;
    }

    const currentUrl = window.location.pathname;
    if (currentUrl !== lastPullRequestUrl) {
        resetForNavigation();
        lastPullRequestUrl = currentUrl;
    }

    // Try synchronous Mergify-enabled detection first (Mergify app icon in
    // DOM, or cached repo result). Only fall back to the /search fetch when
    // we have no synchronous signal — that fetch is the single biggest
    // contributor to first-row latency on cold loads.
    let mergifyEnabled = isMergifyEnabledOnTheRepo(false);
    if (!mergifyEnabled) {
        const hasMergifyConfiguration = await getMergifyConfigurationStatus();
        mergifyEnabled = isMergifyEnabledOnTheRepo(hasMergifyConfiguration);
    }
    if (!mergifyEnabled) {
        debug("Mergify is not enabled on the repo");
        return;
    }

    const _data = getPullRequestData();
    const contextPayload = {
        org: _data.org,
        repo: _data.repo,
        number: Number.parseInt(_data.pull, 10),
        subpath: _data.subpath,
    };

    // injectRowIntoMergeBox is idempotent per anchor (data-attr guard inside)
    // so we can call it on every tick — it will only add a row to anchors
    // that don't already have one. Existing rows still get their queue state
    // refreshed via updateAllMergifyRows below.
    injectRowIntoMergeBox();
    updateAllMergifyRows();

    void renderMergifyContext(contextPayload);
    void fetchQueueStateIfNeeded().then(() => {
        updateAllMergifyRows();
    });

    if (document.querySelector(`[${MERGE_BOX_ROW_ATTR}]`)) {
        scheduleQueueStatePoll();
    }

    // Subscribe to engine-authoritative merge-queue payloads (PR #32922).
    // When a status comment with a payload exists, mqPayload emits payload
    // states and we re-render every row in the rich shape; when none exists,
    // it emits fallback states that pass through to the legacy patch path.
    // Both lifecycles flow through updateAllMergifyRows so all containers
    // (bottom mergebox + side peek) stay in sync.
    if (!_mqAttached) {
        _mqAttached = true;
        mqPayload.attach((state) => {
            updateAllMergifyRows();
            if (
                state.source === "payload" &&
                state.payload.estimated_time_of_merge
            ) {
                startEtaTicker(state.payload);
            } else {
                stopEtaTicker();
            }
        });
    }
}

function tryInject() {
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

// Coalesces rapid-fire calls (e.g. from MutationObserver) into a single update per frame.
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
