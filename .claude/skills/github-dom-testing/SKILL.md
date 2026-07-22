---
name: github-dom-testing
description: >-
  Use when adding or modifying tests in this repo, adding a new GitHub DOM era
  or an A/B variant fixture, updating an era manifest, or deciding where a new
  test belongs (mechanism test vs DOM contract). Explains the two-layer test
  architecture: hand-written mechanism tests and the era-parameterized DOM
  contract suite over recorded GitHub pages. Triggers on: add a test, new
  fixture, new era, github_dom_*, manifest.json, githubDomContract, DOM
  drift, A/B variant, GHES coverage.
---

# GitHub DOM testing

This extension parses DOM that GitHub serves, and GitHub serves several DOMs
at once: A/B rollouts on github.com, older generations on GHES. The suite has
two layers with different jobs — put a new test in the right one.

| layer | file(s) | what it pins | DOM source |
| -- | -- | -- | -- |
| Mechanism tests | `src/__tests__/mergify.test.js`, `queue.test.js`, `mqPayload.test.js` | one function's logic, edge cases, precedence rules | minimal hand-written HTML snippets |
| DOM contract | `src/__tests__/githubDomContract.test.js` | every detector derives each era manifest's expectations from real captured pages | sanitized full-page fixtures in `src/__tests__/fixtures/github_dom_*/` |

Reference for the fixture layout and manifest schema:
`src/__tests__/fixtures/README.md`. Run with `npx jest` (contract only:
`npx jest githubDomContract`), lint with `npm run lint`.

## Adding a test for new behavior

1. Write mechanism tests next to the module's existing describe blocks, with
   the smallest hand-written DOM that exercises the logic. Follow the
   existing style (plain `document.body.innerHTML`, no helpers).
2. If the behavior reads GitHub's DOM (a new detector or selector), also add
   a contract dimension: a field in every era's `manifest.json` plus one
   assertion in `githubDomContract.test.js`. Fill each era's value from what
   the detector actually returns on that era's pages — the contract pins
   expected outcomes per era, not aspirations.

## Manifest semantics — pinned gaps

`state` is the PR's real state; every other manifest field is the expected
detector outcome on that page. When a DOM era lacks a signal (e.g. no
`span[data-status]` in `github_dom_2025_02`, no `.gh-header-meta` in
`github_dom_2026_07`), the manifest records the honest outcome (`null`,
`false`). Fixing the extension then flips manifest values — that one-line
diff is the fix's visible proof. Never "fix" a red contract by loosening the
assertion; either the manifest value is wrong (correct it to observed
reality) or the extension is (fix src, flip the manifest).

## Adding a new DOM era

1. Record and sanitize the pages with the internal `record-github-fixtures`
   skill (Mergifyio/skills) — captures need a logged-in session and MUST be
   sanitized before landing here; this repo is public. Never hand-edit a
   fixture's HTML; re-record instead.
2. Drop the directory as `src/__tests__/fixtures/github_dom_<suffix>/`
   (github.com date `github_dom_2026_07`, or GHES generation
   `github_dom_ghes_3_16`).
3. Write its `manifest.json`: copy the newest era's as a template, set each
   page's `path`/`state`, then reconcile the other fields against a test run
   — `npx jest githubDomContract` failures list exactly where your
   expectations and the DOM disagree. Investigate each mismatch before
   flipping a value: it is either your guess, DOM drift, or an extension bug
   (all three have happened).
4. The contract enrolls the era automatically (directory glob); a
   consistency test fails until manifest entries and `.html` files match
   exactly.
5. Document detector gaps the new era exposes in its manifest
   `description`, and keep old eras — GHES serves their DOM for years.

## Adding an A/B variant

A variant is not a new era. Record the affected page as an additional page
in the current era (e.g. `github_pr_opened_sidebar.html`) with its own
manifest entry — usually the same expectations with a different
`mergeBoxRowVariants`.
