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

export class StackContextCache {
    constructor(expirationMs = 60 * 60 * 1000) {
        this.PREFIX = "mergify_browser_extension_stack_ctx";
        this.expirationMs = expirationMs;
    }

    key(org, repo, num) {
        return `${this.PREFIX}_${org}_${repo}_${num}`;
    }

    get(org, repo, num) {
        const k = this.key(org, repo, num);
        try {
            const raw = localStorage.getItem(k);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.timestamp > this.expirationMs) {
                localStorage.removeItem(k);
                return null;
            }
            return { revisionData: data.revisionData ?? null };
        } catch (e) {
            console.error("StackContextCache get failed:", e);
            return null;
        }
    }

    update(org, repo, num, revisionData) {
        const k = this.key(org, repo, num);
        try {
            localStorage.setItem(
                k,
                JSON.stringify({ revisionData, timestamp: Date.now() }),
            );
        } catch (e) {
            console.error("StackContextCache update failed:", e);
        }
    }

    remove(org, repo, num) {
        try {
            localStorage.removeItem(this.key(org, repo, num));
        } catch (e) {
            console.error("StackContextCache remove failed:", e);
        }
    }
}
