// ==UserScript==
// @name         Mergify
// @namespace    http://tampermonkey.net/
// @version      2024-03-13
// @description  try to take over the world!
// @author       Mehdi Abaakouk<sileht@mergify.com>
// @match        https://github.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mergify.com
// @grant        none
// ==/UserScript==

const LOGO_SVG = `<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_11862_5683)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 25C19.4036 25 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 5.59644 25 12.5 25ZM6.33336 10.8363C5.62696 10.5675 5.12502 9.88399 5.12502 9.08325C5.12502 8.04772 5.96449 7.20825 7.00002 7.20825C7.937 7.20825 8.71346 7.89553 8.85276 8.79347C8.95713 8.71964 9.06732 8.65233 9.18336 8.59155C9.65003 8.33599 10.1778 8.20821 10.7667 8.20821C11.3223 8.20821 11.8278 8.33599 12.2834 8.59155C12.6651 8.7964 12.9806 9.07538 13.2297 9.42849C13.499 9.08483 13.828 8.8114 14.2167 8.60821C14.7056 8.34154 15.25 8.20821 15.85 8.20821C16.45 8.20821 16.9889 8.33599 17.4667 8.59155C17.9445 8.83599 18.3223 9.19154 18.6 9.65821C18.8778 10.1249 19.0167 10.6804 19.0167 11.3249V14.3979C19.4863 14.7387 19.7917 15.292 19.7917 15.9165C19.7917 16.9521 18.9523 17.7915 17.9167 17.7915C16.8812 17.7915 16.0417 16.9521 16.0417 15.9165C16.0417 15.2846 16.3543 14.7257 16.8334 14.386V11.6749C16.8334 11.2082 16.6834 10.8471 16.3834 10.5915C16.0945 10.3249 15.7334 10.1915 15.3 10.1915C15.0223 10.1915 14.7611 10.2527 14.5167 10.3749C14.2834 10.486 14.1 10.6527 13.9667 10.8749C13.8334 11.0971 13.7667 11.3638 13.7667 11.6749V14.398C14.2363 14.7387 14.5417 15.292 14.5417 15.9165C14.5417 16.9521 13.7022 17.7915 12.6667 17.7915C11.6311 17.7915 10.7917 16.9521 10.7917 15.9165C10.7917 15.2846 11.1043 14.7257 11.5834 14.386V11.6749C11.5834 11.2082 11.4334 10.8471 11.1334 10.5915C10.8445 10.3249 10.4834 10.1915 10.05 10.1915C9.76114 10.1915 9.50003 10.2527 9.2667 10.3749C9.03336 10.486 8.85003 10.6527 8.7167 10.8749C8.58336 11.0971 8.5167 11.3638 8.5167 11.6749V14.398C8.9863 14.7387 9.29169 15.292 9.29169 15.9165C9.29169 16.9521 8.45222 17.7915 7.41669 17.7915C6.38115 17.7915 5.54169 16.9521 5.54169 15.9165C5.54169 15.2846 5.85432 14.7257 6.33336 14.386V10.8363Z" fill="white"/>
<path d="M7.04167 10.1249C7.61696 10.1249 8.08333 9.65855 8.08333 9.08325C8.08333 8.50796 7.61696 8.04158 7.04167 8.04158C6.46637 8.04158 6 8.50796 6 9.08325C6 9.65855 6.46637 10.1249 7.04167 10.1249Z" fill="white"/>
<path d="M7.45833 16.9582C8.03363 16.9582 8.5 16.4918 8.5 15.9165C8.5 15.3412 8.03363 14.8749 7.45833 14.8749C6.88304 14.8749 6.41667 15.3412 6.41667 15.9165C6.41667 16.4918 6.88304 16.9582 7.45833 16.9582Z" fill="white"/>
<path d="M17.9584 16.9582C18.5337 16.9582 19 16.4918 19 15.9165C19 15.3412 18.5337 14.8749 17.9584 14.8749C17.3831 14.8749 16.9167 15.3412 16.9167 15.9165C16.9167 16.4918 17.3831 16.9582 17.9584 16.9582Z" fill="white"/>
<path d="M13.75 15.9165C13.75 16.4918 13.2836 16.9582 12.7083 16.9582C12.133 16.9582 11.6667 16.4918 11.6667 15.9165C11.6667 15.3412 12.133 14.8749 12.7083 14.8749C13.2836 14.8749 13.75 15.3412 13.75 15.9165Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_11862_5683">
<path d="M0 12.5C0 8.30236 0 6.20354 0.768086 4.57956C1.55942 2.90642 2.90642 1.55942 4.57956 0.768086C6.20354 0 8.30236 0 12.5 0V0C16.6976 0 18.7965 0 20.4204 0.768086C22.0936 1.55942 23.4406 2.90642 24.2319 4.57956C25 6.20354 25 8.30236 25 12.5V12.5C25 16.6976 25 18.7965 24.2319 20.4204C23.4406 22.0936 22.0936 23.4406 20.4204 24.2319C18.7965 25 16.6976 25 12.5 25V25C8.30236 25 6.20354 25 4.57956 24.2319C2.90642 23.4406 1.55942 22.0936 0.768086 20.4204C0 18.7965 0 16.6976 0 12.5V12.5Z" fill="white"/>
</clipPath>
</defs>
</svg>`

function postCommand(command){
    var input = document.querySelector("#new_comment_field")
    input.removeAttribute('disabled')
    input.value = "@mergify " + command
    var button = Array.from(document.querySelectorAll("#partial-new-comment-form-actions button")).find(
        el => el.textContent.trim() === 'Comment'
    )
    button.removeAttribute('disabled')
    button.click()
}

function buildBtn(command) {
    var element = document.createElement("button");
    var label = command.charAt(0).toUpperCase() + command.slice(1);
    element.onclick = () => postCommand(command)
    element.className ="btn-sm btn"
    element.style.marginLeft = "10px"
    element.innerHTML = '<span class="Details-content--shown">' + label + '</span></span>'
    return element
}

function getPullRequestData() {
    var url = new URL(document.location.href)
    var parts = url.pathname.split("/")
    return {
        org: parts[1],
        repo: parts[2],
        pull: parts[4]
    }
}

function getEventLogLink() {
    var data = getPullRequestData()
    return `https://dashboard.mergify.com/event-logs?login=${data.org}&repository=${data.repo}&pullRequestNumber=${data.pull}`
}

function getMergeQueueLink() {
    var data = getPullRequestData()
    return `https://dashboard.mergify.com/queues?login=${data.org}&repository=${data.repo}&branch=main`
}

function buildMergifySectionForClassicMergeBox () {
    var icon = document.createElement("div");
    icon.className = "branch-action-item-icon"
    icon.innerHTML = LOGO_SVG
    var title = document.createElement("div")
    title.innerHTML = '<h3 class="status-heading h4">Mergify</h3>'

    var headline = document.createElement("span")
    headline.className = "status-meta"
    headline.innerHTML = `
          This pull request is managed by Mergify.<br/>
          <a class="Link--inTextBlock btn-link" href="${getMergeQueueLink()}" target="_blank">View merge queue</a> —
          <a class="Link--inTextBlock btn-link" href="${getEventLogLink()}" target="_blank">View event logs of the pull request.</a>
    `;

    var btnbox = document.createElement("div");
    btnbox.style.float = "right"
    btnbox.appendChild(buildBtn("queue"))
    btnbox.appendChild(buildBtn("requeue"))
    btnbox.appendChild(buildBtn("dequeue"))
    btnbox.appendChild(buildBtn("refresh"))
    btnbox.appendChild(buildBtn("rebase"))
    btnbox.appendChild(buildBtn("update"))

    var element = document.createElement("div");
    element.appendChild(icon)
    element.appendChild(btnbox)
    element.appendChild(title)
    element.appendChild(headline)

    var details = document.createElement("div");
    details.className = "branch-action-item js-details-container Details"
    details.id = "mergify"
    details.appendChild(element)
    return details;
}

function buildLogoContainer() {
    // <div class="mr-2 flex-shrink-0">
    var container = document.createElement("div")
    container.className = "mr-2 flex-shrink-0"

    // <div overflow="hidden" size="32" class="Box-sc-g0xbh4-0 iAmUFw">
    var container2 = document.createElement("div")
    container2.setAttribute("overflow", "hidden")
    container2.setAttribute("size", "32")
    container2.className = "Box-sc-g0xbh4-0 iAmUFw"
    container.appendChild(container2)

    // <div display="flex" size="32" class="Box-sc-g0xbh4-0 jneZjk">
    var container3 = document.createElement("div")
    container3.setAttribute("display", "flex")
    container3.setAttribute("size", "32")
    container3.className = "Box-sc-g0xbh4-0 jneZjk"
    container3.innerHTML = LOGO_SVG
    container2.appendChild(container3)
    
    return container
}

function buildTitleContainer () {
    var container = document.createElement("div")
    container.className = "flex-1"

    var title = document.createElement("h3")
    title.className = "Box-sc-g0xbh4-0 isSOdJ prc-Heading-Heading-6CmGO"
    title.textContent = "Mergify"
    container.appendChild(title)

    var subtitle = document.createElement("p")
    subtitle.className = "fgColor-muted mb-0"
    subtitle.textContent = "This pull request is managed by Mergify."
    container.appendChild(subtitle)

    var mergeQueueLink = document.createElement("p")
    mergeQueueLink.className = "fgColor-muted mb-0"
    mergeQueueLink.innerHTML = `<a class="Link--inTextBlock btn-link" href="${getMergeQueueLink()}" target="_blank">View merge queue</a>`
    container.appendChild(mergeQueueLink)

    var eventLogLink = document.createElement("p")
    eventLogLink.className = "fgColor-muted mb-0"
    eventLogLink.innerHTML = `<a class="Link--inTextBlock btn-link" href="${getEventLogLink()}" target="_blank">View event logs of the pull request</a>`
    container.appendChild(eventLogLink)

    return container
}

function buildButton(command) {
    var container = document.createElement("div")
    container.className = "Box-sc-g0xbh4-0"

    var button = document.createElement("button")
    button.setAttribute("aria-disabled", "false")
    button.setAttribute("type", "button")
    button.className = "prc-Button-ButtonBase-c50BI flex-1"
    button.setAttribute("data-loading", "false")
    button.setAttribute("data-no-visuals", "true")
    button.setAttribute("data-size", "small")
    button.setAttribute("data-variant", "default")
    button.setAttribute("aria-describedby", ":r1o:-loading-announcement")
    button.onclick = () => postCommand(command)
    var label = command.charAt(0).toUpperCase() + command.slice(1)
    button.innerHTML = `<span data-component="buttonContent" data-align="center" class="prc-Button-ButtonContent-HKbr-">
    <span data-component="text" class="prc-Button-Label-pTQ3x">${label}</span>
    </span>`
    container.appendChild(button)

    return container
}

function buildTitleAndButtonsContainer() {
    var container = document.createElement("div")
    container.className = "d-flex flex-1 flex-column flex-sm-row gap-2"

    container.appendChild(buildTitleContainer())
    container.appendChild(buildButton("queue"))
    container.appendChild(buildButton("requeue"))
    container.appendChild(buildButton("dequeue"))
    container.appendChild(buildButton("refresh"))
    container.appendChild(buildButton("rebase"))
    container.appendChild(buildButton("update"))

    return container
}

function buildMergifySectionForNewMergeBox () {
    var section = document.createElement("section")
    section.className = "border-bottom borderColor-muted"
    section.id = "mergify"
    section.setAttribute("aria-label", "Mergify")

    var container1 = document.createElement("div")
    container1.className = "d-flex flex-column width-full overflow-hidden"
    section.appendChild(container1)

    container2 = document.createElement("div")
    container2.className = "MergeBoxSectionHeader-module__wrapper--f99Ts flex-column flex-sm-row flex-items-center flex-sm-items-start flex-justify-between"
    container1.appendChild(container2)

    var container3 = document.createElement("div")
    container3.className = "d-flex width-full"
    container2.appendChild(container3)

    container3.appendChild(buildLogoContainer())
    container3.appendChild(buildTitleAndButtonsContainer())

    return section
}


function isGitHubPullRequestPage() {
    var url = new URL(document.location.href);
    var parts = url.pathname.split("/");
    return parts.length >= 5 && parts[3] === 'pull';
}


function findNewMergeBox() {
    // NOTE(charly): we look for the new merge box by looking for one of the
    // following sections: Conflicts, Reviews, Checks. The new merge box hasn't
    // a distinct class or id.
    var conflictSection = document.querySelector("section[aria-label=Conflicts")
    if (conflictSection) {
        return conflictSection.parentElement
    }
    var reviewSection = document.querySelector("section[aria-label=Reviews")
    if (reviewSection) {
        return reviewSection.parentElement
    }
    var checksSection = document.querySelector("section[aria-label=Checks")
    if (checksSection) {
        return checksSection.parentElement
    }
}


function tryInject() {
    if (!isGitHubPullRequestPage()) {
        return
    }

    if (!isMergifyEnabledOnTheRepo()) {
        return
    }
    
    var isMergifySectionInjected = document.querySelector("#mergify")
    if (isMergifySectionInjected) {
        return
    }
    
    var detailSection = document.querySelector(".mergeability-details")
    if (detailSection) {
        // Classic merge box
        detailSection.insertBefore(buildMergifySectionForClassicMergeBox(), detailSection.firstChild)
    } else {
        // New merge box
        var detailSection = findNewMergeBox()
        if (detailSection) {
            detailSection.insertBefore(buildMergifySectionForNewMergeBox(), detailSection.firstChild)
        }
    }
}

function isMergifyEnabledOnTheRepo() {
    const mergifyCache = new MergifyCache();
    const {org, repo} = getPullRequestData();
    
    const appIconUrl = "https://avatars.githubusercontent.com/in/10562"
    var enabled = document.querySelector(`img[src^="${appIconUrl}?"][alt="Summary"], img[src^="${appIconUrl}?"][alt="Mergify Merge Protections"], a[href="/apps/mergify"] img[src^="${appIconUrl}?"]`)
    
    if (enabled) {
        mergifyCache.update(org, repo, true);
        return true;
    }
    return mergifyCache.get(org, repo);
}


class MergifyCache {
    /**
     * @param {number} expirationMs - Cache expiration time in milliseconds (defaults to 1 day)
     */
    constructor(expirationMs = 24 * 60 * 60 * 1000) {
        this.CACHE_KEY_PREFIX = 'mergify_browser_extension';
        this.expirationMs = expirationMs;
    }

    key(owner, repo) {
        return `${this.CACHE_KEY_PREFIX}_${owner}_${repo}`;
    }

    update(owner, repo, isMergifyEnabled) {
        const key = this.key(owner, repo);
        const data = {
            isMergifyEnabled,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to store Mergify status in cache:', error);
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
            console.error('Failed to retrieve Mergify status from cache:', error);
            return null;
        }
    }
}


(function() {
    'use strict';
    tryInject();
    const observer = new MutationObserver(mutations => {
        tryInject();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}());

