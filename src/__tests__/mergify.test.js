const {
    MergifyCache,
    findNewMergeBox,
    getPullStatus,
    isMergifyEnabledOnTheRepo,
} = require("../mergify");
const { loadFixture } = require("./utils");

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

describe("findNewMergeBox", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should find the new merge box on opened pull requests", () => {
        loadFixture("github_pr_opened");

        const mergeBox = findNewMergeBox();

        expect(mergeBox).not.toBeUndefined();
        expect(mergeBox.tagName).toBe("DIV");
        expect(mergeBox.innerHTML).toMatch(/<section aria-label="Reviews"/);
        expect(mergeBox.innerHTML).toMatch(/<section aria-label="Checks"/);
    });

    it("should find the new merge box on merged pull requests", () => {
        loadFixture("github_pr_merged");

        const mergeBox = findNewMergeBox();

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
        loadFixture("github_pr_opened");

        const status = getPullStatus();

        expect(status).toBe("open");
    });

    it("should get opened pull request status", () => {
        loadFixture("github_pr_merged");

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

    it("should return true if Mergify is enabled on the repo", () => {
        loadFixture("github_pr_opened");
        const isEnabled = isMergifyEnabledOnTheRepo();
        expect(isEnabled).toBe(true);
    });

    it("should return false if Mergify is not enabled on the repo", () => {
        loadFixture("github_pr_no_mergify");
        const isEnabled = isMergifyEnabledOnTheRepo();
        expect(isEnabled).toBe(false);
    });

    it("should still return false if cache have true but the repo is not enabled", () => {
        loadFixture("github_pr_no_mergify");
        const cache = new MergifyCache();
        cache.update("cypress-io", "cypress", true);

        const isEnabled = isMergifyEnabledOnTheRepo();
        expect(isEnabled).toBe(false);
    });

    it("should still return true if cache have false and the repo is enabled", () => {
        loadFixture("github_pr_opened");
        const cache = new MergifyCache();
        cache.update("cypress-io", "cypress", false);

        const isEnabled = isMergifyEnabledOnTheRepo();
        expect(isEnabled).toBe(true);
    });
});
