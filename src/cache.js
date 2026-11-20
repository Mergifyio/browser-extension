export class MergifyCache {
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

// The per-PR status cache that used to colour the stack rows' dots. Its only
// reader went with the stack list, so entries written by an earlier version
// would otherwise sit there unread for ever: they expired on read, and
// nothing reads them now. Safe to delete once installs have turned over.
//
// Matched on the whole key shape rather than the prefix alone. The prefix is
// MergifyCache's own with `_pr_status` appended, so `startsWith` also claims
// the repo-enabled entry of `github.com/pr/status*` — and this sweep runs on
// every load, where the clearAll() it replaces ran only on a reload, so that
// repo's cache could never survive. The trailing `_<num>_<sha>` is what no
// MergifyCache key has.
const LEGACY_PR_STATUS_KEY_RE =
    /^mergify_browser_extension_pr_status_.+_\d+_[^_]+$/;

export function removeLegacyPrStatusEntries() {
    try {
        const stale = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && LEGACY_PR_STATUS_KEY_RE.test(k)) stale.push(k);
        }
        for (const k of stale) localStorage.removeItem(k);
    } catch (e) {
        console.error("removeLegacyPrStatusEntries failed:", e);
    }
}

// Where the revision cache below used to live: github.com's localStorage,
// one entry per pull request, keyed `<prefix>_<org>_<repo>_<num>`. There it
// was readable by any script of the origin and outlived a logout or an
// account switch in the browser profile, private repositories' SHAs and
// revision reasons included. Swept on every load so a tab still running an
// older version leaves nothing behind once it reloads; losing an entry only
// costs one refetch of the revision comment.
//
// Matched on the whole key shape rather than the prefix: `_stack_ctx_` is
// MergifyCache's own prefix plus a suffix, which an org named `stack` with a
// repository named `ctx_…` would also produce. The trailing `_<num>` after
// two more segments is what such a MergifyCache key almost never has.
const LEGACY_STACK_CONTEXT_KEY_RE =
    /^mergify_browser_extension_stack_ctx_.+_.+_\d+$/;

export function removeLegacyStackContextEntries() {
    try {
        const stale = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && LEGACY_STACK_CONTEXT_KEY_RE.test(k)) stale.push(k);
        }
        for (const k of stale) localStorage.removeItem(k);
    } catch (e) {
        console.error("removeLegacyStackContextEntries failed:", e);
    }
}

// The revision data of each pull request whose Stacks panel this page drew,
// so navigating back to one paints the panel before its comment is refetched.
// It lives in the content script's memory for the life of the page: nothing
// reaches github.com's storage, and a reload, a logout or an account switch
// (each a full page load) starts empty.
export class StackContextCache {
    constructor(expirationMs = 60 * 60 * 1000) {
        this.expirationMs = expirationMs;
        this.entries = new Map();
    }

    key(org, repo, num) {
        return `${org}/${repo}/${num}`;
    }

    get(org, repo, num) {
        const k = this.key(org, repo, num);
        const entry = this.entries.get(k);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.expirationMs) {
            this.entries.delete(k);
            return null;
        }
        return { revisionData: entry.revisionData };
    }

    update(org, repo, num, revisionData) {
        this.entries.set(this.key(org, repo, num), {
            revisionData,
            timestamp: Date.now(),
        });
    }

    remove(org, repo, num) {
        this.entries.delete(this.key(org, repo, num));
    }

    clear() {
        this.entries.clear();
    }
}
