# Test fixtures

The extension parses DOM that GitHub serves — and GitHub serves several DOMs
at once: A/B rollouts on github.com and older generations on GitHub Enterprise
Server. Fixtures are therefore organized by **DOM era**, and the contract
suite (`../githubDomContract.test.js`) runs every detector against every page
of every era.

## Layout

```
fixtures/
  github_pr_mergify_timestamp.html   # hand-made timeline fragment
  searchConfigFound.html             # /search results page (config lookup)
  searchConfigNotFound.html
  github_dom_2025_02/                # legacy DOM (closest stand-in for GHES)
    manifest.json
    github_pr_opened.html
    ...
  github_dom_2026_07/                # current github.com React DOM
    manifest.json
    github_pr_opened.html
    ...
```

Root-level files are fragments or non-PR pages loaded with
`loadFixture(name)` / `injectFixtureInDOM(name)`. Era directories hold
sanitized full-page PR captures loaded with
`injectEraFixtureInDOM(era, page)`.

## Eras

An era is a directory named `github_dom_<suffix>` — a github.com capture date
(`github_dom_2025_02`) or a GHES generation (`github_dom_ghes_3_16`). Adding a
directory with a `manifest.json` enrolls it in the contract suite with no
test-code changes; the suite also fails if the manifest and the `.html` files
in the directory don't match exactly.

Keep old eras: GHES deployments serve GitHub's older DOM for years, so an era
is only removed when no supported GHES version serves that DOM generation
anymore. An A/B variant is not a new era — record the affected page as an
additional page in the current era (e.g. `github_pr_opened_sidebar.html`) with
its own manifest entry.

## manifest.json

Per-era metadata plus per-page expectations. `state` is the PR's real state;
the other fields are **what the extension's detectors must derive from this
page's DOM**. Where a detector cannot see a truth on some era (a signal the
DOM no longer carries), the manifest pins that honestly — fixing the extension
then flips the manifest value, a visible one-line diff. Known pinned gaps are
listed in each era's `description`.

| field | meaning |
| -- | -- |
| `path` | PR path the page was captured from; set as the test URL |
| `state` | the PR's real state: `open` \| `draft` \| `merged` \| `closed` |
| `mergifyDetectableFromPage` | page alone proves Mergify is on the repo (app avatar); false on quiet pages of enabled repos where checks are collapsed |
| `authoredByMergify` | header-scoped Mergify-authorship detection outcome |
| `mergedByMergify` | merged-commit timeline entry authored by Mergify |
| `queued` | a Mergify Merge Queue check reports the PR as queued |
| `baseRef` | base branch readable from the page, or `null` |
| `mergeBoxRowVariants` | `data-mergify-merge-box-row` values the injector must create; `[]` when the page has no anchor |
| `dataStatusPillState` | state readable from `span[data-status]` alone; `null` on eras that predate that attribute |

## Recording a new era

Captures must be logged in (GitHub renders the merge box only for a viewer
with write access), which embeds the capturing account into the page — so
**every fixture is sanitized before it lands in this public repo**, and new
captures come from synthetic PRs on sandbox repos, not from live PRs. The
capture + sanitization pipeline lives in the internal
`record-github-fixtures` skill (Mergifyio/skills); it drops a ready era
directory here, after which only the manifest's ground truth needs writing.
