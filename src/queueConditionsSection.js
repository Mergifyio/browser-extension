// Mergify's row of GitHub's merge box, drawn like the rows GitHub puts there
// itself ("No conflicts with base branch", "Review required"): a 32px status
// circle, a bold title, one line under it, and for a row with something to
// show, GitHub's chevron to unfold it.
//
// Before the queue it says whether the pull request can enter, from the
// merge queue check's conditions.
//
// GitHub's own classes for that row are CSS modules hashed per deploy, so the
// layout is mirrored with inline styles over Primer's stable utility classes
// and colour variables.

export const CONDITIONS_SECTION_ATTR = "data-mergify-conditions-section";

const SVG_NS = "http://www.w3.org/2000/svg";

// Octicons, 16px (@primer/octicons 19): `check` as GitHub draws it in its
// rows' circles, `clock` for the wait, `chevron-right` for the fold.
const ICON_PATHS = {
    check: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z",
    clock: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z",
    chevron:
        "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z",
};

const STATES = {
    met: {
        title: "Queue conditions met",
        circle: "bgColor-success-emphasis",
        fill: "var(--bgColor-success-emphasis, #1f883d)",
        icon: "check",
    },
    waiting: {
        title: "Waiting for queue conditions",
        circle: "bgColor-neutral-emphasis",
        fill: "var(--bgColor-neutral-emphasis, #59636e)",
        icon: "clock",
    },
};

// What the row shows for a model: { conditions }. Met when the check says the
// queue is ready; waiting otherwise, unfolding to the check page.
function _view(model) {
    if (model.conditions.met) {
        return {
            state: "met",
            label: "Queue conditions",
            summary: ["Ready to enter the merge queue"],
            body: null,
        };
    }
    return {
        state: "waiting",
        label: "Queue conditions",
        summary: ["Some queue conditions are unmet"],
        body: () => _detailsOnly(model.conditions.runUrl),
    };
}
function _octicon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `octicon octicon-${name}`);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ICON_PATHS[name]);
    svg.appendChild(path);
    return svg;
}

// expanded: the fold state to draw; onToggle(expanded) is called on a click.
export function buildQueueSection(
    model,
    { expanded = false, onToggle = () => {} } = {},
) {
    const view = model ? _view(model) : null;
    if (!view) return null;
    const look = STATES[view.state];
    const foldable = Boolean(view.body);

    const section = document.createElement("section");
    section.setAttribute(CONDITIONS_SECTION_ATTR, view.state);
    section.setAttribute("aria-label", view.label);
    section.className = "border-bottom color-border-subtle";
    // The classes are GitHub's; a merged pull request's box does not style
    // them, so the rule is drawn here too.
    section.style.borderBottom =
        "1px solid var(--borderColor-muted, #d1d9e0b3)";

    const header = document.createElement("div");
    header.style.cssText =
        "position:relative;display:flex;gap:8px;padding:16px;";

    const layout = document.createElement("div");
    layout.className = "d-flex width-full";
    layout.style.minWidth = "0";

    const iconColumn = document.createElement("div");
    iconColumn.className = "mr-2 flex-shrink-0";
    const iconClip = document.createElement("div");
    iconClip.style.cssText =
        "width:32px;height:32px;border-radius:50%;overflow:hidden;";
    const circle = document.createElement("div");
    circle.className = `${look.circle} fgColor-onEmphasis`;
    // The class is GitHub's; the inline colour covers the pages that do not
    // load that Primer utility (the neutral one is missing on PR pages).
    circle.style.cssText = `display:flex;width:32px;height:32px;align-items:center;justify-content:center;background-color:${look.fill};color:var(--fgColor-onEmphasis, #fff);`;
    circle.appendChild(_octicon(look.icon));
    iconClip.appendChild(circle);
    iconColumn.appendChild(iconClip);

    const text = document.createElement("div");
    text.style.cssText = "flex:1;min-width:0;";
    const title = document.createElement("h3");
    title.style.cssText =
        "margin:0;font-family:var(--fontStack-sansSerifDisplay, inherit);font-size:16px;font-weight:600;line-height:24px;display:flex;align-items:center;gap:8px;";
    title.textContent = look.title;
    const subtitle = document.createElement("p");
    subtitle.className = "fgColor-muted mb-0";
    subtitle.setAttribute("data-mergify-conditions-summary", "");
    subtitle.style.cssText =
        "font-size:14px;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    subtitle.textContent = view.summary.filter(Boolean).join(" · ");
    subtitle.title = subtitle.textContent;
    text.append(title, subtitle);

    layout.append(iconColumn, text);
    header.appendChild(layout);
    section.appendChild(header);
    if (!foldable) return section;

    const body = document.createElement("div");
    body.setAttribute("data-mergify-conditions-body", "");
    // Under the title, past the 32px circle and its 8px gap.
    // GitHub's own unfolded rows sit on a muted band under a rule.
    body.style.cssText =
        "padding:8px 16px 12px 56px;min-width:0;background:var(--bgColor-muted, #f6f8fa);border-top:1px solid var(--borderColor-muted, #d1d9e0b3);";
    body.appendChild(view.body());
    body.hidden = !expanded;

    const chevronColumn = document.createElement("div");
    chevronColumn.className = "fgColor-muted pr-2 pt-2";
    const chevron = document.createElement("div");
    chevron.style.cssText = `width:16px;height:16px;transition:transform .2s cubic-bezier(.6,0,.2,1);${expanded ? "transform:rotate(90deg);" : ""}`;
    chevron.appendChild(_octicon("chevron"));
    chevronColumn.appendChild(chevron);

    // GitHub covers the whole header with a transparent button.
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-mergify-conditions-toggle", "");
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute(
        "aria-label",
        `${expanded ? "Collapse" : "Expand"} ${view.label.toLowerCase()}`,
    );
    toggle.style.cssText =
        "position:absolute;inset:0;z-index:1;width:100%;opacity:0;cursor:pointer;border:0;padding:0;";
    toggle.onclick = () => {
        const next = body.hidden;
        body.hidden = !next;
        toggle.setAttribute("aria-expanded", String(next));
        toggle.setAttribute(
            "aria-label",
            `${next ? "Collapse" : "Expand"} ${view.label.toLowerCase()}`,
        );
        chevron.style.transform = next ? "rotate(90deg)" : "";
        onToggle(next);
    };

    header.append(toggle, chevronColumn);
    section.appendChild(body);
    return section;
}

// What the row unfolds to: the check page, which lists the conditions.
function _detailsOnly(runUrl) {
    const line = document.createElement("div");
    line.setAttribute("data-mergify-conditions-tree", "");
    line.style.cssText = "font-size:14px;line-height:20px;";
    if (runUrl) {
        const link = document.createElement("a");
        link.href = runUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.color = "var(--fgColor-accent, #0969da)";
        link.textContent = "View details";
        line.appendChild(link);
    }
    return line;
}

// Where the row goes in the merge box: right after GitHub's checks row, so it
// reads as the next thing standing between the pull request and the queue;
// without one (a merged pull request), after GitHub's own rows, before
// "Merging is blocked" or the band of merge buttons and Mergify's actions.
export function placeQueueConditionsSection(container, section) {
    const rows = Array.from(container.children);
    const checks = rows.find(
        (el) =>
            el.getAttribute("aria-label") === "Checks" ||
            el.querySelector(':scope > section[aria-label="Checks"]'),
    );
    let before = checks ? checks.nextElementSibling : null;
    if (!checks) {
        before =
            rows.find(
                (el) =>
                    el !== section &&
                    (el.getAttribute("aria-label") === "Merging is blocked" ||
                        el.classList.contains("bgColor-muted") ||
                        el.hasAttribute("data-mergify-merge-box-row")),
            ) ?? null;
    }
    if (before === section) return;
    if (
        section.parentElement === container &&
        section.nextElementSibling === before
    )
        return;
    container.insertBefore(section, before);
}
