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

function buildDetailItem () {
    var icon = document.createElement("div");
    icon.className = "branch-action-item-icon"
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="30px" height="30px" viewBox="0 0 210.000000 210.000000" preserveAspectRatio="xMidYMid meet" style="zoom: 1;">
<circle id="white-circle-bg" cy="105px" fill="#ffffff" r="70px" cx="105px" transform="" style="vertical-align: middle; display:inline-block">
</circle>
<g transform="translate(0.000000,210.000000) scale(0.100000,-0.100000)" fill="#28ABE1" stroke="none">
<path d="M898,2090 c-229,-37 -425,-136 -588,-300 c-141,-140 -234,-305 -283,-499 c-30,-123 -30,-359 0,-482 c49,-194 142,-359 283,-499 c140,-141 305,-234 499,-283 c123,-30 359,-30 482,0 c194,49 359,142 499,283 c141,140 234,305 283,499 c30,123 30,359 0,482 c-49,194 -142,359 -283,499 c-139,140 -306,235 -494,281 c-93,23 -309,33 -398,19  z m-160,-594 c15,-8 35,-23 45,-34 c17,-19 21,-19 65,-5 c57,18 132,11 177,-16 c33,-19 34,-19 96,0 c172,54 294,24 352,-84 c20,-39 22,-57 25,-256 l3,-213 l34,-34 c60,-60 67,-136 18,-202 c-89,-120 -273,-59 -273,92 c0,51 27,109 56,120 c13,5 15,34 12,212 l-3,206 l-28,24 c-32,27 -84,31 -152,11 l-39,-12 l3,-215 c3,-209 3,-214 26,-232 c58,-45 67,-150 18,-209 c-94,-112 -273,-54 -273,88 c0,53 11,83 44,113 l26,25 l0,208 c0,194 -1,208 -20,227 c-20,20 -63,26 -106,14 c-11,-3 -29,-21 -39,-40 c-10,-20 -27,-40 -37,-45 c-16,-9 -18,-26 -18,-190 c0,-149 2,-181 15,-185 c28,-11 55,-69 55,-120 c0,-151 -184,-212 -273,-92 c-49,66 -42,142 18,203 l35,34 l0,161 l0,161 l-35,34 c-77,77 -64,190 29,246 c37,22 106,25 144,5  z ">
</path>
<path d="M610,1414.5 c-59,-59 -26,-152 54,-152 c48,0 65,8 81,41 c33,62 2,125 -67,136 c-32,5 -41,1 -68,-25  z ">
</path>
<path d="M605,805 c-36,-36 -34,-88 5,-127 c27,-26 36,-30 68,-25 c43,7 82,46 82,83 c0,32 -25,80 -45,88 c-37,14 -86,6 -110,-19  z ">
</path>
<path d="M986 799 c-49 -58 -20 -134 56 -146 32 -5 41 -1 68 25 61 61 26 152 -59 152 -32 0 -44 -6 -65 -31z">
</path>
<path d="M1382 823 c-18 -7 -42 -57 -42 -87 0 -37 39 -76 82 -83 32 -5 41 -1 68 25 60 61 26 153 -57 151 -21 0 -44 -3 -51 -6z">
</path>
</g>
</svg>`
    var title = document.createElement("div")
    title.innerHTML = '<h3 class="status-heading h4">Mergify</h3>'



    const url = new URL(document.location.href)
    var parts = url.pathname.split("/")
    var org = parts[1]
    var repo = parts[2]
    var pull = parts[4]
    var eventlogLink = `https://dashboard.mergify.com/github/${org}/repo/${repo}/event-logs?&pullRequestNumber=${pull}`
    var mergequeueLink = `https://dashboard.mergify.com/github/${org}/repo/${repo}/queues?branch=main`

    var headline = document.createElement("span")
    headline.className = "status-meta"
    headline.innerHTML = `
          This pull request is managed by Mergify.<br/>
          <a class="Link--inTextBlock btn-link" href="${mergequeueLink}" target="_blank">View merge queue</a> —
          <a class="Link--inTextBlock btn-link" href="${eventlogLink}" target="_blank">View event logs of the pull request.</a>
    `;

    var btnbox = document.createElement("div");
    btnbox.style.float = "right"
    btnbox.appendChild(buildBtn("queue"))
    btnbox.appendChild(buildBtn("requeue"))
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


function tryInject() {
    var MergifyEnabledOnTheRepo = document.querySelector('a[href="/apps/mergify"]')
    var mergify = document.querySelector("#mergify")
    var details = document.querySelector(".mergeability-details")
    if (MergifyEnabledOnTheRepo && details && !mergify) {
        details.insertBefore(buildDetailItem(), details.firstChild)
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
