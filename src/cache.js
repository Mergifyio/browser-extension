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

export class PrStatusCache {
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
