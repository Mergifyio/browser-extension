const {
    MergifyCache,
    findTimelineActions,
    getPullStatus,
    isMergifyEnabledOnTheRepo,
    getMergifyConfigurationStatus,
} = require("../mergify");
const { loadFixture, injectFixtureInDOM } = require("./utils");

describe("MergifyCache", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(Date, "now").mockImplementation(() => 1000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should return null if the cache is empty", () => {
        const mergifyCache = new MergifyCache();
        expect(mergifyCache.get("foo", "my-repo")).toBeNull();
    });

    it("should return the cache", () => {
        const mergifyCache = new MergifyCache();
        mergifyCache.update("foo", "my-repo", true);
        expect(mergifyCache.get("foo", "my-repo")).toBe(true);
    });

    it("should use proper keys", () => {
        const mergifyCache = new MergifyCache();
        mergifyCache.update("org1", "repo1", 1);
        mergifyCache.update("org1", "repo2", 2);
        mergifyCache.update("org2", "repo1", 3);

        expect(mergifyCache.get("org1", "repo1")).toBe(1);
        expect(mergifyCache.get("org1", "repo2")).toBe(2);
        expect(mergifyCache.get("org2", "repo1")).toBe(3);
    });

    it("should expire cache entries", () => {
        const mergifyCache = new MergifyCache(500); // 500ms expiration
        mergifyCache.update("foo", "my-repo", true);

        expect(mergifyCache.get("foo", "my-repo")).toBe(true);

        // Advance time beyond expiration
        Date.now.mockImplementation(() => 1501);

        expect(mergifyCache.get("foo", "my-repo")).toBeNull();
    });

    it("should handle invalid JSON in cache", () => {
        const mergifyCache = new MergifyCache();
        const key = mergifyCache.key("foo", "my-repo");
        localStorage.setItem(key, "not-valid-json");

        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        expect(mergifyCache.get("foo", "my-repo")).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});

describe("findTimelineActions", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should find the new merge box on opened pull requests", () => {
        injectFixtureInDOM("github_pr_opened");

        const mergeBox = findTimelineActions();

        expect(mergeBox).not.toBeUndefined();
        expect(mergeBox.tagName).toBe("DIV");
        expect(mergeBox.innerHTML).toMatch(/<section aria-label="Reviews"/);
        expect(mergeBox.innerHTML).toMatch(/<section aria-label="Checks"/);
    });

    it("should find the new merge box on merged pull requests", () => {
        injectFixtureInDOM("github_pr_merged");

        const mergeBox = findTimelineActions();

        expect(mergeBox).not.toBeUndefined();
        expect(mergeBox.tagName).toBe("DIV");
        expect(mergeBox.innerHTML).toMatch(
            /Pull\s+request\s+successfully\s+merged\s+and\s+closed/,
        );
    });
});

describe("getPullStatus", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should get opened pull request status", () => {
        injectFixtureInDOM("github_pr_opened");

        const status = getPullStatus();

        expect(status).toBe("open");
    });

    it("should get opened pull request status", () => {
        injectFixtureInDOM("github_pr_merged");

        const status = getPullStatus();

        expect(status).toBe("merged");
    });
});

describe("isMergifyEnabledOnTheRepo caching behavior", () => {
    beforeEach(() => {
        localStorage.clear();
        // Mock document.location

        // biome-ignore lint/performance/noDelete: <explanation>
        delete window.location;
        window.location = new URL(
            "https://github.com/cypress-io/cypress/pull/32277",
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        localStorage.clear();
    });

    it("should return true if Mergify is enabled on the repo with config", () => {
        injectFixtureInDOM("github_pr_opened");
        const isEnabled = isMergifyEnabledOnTheRepo(true);
        expect(isEnabled).toBe(true);
    });

    it("should return true if Mergify is enabled on the repo with no config", () => {
        injectFixtureInDOM("github_pr_opened");
        const isEnabled = isMergifyEnabledOnTheRepo(false);
        expect(isEnabled).toBe(true);
    });

    it("should return false if Mergify is not enabled on the repo", () => {
        injectFixtureInDOM("github_pr_no_mergify");
        const isEnabled = isMergifyEnabledOnTheRepo(false);
        expect(isEnabled).toBe(false);
    });

    it("should still return true if cache have false and the repo is enabled", () => {
        injectFixtureInDOM("github_pr_opened");
        const cache = new MergifyCache();
        cache.update("cypress-io", "cypress", false);

        const isEnabled = isMergifyEnabledOnTheRepo(true);
        expect(isEnabled).toBe(true);
    });
});

describe("getMergifyConfigurationStatus", () => {
    beforeEach(() => {
        localStorage.clear();
        // Mock window.location for pull request data
        //
        // biome-ignore lint/performance/noDelete: <explanation>
        delete window.location;
        window.location = new URL(
            "https://github.com/test-org/test-repo/pull/123",
        );
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it("should return true if configuration is found in cache", async () => {
        const cache = new MergifyCache();
        cache.update("test-org", "test-repo", true);

        const result = await getMergifyConfigurationStatus();
        expect(result).toBe(true);
    });

    it("should return false if configuration is not found in cache and no config files exist", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            text: jest
                .fn()
                .mockResolvedValue(loadFixture("searchConfigNotFound")),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(false);
        expect(mockFetch).toHaveBeenCalledWith(
            "/search?q=repo%3Atest-org%2Ftest-repo+%28.mergify.yml+OR+.mergify%2Fconfig.yml+OR+.github%2Fmergify.yml%29&type=code",
        );
    });

    it("should return true if configuration files are found via search", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue(loadFixture("searchConfigFound")),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
            "/search?q=repo%3Atest-org%2Ftest-repo+%28.mergify.yml+OR+.mergify%2Fconfig.yml+OR+.github%2Fmergify.yml%29&type=code",
        );
    });

    it("should update cache when search result differs from cached value", async () => {
        const cache = new MergifyCache();
        cache.update("test-org", "test-repo", false);

        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue(loadFixture("searchConfigFound")),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(true);
        expect(cache.get("test-org", "test-repo")).toBe(true);
    });

    it("should handle malformed HTML response gracefully", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue("<html><body></body></html>"),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
        const mockFetch = jest
            .fn()
            .mockRejectedValue(new Error("Network error"));
        global.fetch = mockFetch;

        await expect(getMergifyConfigurationStatus()).rejects.toThrow(
            "Network error",
        );
    });

    it("should not update cache if cached value matches search result", async () => {
        const cache = new MergifyCache();
        cache.update("test-org", "test-repo", true);
        const cacheSpy = jest.spyOn(cache, "update");

        // Mock MergifyCache constructor to return our spy
        jest.spyOn(require("../mergify"), "MergifyCache").mockImplementation(
            () => cache,
        );

        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue(loadFixture("searchConfigFound")),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(true);
        expect(cacheSpy).not.toHaveBeenCalled();
    });
});
