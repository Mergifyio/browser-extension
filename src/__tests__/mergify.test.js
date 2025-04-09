const { MergifyCache, findNewMergeBox } = require("../mergify");
const fs = require("node:fs");
const path = require("node:path");

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
    function loadFixture(name) {
        const htmlPath = path.resolve(__dirname, `./fixtures/${name}.html`);
        const htmlContent = fs.readFileSync(htmlPath, "utf8");

        document.body.innerHTML = htmlContent;
    }

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
