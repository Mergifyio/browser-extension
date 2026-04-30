import {
    formatLocalTime,
    isMergifyBotComment,
    MERGIFY_TIMESTAMP_REGEX,
    TIMESTAMP_CONVERTED_ATTR,
} from "./dom.js";

// Replaces UTC timestamps in Mergify comments with local times.
export function convertMergifyTimestamps() {
    const codeElements = document.querySelectorAll(
        `.comment-body code:not([${TIMESTAMP_CONVERTED_ATTR}])`,
    );

    for (const code of codeElements) {
        const match = code.textContent.match(MERGIFY_TIMESTAMP_REGEX);
        if (!match) continue;

        const container = code.closest(
            ".TimelineItem, .js-comment-container, .timeline-comment",
        );
        if (!container || !isMergifyBotComment(container)) continue;

        const date = new Date(`${match[1]}T${match[2]}:00Z`);
        if (Number.isNaN(date.getTime())) continue;

        const originalUtc = code.textContent;
        code.textContent = formatLocalTime(date);
        code.setAttribute(TIMESTAMP_CONVERTED_ATTR, "true");
        code.setAttribute("title", originalUtc);
        code.style.cursor = "help";
    }
}
