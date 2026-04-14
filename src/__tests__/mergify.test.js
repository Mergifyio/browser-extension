const {
    MergifyCache,
    findTimelineActions,
    isPullRequestOpen,
    isPullRequestQueued,
    resetQueueState,
    wasMergedByMergify,
    getMergedMessage,
    MERGED_MESSAGES,
    isMergifyEnabledOnTheRepo,
    getMergifyConfigurationStatus,
    convertMergifyTimestamps,
    isMergifyBotComment,
    formatLocalTime,
} = require("../mergify");
const { loadFixture, injectFixtureInDOM } = require("./utils");

describe("MergifyCache", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(Date, "now").mockImplementation(() => 1000);

        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue(loadFixture("searchConfigFound")),
        });
        global.fetch = mockFetch;
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

    it("should find the new merge box on pull requests without any timeline actions items", () => {
        injectFixtureInDOM("github_pr_no_timeline_actions");

        const mergeBox = findTimelineActions();

        expect(mergeBox).not.toBeUndefined();
        expect(mergeBox.tagName).toBe("DIV");
        expect(mergeBox.innerHTML).toBe(" ");
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

describe("isPullRequestOpen", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should detect open PR via legacy span.State (fixture)", () => {
        injectFixtureInDOM("github_pr_opened");

        const status = isPullRequestOpen();

        expect(status).toBe(true);
    });

    it("should detect merged PR via legacy span.State (fixture)", () => {
        injectFixtureInDOM("github_pr_merged");

        const status = isPullRequestOpen();

        expect(status).toBe(false);
    });

    it("should detect open PR via data-status=pullOpened attribute", () => {
        document.body.innerHTML = '<span data-status="pullOpened">Open</span>';

        expect(isPullRequestOpen()).toBe(true);
    });

    it("should detect draft PR via data-status=draft attribute", () => {
        document.body.innerHTML = '<span data-status="draft">Draft</span>';

        expect(isPullRequestOpen()).toBe(true);
    });

    it("should detect closed PR via data-status=pullClosed attribute", () => {
        document.body.innerHTML =
            '<span data-status="pullClosed">Closed</span>';

        expect(isPullRequestOpen()).toBe(false);
    });

    it("should detect merged PR via data-status=pullMerged attribute", () => {
        document.body.innerHTML =
            '<span data-status="pullMerged">Merged</span>';

        expect(isPullRequestOpen()).toBe(false);
    });

    it("should prefer data-status over legacy span.State", () => {
        document.body.innerHTML =
            '<span data-status="pullOpened">Open</span>' +
            '<span class="State" title="Status: Closed">Closed</span>';

        expect(isPullRequestOpen()).toBe(true);
    });

    it("should detect closed PR via legacy span.State when no data-status", () => {
        document.body.innerHTML =
            '<span class="State" title="Status: Closed">Closed</span>';

        expect(isPullRequestOpen()).toBe(false);
    });

    it("should assume open when no status element is found", () => {
        document.body.innerHTML = "<div>No status here</div>";

        expect(isPullRequestOpen()).toBe(true);
    });

    it("should assume open when legacy span.State has no parseable title", () => {
        const consoleSpy = jest
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        document.body.innerHTML =
            '<span class="State" title="Malformed">Badge</span>';

        expect(isPullRequestOpen()).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(
            "Can't find pull request status",
        );

        consoleSpy.mockRestore();
    });
});

describe("isPullRequestQueued", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        resetQueueState();
    });

    it("should return false when no Checks section exists", () => {
        document.body.innerHTML = "<div>No checks here</div>";
        expect(isPullRequestQueued()).toBe(false);
    });

    it("should return true when check says 'In merge queue'", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <span>Mergify Merge Queue</span>
                        <span>— In merge queue</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(true);
    });

    it("should return true when check says 'Running merge queue checks'", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <span>Mergify Merge Queue</span>
                        <span>— Running merge queue checks</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(true);
    });

    it("should return true when check says 'Queued for merge'", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <span>Mergify Merge Queue</span>
                        <span>— Queued for merge</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(true);
    });

    it("should return false when check says 'conditions are under evaluation'", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <svg class="prc-Spinner-SpinnerAnimation-tutJZ"></svg>
                        <span>Mergify Merge Queue</span>
                        <span>— Your merge queue conditions are under evaluation</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(false);
    });

    it("should return false when check says 'Waiting for queue conditions to match'", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <svg class="octicon octicon-square-fill"></svg>
                        <span>Mergify Merge Queue</span>
                        <span>— Waiting for queue conditions to match</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(false);
    });

    it("should return false when no Mergify Merge Queue check exists", () => {
        document.body.innerHTML = `
            <section aria-label="Checks">
                <ul>
                    <li>
                        <svg class="octicon octicon-check-circle-fill"></svg>
                        <span>CI / build</span>
                    </li>
                </ul>
            </section>
        `;
        expect(isPullRequestQueued()).toBe(false);
    });
});

describe("wasMergedByMergify", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should return true when mergify bot merged the PR", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <a href="/apps/mergify">mergify</a>
                <span>merged commit abc123 into main</span>
            </div>
        `;
        expect(wasMergedByMergify()).toBe(true);
    });

    it("should return false when a human merged the PR", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <a href="/users/jd">jd</a>
                <span>merged commit abc123 into main</span>
            </div>
        `;
        expect(wasMergedByMergify()).toBe(false);
    });

    it("should return false when PR is not merged", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <span>Some other timeline event</span>
            </div>
        `;
        expect(wasMergedByMergify()).toBe(false);
    });

    it("should return false when no timeline items exist", () => {
        document.body.innerHTML = "<div>Empty page</div>";
        expect(wasMergedByMergify()).toBe(false);
    });
});

describe("getMergedMessage", () => {
    beforeEach(() => {
        History.prototype.pushState.call(
            window.history,
            {},
            "",
            "/org/repo/pull/42",
        );
    });

    it("should return a message from the MERGED_MESSAGES list", () => {
        const message = getMergedMessage();
        expect(MERGED_MESSAGES).toContain(message);
    });

    it("should return a consistent message for the same PR number", () => {
        const message1 = getMergedMessage();
        const message2 = getMergedMessage();
        expect(message1).toBe(message2);
    });

    it("should return different messages for different PR numbers", () => {
        const message1 = getMergedMessage();

        History.prototype.pushState.call(
            window.history,
            {},
            "",
            "/org/repo/pull/43",
        );
        const message2 = getMergedMessage();

        expect(message1).not.toBe(message2);
    });
});

describe("isMergifyEnabledOnTheRepo caching behavior", () => {
    beforeEach(() => {
        localStorage.clear();
        // Set URL path for pull request data
        History.prototype.pushState.call(
            window.history,
            {},
            "",
            "/cypress-io/cypress/pull/32277",
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
        // Set URL path for pull request data
        History.prototype.pushState.call(
            window.history,
            {},
            "",
            "/test-org/test-repo/pull/123",
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

describe("formatLocalTime", () => {
    it("should format a date using Intl.DateTimeFormat", () => {
        const date = new Date("2025-06-15T14:30:00Z");
        const result = formatLocalTime(date);

        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });
});

describe("isMergifyBotComment", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should return true for a Mergify bot comment", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        const container = document.querySelector(".TimelineItem");
        expect(isMergifyBotComment(container)).toBe(true);
    });

    it("should return false for a non-Mergify comment", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        const containers = document.querySelectorAll(".TimelineItem");
        // Second container is from "someuser".
        expect(isMergifyBotComment(containers[1])).toBe(false);
    });
});

describe("convertMergifyTimestamps", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should convert UTC timestamps in Mergify bot comments", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        convertMergifyTimestamps();

        const mergifyComment = document.querySelector(".TimelineItem");
        const codes = mergifyComment.querySelectorAll(
            "code[data-mergify-local-time]",
        );

        expect(codes.length).toBe(2);
        expect(codes[0].textContent).not.toBe("2025-06-15 14:30 UTC");
        expect(codes[0].getAttribute("title")).toBe("2025-06-15 14:30 UTC");
        expect(codes[1].getAttribute("title")).toBe("2025-06-15 16:00 UTC");
        expect(codes[1].style.cursor).toBe("help");
    });

    it("should not convert timestamps in non-Mergify comments", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        convertMergifyTimestamps();

        const containers = document.querySelectorAll(".TimelineItem");
        const userCode = containers[1].querySelector("code");

        expect(userCode.textContent).toBe("2025-06-15 14:30 UTC");
        expect(userCode.hasAttribute("data-mergify-local-time")).toBe(false);
    });

    it("should not re-process already converted timestamps", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        convertMergifyTimestamps();

        const code = document.querySelector("code[data-mergify-local-time]");
        const firstConversion = code.textContent;

        convertMergifyTimestamps();

        expect(code.textContent).toBe(firstConversion);
        expect(code.getAttribute("title")).toBe("2025-06-15 14:30 UTC");
    });

    it("should ignore non-matching code elements", () => {
        injectFixtureInDOM("github_pr_mergify_timestamp");
        convertMergifyTimestamps();

        const mergifyComment = document.querySelector(".TimelineItem");
        const allCodes = mergifyComment.querySelectorAll("code");
        const ruleCode = Array.from(allCodes).find(
            (c) => c.textContent === "default",
        );

        expect(ruleCode).toBeDefined();
        expect(ruleCode.hasAttribute("data-mergify-local-time")).toBe(false);
    });

    it("should handle invalid dates gracefully", () => {
        document.body.innerHTML = `
            <div class="TimelineItem js-comment-container">
                <a class="author" href="/apps/mergify">mergify</a>
                <div class="comment-body"><code>9999-99-99 99:99 UTC</code></div>
            </div>
        `;

        expect(() => convertMergifyTimestamps()).not.toThrow();

        const code = document.querySelector("code");
        expect(code.textContent).toBe("9999-99-99 99:99 UTC");
    });
});
