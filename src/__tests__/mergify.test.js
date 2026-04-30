const {
    MergifyCache,
    PrStatusCache,
    findTimelineActions,
    isPullRequestOpen,
    isPullRequestQueued,
    resetQueueState,
    findLastMergifyCommand,
    deriveQueueButtonState,
    wasMergedByMergify,
    getMergedMessage,
    MERGED_MESSAGES,
    isMergifyEnabledOnTheRepo,
    getMergifyConfigurationStatus,
    convertMergifyTimestamps,
    isMergifyBotComment,
    formatLocalTime,
    parseStackMarker,
    parseRevisionMarker,
    STACK_MARKER_PREFIX,
    REVISION_MARKER_PREFIX,
    MARKER_SUFFIX,
    fetchPrStatus,
    gatherPrStatuses,
    buildContextPanel,
    updateStackDotStatus,
    injectContextPanel,
    renderMergifyContext,
    clearCommentsCache,
    buildStackNav,
    injectStackNav,
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

describe("findLastMergifyCommand", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("should return null when no command comments exist", () => {
        document.body.innerHTML = "<div>No comments</div>";
        expect(findLastMergifyCommand()).toBeNull();
    });

    it("should find @Mergifyio queue command", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">@Mergifyio queue</div>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.command).toBe("queue");
    });

    it("should find @mergifyio dequeue command", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio dequeue</div>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.command).toBe("dequeue");
    });

    it("should return the most recent command", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio queue</div>
            </div>
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio dequeue</div>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.command).toBe("dequeue");
    });

    it("should detect acknowledged (thumbs up) state", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio queue</div>
                <button class="social-reaction-summary-item" value="THUMBS_UP react">1</button>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.command).toBe("queue");
        expect(result.acknowledged).toBe(true);
    });

    it("should detect unacknowledged state", () => {
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio queue</div>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.acknowledged).toBe(false);
    });

    it("should skip long comments like Mergify status reports", () => {
        const longText =
            "Merge Queue Status\n" +
            "x".repeat(200) +
            "\n@mergifyio queue comment.";
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">${longText}</div>
            </div>
        `;
        expect(findLastMergifyCommand()).toBeNull();
    });

    it("should match short command even with long report before it", () => {
        const longText =
            "Merge Queue Status\n" +
            "x".repeat(200) +
            "\n@mergifyio queue comment.";
        document.body.innerHTML = `
            <div class="TimelineItem">
                <div class="comment-body">${longText}</div>
            </div>
            <div class="TimelineItem">
                <div class="comment-body">@Mergifyio queue</div>
            </div>
        `;
        const result = findLastMergifyCommand();
        expect(result.command).toBe("queue");
    });
});

describe("deriveQueueButtonState", () => {
    beforeEach(() => {
        resetQueueState();
        History.prototype.pushState.call(
            window.history,
            {},
            "",
            "/org/repo/pull/42",
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        resetQueueState();
    });

    it("should return 'unqueued' with no commands and no check run", () => {
        document.body.innerHTML = '<span data-status="pullOpened">Open</span>';
        expect(deriveQueueButtonState()).toBe("unqueued");
    });

    it("should return 'queuing' when queue command posted without thumbs up", () => {
        document.body.innerHTML = `
            <span data-status="pullOpened">Open</span>
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio queue</div>
            </div>
        `;
        expect(deriveQueueButtonState()).toBe("queuing");
    });

    it("should return 'unqueued' when queue command has thumbs up but check run says not queued", () => {
        document.body.innerHTML = `
            <span data-status="pullOpened">Open</span>
            <div class="TimelineItem">
                <div class="comment-body">@mergifyio queue</div>
                <button class="social-reaction-summary-item" value="THUMBS_UP react">1</button>
            </div>
        `;
        expect(deriveQueueButtonState()).toBe("unqueued");
    });

    it("should return 'merged' when PR merged by Mergify", () => {
        document.body.innerHTML = `
            <span data-status="pullMerged">Merged</span>
            <div class="TimelineItem">
                <a href="/apps/mergify">mergify</a>
                <span>merged commit abc123 into main</span>
            </div>
        `;
        expect(deriveQueueButtonState()).toBe("merged");
    });

    it("should return 'closed' when PR closed by non-Mergify", () => {
        document.body.innerHTML =
            '<span data-status="pullClosed">Closed</span>';
        expect(deriveQueueButtonState()).toBe("closed");
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

        const mockFetch = jest.fn().mockResolvedValue({
            text: jest.fn().mockResolvedValue(loadFixture("searchConfigFound")),
        });
        global.fetch = mockFetch;

        const result = await getMergifyConfigurationStatus();

        expect(result).toBe(true);
        // fetch should not be called when the cache already holds a value
        expect(mockFetch).not.toHaveBeenCalled();
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

describe("parseStackMarker", () => {
    function makeBody(payload, titleRows = "") {
        return (
            "Stack:\n" +
            "| # | Pull Request | Link | |\n" +
            "|--:|---|---|---|\n" +
            titleRows +
            `\n<!-- mergify-stack-data: ${JSON.stringify(payload)} -->\n`
        );
    }

    it("returns null when no comment carries the marker", () => {
        expect(
            parseStackMarker(["plain text", "no marker here"], 122),
        ).toBeNull();
    });

    it("parses a well-formed marker and merges titles from the table", () => {
        const payload = {
            schema_version: 1,
            stack_id: "feature/auth",
            pulls: [
                {
                    number: 121,
                    change_id: "Ia",
                    head_sha: "ab12cd3",
                    base_branch: "main",
                    dest_branch: "feature/auth",
                    is_current: false,
                },
                {
                    number: 122,
                    change_id: "Ib",
                    head_sha: "ef45gh6",
                    base_branch: "feature/auth",
                    dest_branch: "feature/auth",
                    is_current: true,
                },
            ],
        };
        const titleRows =
            "| 0 | Auth scaffolding | [#121](https://x/121) |  |\n" +
            "| 1 | Token refresh | [#122](https://x/122) | 👈 |\n";
        const result = parseStackMarker([makeBody(payload, titleRows)], 122);
        expect(result.stack_id).toBe("feature/auth");
        expect(result.pulls).toHaveLength(2);
        expect(result.pulls[0]).toMatchObject({
            number: 121,
            title: "Auth scaffolding",
            is_current: false,
        });
        expect(result.pulls[1]).toMatchObject({
            number: 122,
            title: "Token refresh",
            is_current: true,
        });
    });

    it("uses the latest marker when multiple are present", () => {
        function payload(stack_id) {
            return {
                schema_version: 1,
                stack_id,
                pulls: [
                    {
                        number: 1,
                        change_id: "i",
                        head_sha: "h",
                        base_branch: "main",
                        dest_branch: stack_id,
                        is_current: true,
                    },
                ],
            };
        }
        const a = `<!-- mergify-stack-data: ${JSON.stringify(payload("old"))} -->`;
        const b = `<!-- mergify-stack-data: ${JSON.stringify(payload("new"))} -->`;
        expect(parseStackMarker([a, b], 1).stack_id).toBe("new");
    });

    it("returns null on malformed JSON", () => {
        const body = `${STACK_MARKER_PREFIX}{not json}${MARKER_SUFFIX}`;
        expect(parseStackMarker([body], 122)).toBeNull();
    });

    it("returns null on schema_version != 1", () => {
        const body = `<!-- mergify-stack-data: ${JSON.stringify({
            schema_version: 2,
            stack_id: "x",
            pulls: [],
        })} -->`;
        expect(parseStackMarker([body], 122)).toBeNull();
    });

    it("returns null when the marker's is_current PR doesn't match — guards against stale-DOM SPA fetches", () => {
        // Marker says #30163 is the current PR, but we're rendering for #30164.
        // The fetched comment came from #30163's page during a navigation race.
        const payload = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 30163,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                },
                {
                    number: 30164,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "x",
                    dest_branch: "x",
                    is_current: false,
                },
            ],
        };
        const body = `<!-- mergify-stack-data: ${JSON.stringify(payload)} -->`;
        expect(parseStackMarker([body], 30164)).toBeNull();
        // Same marker matches when rendering for #30163.
        expect(parseStackMarker([body], 30163)).not.toBeNull();
    });

    it("falls back to 'PR #N' when title row is missing", () => {
        const payload = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 999,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                },
            ],
        };
        const body = `<!-- mergify-stack-data: ${JSON.stringify(payload)} -->`;
        expect(parseStackMarker([body], 999).pulls[0].title).toBe("PR #999");
    });

    it("unescapes \\| in titles", () => {
        const payload = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 5,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                },
            ],
        };
        const titleRows = "| 0 | Pipe \\| in title | [#5](https://x/5) |  |\n";
        const body =
            "| # | Pull Request | Link | |\n|--:|---|---|---|\n" +
            titleRows +
            `<!-- mergify-stack-data: ${JSON.stringify(payload)} -->`;
        expect(parseStackMarker([body], 5).pulls[0].title).toBe(
            "Pipe | in title",
        );
    });
});

describe("parseRevisionMarker", () => {
    function makeMarker(payload) {
        return `<!-- mergify-revision-data: ${JSON.stringify(payload)} -->`;
    }

    it("returns null when no comment matches the pull number", () => {
        const body = makeMarker({
            schema_version: 1,
            pull_number: 999,
            entries: [],
        });
        expect(parseRevisionMarker([body], 122)).toBeNull();
    });

    it("parses a matching marker", () => {
        const payload = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "ab12cd3",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: null,
                },
                {
                    number: 2,
                    change_type: "amend",
                    old_sha: "ab12cd3",
                    new_sha: "cd34ef5",
                    timestamp_iso: "2026-04-23T16:02:00Z",
                    compare_url: "https://x/compare/ab12cd3...cd34ef5",
                },
            ],
        };
        const result = parseRevisionMarker([makeMarker(payload)], 122);
        expect(result.entries).toHaveLength(2);
        expect(result.entries[1].change_type).toBe("amend");
    });

    it("returns null on malformed JSON", () => {
        const body = `${REVISION_MARKER_PREFIX}{bad}${MARKER_SUFFIX}`;
        expect(parseRevisionMarker([body], 122)).toBeNull();
    });

    it("captures the reason from a 5-col markdown table for any change_type", () => {
        const payload = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "rebase",
                    old_sha: "a",
                    new_sha: "b",
                    timestamp_iso: "t",
                    compare_url: "u",
                },
                {
                    number: 2,
                    change_type: "unknown",
                    old_sha: "b",
                    new_sha: "c",
                    timestamp_iso: "t",
                    compare_url: "u",
                },
                {
                    number: 3,
                    change_type: "amend",
                    old_sha: "c",
                    new_sha: "d",
                    timestamp_iso: "t",
                    compare_url: "u",
                },
            ],
        };
        const body =
            "### Revision history\n\n" +
            "| # | Type | Changes | Reason | Date |\n" +
            "|---|------|---------|--------|------|\n" +
            "| 1 | rebase | [link](u) | rebased onto main | 2026-04-22 09:00 UTC |\n" +
            "| 2 | unknown | [link](u) | follow-up after review | 2026-04-22 10:00 UTC |\n" +
            "| 3 | amend | [link](u) |  | 2026-04-22 11:00 UTC |\n" +
            `${REVISION_MARKER_PREFIX}${JSON.stringify(payload)}${MARKER_SUFFIX}`;
        const result = parseRevisionMarker([body], 122);
        // change_type values must come from the JSON unchanged.
        expect(result.entries[0].change_type).toBe("rebase");
        expect(result.entries[1].change_type).toBe("unknown");
        expect(result.entries[2].change_type).toBe("amend");
        // Reasons come from the markdown.
        expect(result.entries[0].reason).toBe("rebased onto main");
        expect(result.entries[1].reason).toBe("follow-up after review");
        expect(result.entries[2].reason).toBeNull();
    });

    it("returns null on schema_version mismatch", () => {
        const body = makeMarker({
            schema_version: 2,
            pull_number: 122,
            entries: [],
        });
        expect(parseRevisionMarker([body], 122)).toBeNull();
    });

    it("uses the latest matching marker when multiple are present", () => {
        const a = makeMarker({
            schema_version: 1,
            pull_number: 122,
            entries: [{ number: 1 }],
        });
        const b = makeMarker({
            schema_version: 1,
            pull_number: 122,
            entries: [{ number: 2 }],
        });
        expect(parseRevisionMarker([a, b], 122).entries[0].number).toBe(2);
    });
});

describe("PrStatusCache", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(Date, "now").mockImplementation(() => 1000);
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns null on cache miss", () => {
        const cache = new PrStatusCache();
        expect(cache.get("o", "r", 1, "abc")).toBeNull();
    });

    it("returns stored status on cache hit", () => {
        const cache = new PrStatusCache();
        cache.update("o", "r", 1, "abc", "open");
        expect(cache.get("o", "r", 1, "abc")).toBe("open");
    });

    it("treats different head_sha as a miss", () => {
        const cache = new PrStatusCache();
        cache.update("o", "r", 1, "abc", "open");
        expect(cache.get("o", "r", 1, "def")).toBeNull();
    });

    it("expires entries after TTL", () => {
        const cache = new PrStatusCache(500);
        cache.update("o", "r", 1, "abc", "open");
        Date.now.mockImplementation(() => 1501);
        expect(cache.get("o", "r", 1, "abc")).toBeNull();
    });

    it("returns null on corrupted entry", () => {
        const cache = new PrStatusCache();
        const k = cache.key("o", "r", 1, "abc");
        localStorage.setItem(k, "not-json");
        const errSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        expect(cache.get("o", "r", 1, "abc")).toBeNull();
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("clearAll removes only entries with our prefix", () => {
        const cache = new PrStatusCache();
        cache.update("o", "r", 1, "h", "open");
        cache.update("o", "r", 2, "h", "merged");
        localStorage.setItem("unrelated_key", "keep me");
        cache.clearAll();
        expect(cache.get("o", "r", 1, "h")).toBeNull();
        expect(cache.get("o", "r", 2, "h")).toBeNull();
        expect(localStorage.getItem("unrelated_key")).toBe("keep me");
    });

    it("expires after 1h by default", () => {
        const cache = new PrStatusCache();
        cache.update("o", "r", 1, "h", "open");
        // 59 minutes — still valid
        Date.now.mockImplementation(() => 1000 + 59 * 60 * 1000);
        expect(cache.get("o", "r", 1, "h")).toBe("open");
        // 61 minutes — expired
        Date.now.mockImplementation(() => 1000 + 61 * 60 * 1000);
        expect(cache.get("o", "r", 1, "h")).toBeNull();
    });
});

describe("fetchPrStatus", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    function mockFetchHtml(html, ok = true) {
        global.fetch = jest.fn().mockResolvedValue({
            ok,
            text: () => Promise.resolve(html),
        });
    }

    it("returns 'open' for an opened PR", async () => {
        mockFetchHtml('<html><span data-status="pullOpened"></span></html>');
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("open");
    });

    it("returns 'merged' for a merged PR", async () => {
        mockFetchHtml('<span data-status="pullMerged"></span>');
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("merged");
    });

    it("returns 'closed' for a closed PR", async () => {
        mockFetchHtml('<span data-status="pullClosed"></span>');
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("closed");
    });

    it("returns 'draft' for a draft PR", async () => {
        mockFetchHtml('<span data-status="draft"></span>');
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("draft");
    });

    it("returns 'unknown' on non-OK response", async () => {
        mockFetchHtml("", false);
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("unknown");
    });

    it("returns 'unknown' on fetch error", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("net"));
        await expect(fetchPrStatus("o", "r", 1)).resolves.toBe("unknown");
    });
});

describe("gatherPrStatuses", () => {
    beforeEach(() => {
        // Navigate away from any PR URL left by earlier tests so that
        // background RAF callbacks from the MutationObserver / onPageUpdate
        // path do not trigger extra fetch() calls during the concurrency test.
        History.prototype.pushState.call(window.history, {}, "", "/");
    });
    afterEach(() => {
        jest.restoreAllMocks();
        localStorage.clear();
    });

    it("uses cached statuses without calling fetch", async () => {
        const cache = new PrStatusCache();
        cache.update("o", "r", 1, "h", "open");
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy;
        const items = [{ org: "o", repo: "r", num: 1, head_sha: "h" }];
        const resolved = [];
        await gatherPrStatuses(items, cache, (item, status) => {
            resolved.push([item.num, status]);
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(resolved).toEqual([[1, "open"]]);
    });

    it("fetches misses, caches results, and calls onResolve", async () => {
        const cache = new PrStatusCache();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () =>
                Promise.resolve('<span data-status="pullMerged"></span>'),
        });
        const items = [{ org: "o", repo: "r", num: 2, head_sha: "h2" }];
        const resolved = [];
        await gatherPrStatuses(items, cache, (item, status) => {
            resolved.push([item.num, status]);
        });
        expect(resolved).toEqual([[2, "merged"]]);
        expect(cache.get("o", "r", 2, "h2")).toBe("merged");
    });

    it("respects the concurrency cap", async () => {
        const cache = new PrStatusCache();
        let inflight = 0;
        let peak = 0;
        global.fetch = jest.fn(async () => {
            inflight += 1;
            peak = Math.max(peak, inflight);
            await new Promise((r) => setTimeout(r, 5));
            inflight -= 1;
            return {
                ok: true,
                text: () =>
                    Promise.resolve('<span data-status="pullOpened"></span>'),
            };
        });
        const items = Array.from({ length: 8 }, (_, i) => ({
            org: "o",
            repo: "r",
            num: i,
            head_sha: `h${i}`,
        }));
        await gatherPrStatuses(items, cache, () => {}, 3);
        expect(peak).toBeLessThanOrEqual(3);
    });
});

describe("buildContextPanel", () => {
    function stack() {
        return {
            schema_version: 1,
            stack_id: "feature/auth",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "feature/auth",
                    is_current: true,
                    title: "PR title",
                },
            ],
        };
    }

    function rev() {
        return {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "ab12cd3",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: null,
                },
            ],
        };
    }

    function ctx() {
        return { org: "o", repo: "r", number: 122 };
    }

    it("returns null when both inputs are null", () => {
        expect(buildContextPanel(null, null, ctx())).toBeNull();
    });

    it("returns a panel with id 'mergify-context' when at least one is present", () => {
        const el = buildContextPanel(stack(), null, ctx());
        expect(el.id).toBe("mergify-context");
    });

    it("renders only the stack column when revision is null", () => {
        const el = buildContextPanel(stack(), null, ctx());
        expect(
            el.querySelector('[data-mergify-section="stack"]'),
        ).not.toBeNull();
        expect(
            el.querySelector('[data-mergify-section="revisions"]'),
        ).toBeNull();
    });

    it("renders only the revisions column when stack is null", () => {
        const el = buildContextPanel(null, rev(), ctx());
        expect(el.querySelector('[data-mergify-section="stack"]')).toBeNull();
        expect(
            el.querySelector('[data-mergify-section="revisions"]'),
        ).not.toBeNull();
    });

    it("renders both columns when both inputs are present", () => {
        const el = buildContextPanel(stack(), rev(), ctx());
        expect(
            el.querySelector('[data-mergify-section="stack"]'),
        ).not.toBeNull();
        expect(
            el.querySelector('[data-mergify-section="revisions"]'),
        ).not.toBeNull();
    });

    it("renders stack rows in base-on-top order with current PR accent", () => {
        const stackData = {
            schema_version: 1,
            stack_id: "feature/auth",
            pulls: [
                {
                    number: 121,
                    change_id: "i1",
                    head_sha: "h1",
                    base_branch: "main",
                    dest_branch: "feature/auth",
                    is_current: false,
                    title: "Auth scaffolding",
                },
                {
                    number: 122,
                    change_id: "i2",
                    head_sha: "h2",
                    base_branch: "feature/auth",
                    dest_branch: "feature/auth",
                    is_current: true,
                    title: "Token refresh",
                },
                {
                    number: 123,
                    change_id: "i3",
                    head_sha: "h3",
                    base_branch: "feature/auth",
                    dest_branch: "feature/auth",
                    is_current: false,
                    title: "Logout flow",
                },
            ],
        };
        const el = buildContextPanel(stackData, null, ctx());
        const rows = el.querySelectorAll("[data-mergify-pr-row]");
        expect(rows).toHaveLength(3);
        expect(rows[0].getAttribute("data-mergify-pr-row")).toBe("121");
        expect(rows[1].getAttribute("data-mergify-pr-row")).toBe("122");
        expect(rows[2].getAttribute("data-mergify-pr-row")).toBe("123");
        expect(rows[1].getAttribute("data-mergify-current")).toBe("true");
        expect(rows[0].getAttribute("data-mergify-current")).toBeNull();
        const dot121 = el.querySelector(
            '[data-mergify-status-dot][data-mergify-pr-num="121"]',
        );
        expect(dot121.getAttribute("data-mergify-head-sha")).toBe("h1");
        const dot122 = el.querySelector(
            '[data-mergify-status-dot][data-mergify-pr-num="122"]',
        );
        expect(dot122.getAttribute("data-mergify-head-sha")).toBe("h2");
        const dot123 = el.querySelector(
            '[data-mergify-status-dot][data-mergify-pr-num="123"]',
        );
        expect(dot123.getAttribute("data-mergify-head-sha")).toBe("h3");
        // Current row uses inset box-shadow (not border-left) so its content
        // doesn't shift right and stays aligned with non-current rows.
        const currentRow = rows[1];
        expect(currentRow.style.cssText).toMatch(/box-shadow:[^;]*inset/);
        expect(currentRow.style.cssText).not.toMatch(/border-left:/);
    });

    it("section label includes the position-in-stack indicator", () => {
        const stackData = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 1,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: false,
                    title: "a",
                },
                {
                    number: 2,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "x",
                    dest_branch: "x",
                    is_current: true,
                    title: "b",
                },
                {
                    number: 3,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "x",
                    dest_branch: "x",
                    is_current: false,
                    title: "c",
                },
            ],
        };
        const el = buildContextPanel(stackData, null, {
            org: "o",
            repo: "r",
            number: 2,
        });
        const sectionLabel = el.querySelector(
            '[data-mergify-section="stack"] div',
        );
        expect(sectionLabel.textContent).toBe("STACK · 3 PRs · you are #2");
    });

    it("makes each stack row an anchor to its PR", () => {
        const stackData = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                    title: "x",
                },
            ],
        };
        const el = buildContextPanel(stackData, null, {
            org: "o",
            repo: "r",
            number: 122,
        });
        const row = el.querySelector('[data-mergify-pr-row="122"]');
        expect(row.tagName).toBe("A");
        expect(row.getAttribute("href")).toBe("/o/r/pull/122");
    });

    it("renders stack rows with a status-dot placeholder by default", () => {
        const stackData = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                    title: "x",
                },
            ],
        };
        const el = buildContextPanel(stackData, null, ctx());
        const dot = el.querySelector("[data-mergify-status-dot]");
        expect(dot).not.toBeNull();
        expect(dot.getAttribute("data-mergify-status")).toBe("unknown");
    });

    it("updateStackDotStatus paints the dot and label", () => {
        const stackData = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                    title: "x",
                },
            ],
        };
        const el = buildContextPanel(stackData, null, ctx());
        updateStackDotStatus(el, 122, "merged");
        const dot = el.querySelector("[data-mergify-status-dot]");
        expect(dot.getAttribute("data-mergify-status")).toBe("merged");
        const lbl = el.querySelector("[data-mergify-status-label]");
        expect(lbl.textContent).toBe("merged");
    });

    it("renders revision dots in oldest→newest order", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "aaaaaaa",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: null,
                },
                {
                    number: 2,
                    change_type: "amend",
                    old_sha: "aaaaaaa",
                    new_sha: "bbbbbbb",
                    timestamp_iso: "2026-04-23T16:02:00Z",
                    compare_url: "https://x/compare/aaaaaaa...bbbbbbb",
                },
            ],
        };
        const el = buildContextPanel(null, revData, ctx());
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(dots).toHaveLength(2);
        expect(dots[0].getAttribute("data-mergify-change-type")).toBe(
            "initial",
        );
        expect(dots[1].getAttribute("data-mergify-change-type")).toBe("amend");
    });

    it("links 'initial' to commit page and others to compare_url", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "aaaaaaa",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: null,
                },
                {
                    number: 2,
                    change_type: "amend",
                    old_sha: "aaaaaaa",
                    new_sha: "bbbbbbb",
                    timestamp_iso: "2026-04-23T16:02:00Z",
                    compare_url: "https://x/compare/aaaaaaa...bbbbbbb",
                },
            ],
        };
        const el = buildContextPanel(null, revData, {
            org: "o",
            repo: "r",
            number: 122,
        });
        const links = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(links[0].getAttribute("href")).toBe("/o/r/commit/aaaaaaa");
        expect(links[1].getAttribute("href")).toBe(
            "https://x/compare/aaaaaaa...bbbbbbb",
        );
        for (const a of links) expect(a.getAttribute("target")).toBe("_blank");
    });

    it("marks the latest revision with data-mergify-latest", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "a",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: null,
                },
                {
                    number: 2,
                    change_type: "amend",
                    old_sha: "a",
                    new_sha: "b",
                    timestamp_iso: "2026-04-23T09:14:00Z",
                    compare_url: "u",
                },
            ],
        };
        const el = buildContextPanel(null, revData, ctx());
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(dots[0].getAttribute("data-mergify-latest")).toBeNull();
        expect(dots[1].getAttribute("data-mergify-latest")).toBe("true");
    });

    it("collapses middle entries when there are more than 6", () => {
        const entries = Array.from({ length: 8 }, (_, i) => ({
            number: i + 1,
            change_type: i === 0 ? "initial" : "amend",
            old_sha: i === 0 ? null : `${i}`.repeat(7),
            new_sha: `${i + 1}`.repeat(7),
            timestamp_iso: `2026-04-${String(20 + i).padStart(2, "0")}T09:14:00Z`,
            compare_url: i === 0 ? null : `u${i}`,
        }));
        const revData = { schema_version: 1, pull_number: 122, entries };
        const el = buildContextPanel(null, revData, ctx());
        const ellipsis = el.querySelector("[data-mergify-rev-ellipsis]");
        expect(ellipsis).not.toBeNull();
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        // first + entry-before-last + last two = 4 visible dots
        expect(dots).toHaveLength(4);
    });

    it("expands the ellipsis on click", () => {
        const entries = Array.from({ length: 8 }, (_, i) => ({
            number: i + 1,
            change_type: i === 0 ? "initial" : "amend",
            old_sha: i === 0 ? null : `${i}`.repeat(7),
            new_sha: `${i + 1}`.repeat(7),
            timestamp_iso: `2026-04-${String(20 + i).padStart(2, "0")}T09:14:00Z`,
            compare_url: i === 0 ? null : `u${i}`,
        }));
        const revData = { schema_version: 1, pull_number: 122, entries };
        const el = buildContextPanel(null, revData, ctx());
        const ellipsis = el.querySelector("[data-mergify-rev-ellipsis]");
        ellipsis.click();
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(dots).toHaveLength(8);
    });

    it("renders 'No revisions yet' when entries is empty", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [],
        };
        const el = buildContextPanel(null, revData, ctx());
        expect(
            el.querySelector("[data-mergify-revisions-empty]"),
        ).not.toBeNull();
        expect(el.querySelectorAll("[data-mergify-rev-dot]")).toHaveLength(0);
    });

    it("revision dot anchors carry an aria-label", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "amend",
                    old_sha: "a",
                    new_sha: "b",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: "u",
                },
            ],
        };
        const el = buildContextPanel(null, revData, ctx());
        const dot = el.querySelector("[data-mergify-rev-dot]");
        expect(dot.getAttribute("aria-label")).toMatch(/Revision 1 \(amend\)/);
    });

    it("renders the reason inline under the dot whenever it is set", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "rebase",
                    old_sha: "a",
                    new_sha: "b",
                    timestamp_iso: "2026-04-22T09:14:00Z",
                    compare_url: "u",
                    reason: "rebased onto main",
                },
                {
                    number: 2,
                    change_type: "unknown",
                    old_sha: "b",
                    new_sha: "c",
                    timestamp_iso: "2026-04-23T09:14:00Z",
                    compare_url: "u",
                    reason: "follow-up after review",
                },
                {
                    number: 3,
                    change_type: "amend",
                    old_sha: "c",
                    new_sha: "d",
                    timestamp_iso: "2026-04-24T09:14:00Z",
                    compare_url: "u",
                    reason: null,
                },
            ],
        };
        const el = buildContextPanel(null, revData, ctx());
        const reasons = el.querySelectorAll("[data-mergify-rev-reason]");
        // Exactly the two entries with non-null reasons render the label.
        expect(reasons).toHaveLength(2);
        expect(reasons[0].textContent).toBe("rebased onto main");
        expect(reasons[1].textContent).toBe("follow-up after review");
        // Tooltip on the parent anchor matches the reason for accessibility.
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(dots[0].getAttribute("title")).toBe("rebased onto main");
        expect(dots[2].hasAttribute("title")).toBe(false);
    });

    it("squashes consecutive rebase entries into one dot", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "initial",
                    old_sha: null,
                    new_sha: "aaaaaaa",
                    timestamp_iso: "2026-04-22T09:00:00Z",
                    compare_url: null,
                },
                {
                    number: 2,
                    change_type: "rebase",
                    old_sha: "aaaaaaa",
                    new_sha: "bbbbbbb",
                    timestamp_iso: "2026-04-22T10:00:00Z",
                    compare_url: "u2",
                },
                {
                    number: 3,
                    change_type: "rebase",
                    old_sha: "bbbbbbb",
                    new_sha: "ccccccc",
                    timestamp_iso: "2026-04-22T11:00:00Z",
                    compare_url: "u3",
                },
                {
                    number: 4,
                    change_type: "rebase",
                    old_sha: "ccccccc",
                    new_sha: "ddddddd",
                    timestamp_iso: "2026-04-22T12:00:00Z",
                    compare_url: "u4",
                },
            ],
        };
        const el = buildContextPanel(null, revData, {
            org: "o",
            repo: "r",
            number: 122,
        });
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        // initial + one squashed-rebase = 2 dots
        expect(dots).toHaveLength(2);
        const squashed = dots[1];
        expect(squashed.getAttribute("data-mergify-change-type")).toBe(
            "rebase",
        );
        expect(squashed.getAttribute("data-mergify-rebase-run")).toBe("3");
        // Compare URL should span the whole run: aaaaaaa -> ddddddd
        expect(squashed.getAttribute("href")).toBe(
            "/o/r/compare/aaaaaaa...ddddddd",
        );
        // Latest dot wears the halo regardless of squashing.
        expect(squashed.getAttribute("data-mergify-latest")).toBe("true");
    });

    it("does not squash rebase entries separated by an amend", () => {
        const revData = {
            schema_version: 1,
            pull_number: 122,
            entries: [
                {
                    number: 1,
                    change_type: "rebase",
                    old_sha: "a",
                    new_sha: "b",
                    timestamp_iso: "2026-04-22T09:00:00Z",
                    compare_url: "u1",
                },
                {
                    number: 2,
                    change_type: "amend",
                    old_sha: "b",
                    new_sha: "c",
                    timestamp_iso: "2026-04-22T10:00:00Z",
                    compare_url: "u2",
                },
                {
                    number: 3,
                    change_type: "rebase",
                    old_sha: "c",
                    new_sha: "d",
                    timestamp_iso: "2026-04-22T11:00:00Z",
                    compare_url: "u3",
                },
            ],
        };
        const el = buildContextPanel(null, revData, ctx());
        const dots = el.querySelectorAll("[data-mergify-rev-dot]");
        expect(dots).toHaveLength(3);
        for (const dot of dots) {
            expect(dot.getAttribute("data-mergify-rebase-run")).toBeNull();
        }
    });

    it("produces a stable data-mergify-hash across rebuilds with equal inputs", () => {
        const a = buildContextPanel(stack(), rev(), ctx());
        const b = buildContextPanel(stack(), rev(), ctx());
        expect(a.getAttribute("data-mergify-hash")).toBe(
            b.getAttribute("data-mergify-hash"),
        );
    });
});

describe("injectContextPanel", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    function makePanel(hash = "abc") {
        const p = document.createElement("div");
        p.id = "mergify-context";
        p.setAttribute("data-mergify-hash", hash);
        return p;
    }

    it("inserts the panel into the conversation target", () => {
        document.body.innerHTML =
            '<div id="discussion_bucket"><div></div></div>';
        injectContextPanel(makePanel());
        const dom = document.querySelector(
            "#discussion_bucket #mergify-context",
        );
        expect(dom).not.toBeNull();
    });

    it("skips re-rendering when the hash matches", () => {
        document.body.innerHTML = '<div id="discussion_bucket"></div>';
        injectContextPanel(makePanel("h1"));
        const first = document.querySelector("#mergify-context");
        injectContextPanel(makePanel("h1"));
        const after = document.querySelector("#mergify-context");
        expect(after).toBe(first);
    });

    it("rebuilds when the hash differs", () => {
        document.body.innerHTML = '<div id="discussion_bucket"></div>';
        injectContextPanel(makePanel("h1"));
        const first = document.querySelector("#mergify-context");
        injectContextPanel(makePanel("h2"));
        const after = document.querySelector("#mergify-context");
        expect(after).not.toBe(first);
        expect(after.getAttribute("data-mergify-hash")).toBe("h2");
    });

    it("no-ops when no acceptable target exists", () => {
        document.body.innerHTML = "<div></div>";
        injectContextPanel(makePanel());
        expect(document.querySelector("#mergify-context")).toBeNull();
    });
});

describe("renderMergifyContext", () => {
    beforeEach(() => {
        History.prototype.pushState.call(window.history, {}, "", "/");
        clearCommentsCache();
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
        clearCommentsCache();
    });

    // Sets up the page DOM so findMergifyCommentIds picks up our fake
    // comments, and mocks fetch to handle the two URL patterns we hit:
    //   - /<org>/<repo>/issue_comments/<id>/edit_form → textarea HTML with raw body
    //   - /<org>/<repo>/pull/<n>                      → HTML with data-status span
    function mockFetch({
        commentBodies = [],
        statusHtml = "",
        currentPrStatus = null,
    } = {}) {
        const visibleText = (body) =>
            /revision-data/i.test(body) ? "Revision history" : "Mergify stack";
        let html = '<div id="discussion_bucket"></div>';
        if (currentPrStatus) {
            html += `<span data-status="${currentPrStatus}"></span>`;
        }
        html += commentBodies
            .map(
                (body, i) =>
                    '<div class="TimelineItem">' +
                    `<div id="issuecomment-${i + 1}"></div>` +
                    `<div class="comment-body">${visibleText(body)}</div>` +
                    "</div>",
            )
            .join("");
        document.body.innerHTML = html;

        global.fetch = jest.fn((url) => {
            if (typeof url === "string") {
                const m = url.match(/\/issue_comments\/(\d+)\/edit_form$/);
                if (m) {
                    const idx = Number.parseInt(m[1], 10) - 1;
                    const body = commentBodies[idx] ?? "";
                    const escaped = body
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    return Promise.resolve({
                        ok: true,
                        text: () =>
                            Promise.resolve(
                                `<html><body><textarea>${escaped}</textarea></body></html>`,
                            ),
                    });
                }
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(statusHtml),
            });
        });
    }

    it("renders the panel when a stack marker is present", async () => {
        const stackPayload = {
            schema_version: 1,
            stack_id: "feature/auth",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "feature/auth",
                    is_current: true,
                },
            ],
        };
        const stackBody =
            "Stack:\n" +
            "| 0 | Token refresh | [#122](https://x/122) | 👈 |\n" +
            `<!-- mergify-stack-data: ${JSON.stringify(stackPayload)} -->`;
        mockFetch({
            commentBodies: [stackBody],
            statusHtml: '<span data-status="pullOpened"></span>',
        });
        await renderMergifyContext({ org: "o", repo: "r", number: 122 });
        const panel = document.querySelector("#mergify-context");
        expect(panel).not.toBeNull();
        expect(
            panel.querySelector('[data-mergify-pr-row="122"]'),
        ).not.toBeNull();
    });

    it("does not render when no Mergify-looking comment is present", async () => {
        // Empty commentBodies → no candidate IDs → no fetches → no panel.
        mockFetch({ commentBodies: [] });
        await renderMergifyContext({ org: "o", repo: "r", number: 122 });
        expect(document.querySelector("#mergify-context")).toBeNull();
    });

    it("writes the current PR's live status into PrStatusCache", async () => {
        // Seed cache with a stale value the user couldn't have seen
        const cache = new PrStatusCache();
        cache.update("o", "r", 122, "h", "draft");
        expect(cache.get("o", "r", 122, "h")).toBe("draft");

        const stackPayload = {
            schema_version: 1,
            stack_id: "x",
            pulls: [
                {
                    number: 122,
                    change_id: "i",
                    head_sha: "h",
                    base_branch: "main",
                    dest_branch: "x",
                    is_current: true,
                },
            ],
        };
        const stackBody =
            "Stack:\n" +
            "| 0 | T | [#122](https://x/122) | 👈 |\n" +
            `<!-- mergify-stack-data: ${JSON.stringify(stackPayload)} -->`;
        mockFetch({
            commentBodies: [stackBody],
            currentPrStatus: "pullOpened",
        });
        await renderMergifyContext({ org: "o", repo: "r", number: 122 });
        // The stale "draft" entry must have been overwritten by the live "open".
        expect(cache.get("o", "r", 122, "h")).toBe("open");
    });

    it("does not render when edit_form fetches fail", async () => {
        // Set up a candidate comment in the DOM so an ID is found, but make
        // the edit_form fetch return 404 (e.g., comment was deleted, or
        // the user lacks read access). Result: no body collected, no panel.
        document.body.innerHTML =
            '<div id="discussion_bucket"></div>' +
            '<div class="TimelineItem">' +
            '<div id="issuecomment-1"></div>' +
            '<div class="comment-body">Mergify stack</div>' +
            "</div>";
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: false, status: 404 }),
        );
        await renderMergifyContext({ org: "o", repo: "r", number: 122 });
        expect(document.querySelector("#mergify-context")).toBeNull();
    });

    it("resetQueueState removes any existing #mergify-context panel", () => {
        document.body.innerHTML =
            '<div id="discussion_bucket"><div id="mergify-context"></div></div>';
        resetQueueState();
        expect(document.querySelector("#mergify-context")).toBeNull();
    });

    it("does not paint stale-PR statuses onto a re-rendered panel", async () => {
        const stackPayloadA = {
            schema_version: 1,
            stack_id: "a",
            pulls: [
                {
                    number: 1,
                    change_id: "i1",
                    head_sha: "h1",
                    base_branch: "main",
                    dest_branch: "a",
                    is_current: true,
                },
                {
                    number: 2,
                    change_id: "i2",
                    head_sha: "h2",
                    base_branch: "a",
                    dest_branch: "a",
                    is_current: false,
                },
            ],
        };
        const stackBodyA =
            "Stack:\n" +
            "| 0 | A1 | [#1](https://x/1) | 👈 |\n" +
            "| 1 | A2 | [#2](https://x/2) |  |\n" +
            `<!-- mergify-stack-data: ${JSON.stringify(stackPayloadA)} -->`;
        // Mount the first PR's DOM, then mock fetch with a slow status response
        // so we can navigate before it resolves.
        let resolveStatusFetch;
        document.body.innerHTML =
            '<div id="discussion_bucket"></div>' +
            '<div class="TimelineItem">' +
            '<div id="issuecomment-1"></div>' +
            '<div class="comment-body">Mergify stack</div>' +
            "</div>";
        const escapedA = stackBodyA
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        global.fetch = jest.fn((url) => {
            if (
                typeof url === "string" &&
                /\/issue_comments\/\d+\/edit_form$/.test(url)
            ) {
                return Promise.resolve({
                    ok: true,
                    text: () =>
                        Promise.resolve(
                            `<html><body><textarea>${escapedA}</textarea></body></html>`,
                        ),
                });
            }
            return new Promise((res) => {
                resolveStatusFetch = () =>
                    res({
                        ok: true,
                        text: () =>
                            Promise.resolve(
                                '<span data-status="pullMerged"></span>',
                            ),
                    });
            });
        });
        const renderPromise = renderMergifyContext({
            org: "o",
            repo: "r",
            number: 1,
        });
        // Wait so the panel mounts before we simulate navigation.
        await Promise.resolve();
        await Promise.resolve();
        resetQueueState();
        // Now mount the second PR's DOM and mock fetch for it.
        const stackPayloadB = {
            schema_version: 1,
            stack_id: "b",
            pulls: [
                {
                    number: 5,
                    change_id: "i",
                    head_sha: "hb",
                    base_branch: "main",
                    dest_branch: "b",
                    is_current: true,
                },
            ],
        };
        const stackBodyB =
            "Stack:\n" +
            "| 0 | B1 | [#5](https://x/5) | 👈 |\n" +
            `<!-- mergify-stack-data: ${JSON.stringify(stackPayloadB)} -->`;
        mockFetch({ commentBodies: [stackBodyB] });
        await renderMergifyContext({ org: "o", repo: "r", number: 5 });
        // Resolve the stale fetch from the first render.
        if (resolveStatusFetch) resolveStatusFetch();
        await renderPromise.catch(() => {});
        const dot = document.querySelector(
            '[data-mergify-status-dot][data-mergify-pr-num="5"]',
        );
        expect(dot.getAttribute("data-mergify-status")).not.toBe("merged");
    });
});

describe("buildStackNav", () => {
    function pull(number, opts = {}) {
        return {
            number,
            change_id: `i${number}`,
            head_sha: `h${number}`,
            base_branch: "main",
            dest_branch: "x",
            is_current: opts.is_current || false,
            title: opts.title || `Title ${number}`,
        };
    }
    function stackOf(...pulls) {
        return { schema_version: 1, stack_id: "x", pulls };
    }
    function ctx(num) {
        return { org: "o", repo: "r", number: num };
    }

    it("returns null when stack has fewer than 2 PRs", () => {
        const single = stackOf(pull(1, { is_current: true }));
        expect(buildStackNav(single, ctx(1))).toBeNull();
    });

    it("returns null when stackData is null", () => {
        expect(buildStackNav(null, ctx(1))).toBeNull();
    });

    it("returns null when current PR is not in the stack", () => {
        const stack = stackOf(pull(1), pull(2));
        expect(buildStackNav(stack, ctx(99))).toBeNull();
    });

    it("renders prev and next halves when in the middle", () => {
        const stack = stackOf(pull(1), pull(2, { is_current: true }), pull(3));
        const el = buildStackNav(stack, ctx(2));
        expect(el.id).toBe("mergify-stack-nav");
        const prev = el.querySelector('[data-mergify-stack-nav="prev"]');
        const next = el.querySelector('[data-mergify-stack-nav="next"]');
        expect(prev.getAttribute("href")).toBe("/o/r/pull/1");
        expect(prev.getAttribute("data-mergify-stack-nav-num")).toBe("1");
        expect(next.getAttribute("href")).toBe("/o/r/pull/3");
        expect(next.getAttribute("data-mergify-stack-nav-num")).toBe("3");
    });

    it("middle label shows position-in-stack as N/M", () => {
        const stack = stackOf(
            pull(1),
            pull(2, { is_current: true }),
            pull(3),
            pull(4),
            pull(5),
        );
        const el = buildStackNav(stack, ctx(2));
        // The middle label sits between prev and next, exposing the position.
        const labels = Array.from(el.children).map((c) => c.textContent);
        expect(labels.some((t) => t === "STACK 2/5")).toBe(true);
    });

    it("mutes prev when at the base of the stack", () => {
        const stack = stackOf(pull(1, { is_current: true }), pull(2));
        const el = buildStackNav(stack, ctx(1));
        expect(el.querySelector('[data-mergify-stack-nav="prev"]')).toBeNull();
        expect(
            el.querySelector('[data-mergify-stack-nav="prev-empty"]'),
        ).not.toBeNull();
        expect(
            el.querySelector('[data-mergify-stack-nav="next"]'),
        ).not.toBeNull();
    });

    it("mutes next when at the tip of the stack", () => {
        const stack = stackOf(pull(1), pull(2, { is_current: true }));
        const el = buildStackNav(stack, ctx(2));
        expect(
            el.querySelector('[data-mergify-stack-nav="prev"]'),
        ).not.toBeNull();
        expect(el.querySelector('[data-mergify-stack-nav="next"]')).toBeNull();
        expect(
            el.querySelector('[data-mergify-stack-nav="next-empty"]'),
        ).not.toBeNull();
    });
});

describe("injectStackNav", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    function pull(number, opts = {}) {
        return {
            number,
            change_id: `i${number}`,
            head_sha: `h${number}`,
            base_branch: "main",
            dest_branch: "x",
            is_current: opts.is_current || false,
            title: opts.title || `Title ${number}`,
        };
    }

    function makeStickyHtml() {
        return '<section class="use-sticky-header-module__stickyHeader__abc PullRequestFilesToolbar-module__toolbar__def"></section>';
    }

    it("appends the nav as a child of the sticky toolbar and forces flex-wrap", () => {
        document.body.innerHTML = makeStickyHtml();
        const stack = {
            schema_version: 1,
            stack_id: "x",
            pulls: [pull(1, { is_current: true }), pull(2)],
        };
        injectStackNav(stack, { org: "o", repo: "r", number: 1 });
        const nav = document.querySelector("#mergify-stack-nav");
        expect(nav).not.toBeNull();
        const sticky = document.querySelector(
            '[class*="use-sticky-header-module__stickyHeader"]',
        );
        expect(nav.parentElement).toBe(sticky);
        expect(sticky.style.flexWrap).toBe("wrap");
    });

    it("ignores the stickyHeaderActivationThreshold sentinel", () => {
        // The threshold sentinel is a 1px marker that we must NOT inject into.
        document.body.innerHTML =
            '<div class="PullRequestFilesToolbar-module__stickyHeaderActivationThreshold__nWqbQ"></div>' +
            makeStickyHtml();
        const stack = {
            schema_version: 1,
            stack_id: "x",
            pulls: [pull(1, { is_current: true }), pull(2)],
        };
        injectStackNav(stack, { org: "o", repo: "r", number: 1 });
        const nav = document.querySelector("#mergify-stack-nav");
        expect(nav.parentElement.className).toMatch(
            /use-sticky-header-module__stickyHeader/,
        );
    });

    it("is idempotent — replaces existing nav when called again", () => {
        document.body.innerHTML = makeStickyHtml();
        const stack = {
            schema_version: 1,
            stack_id: "x",
            pulls: [pull(1, { is_current: true }), pull(2)],
        };
        injectStackNav(stack, { org: "o", repo: "r", number: 1 });
        injectStackNav(stack, { org: "o", repo: "r", number: 1 });
        expect(document.querySelectorAll("#mergify-stack-nav").length).toBe(1);
    });

    it("removes the nav when stackData becomes null", () => {
        document.body.innerHTML =
            '<section class="use-sticky-header-module__stickyHeader__abc">' +
            '<div id="mergify-stack-nav"></div>' +
            "</section>";
        injectStackNav(null, { org: "o", repo: "r", number: 1 });
        expect(document.querySelector("#mergify-stack-nav")).toBeNull();
    });

    it("no-ops when no sticky target is found", () => {
        document.body.innerHTML = "<div></div>";
        const stack = {
            schema_version: 1,
            stack_id: "x",
            pulls: [pull(1, { is_current: true }), pull(2)],
        };
        injectStackNav(stack, { org: "o", repo: "r", number: 1 });
        expect(document.querySelector("#mergify-stack-nav")).toBeNull();
    });
});
