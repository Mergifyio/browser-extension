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
import {
    buildMergifyRow,
    fetchQueueStateIfNeeded,
    getMergifyConfigurationStatus,
    isMergifyEnabledOnTheRepo,
    resetQueueState,
    scheduleQueueStatePoll,
    updateMergifyRow,
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

export function resetForNavigation() {
    resetQueueState(); // also calls resetStackState internally
    lastPullRequestUrl = null;
}

function injectRowIntoMergeBox() {
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
            return true;
        }
    }

    let detailSection = document.querySelector(
        "div[class=discussion-timeline-actions]",
    );
    if (detailSection) {
        const mergeBoxContainer = detailSection.querySelector(
            ".merge-pr .border.rounded-2",
        );
        if (mergeBoxContainer) {
            mergeBoxContainer.appendChild(buildMergifyRow());
            debug("Mergify section injected inside merge-pr container");
            return true;
        }
        debug("Merge box container not found yet, waiting for render");
        return false;
    }

    // Classic merge box
    detailSection = document.querySelector(".mergeability-details");
    if (detailSection) {
        detailSection.insertBefore(buildMergifyRow(), detailSection.firstChild);
        debug("Mergify section injected in classic merge box");
        return true;
    }
    return false;
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

    const existingRow = document.querySelector("#mergify");
    if (existingRow) {
        updateMergifyRow(existingRow);
        void renderMergifyContext(contextPayload);
        return;
    }

    // Inject the row immediately with state derived synchronously from the
    // DOM. The queue-state and stack-context fetches run in parallel in the
    // background — when fetchQueueStateIfNeeded resolves, we re-derive the
    // button state and swap it in if it changed.
    const injected = injectRowIntoMergeBox();

    void renderMergifyContext(contextPayload);
    void fetchQueueStateIfNeeded().then(() => {
        const row = document.querySelector("#mergify");
        if (row) updateMergifyRow(row);
    });

    if (injected) scheduleQueueStatePoll();
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
