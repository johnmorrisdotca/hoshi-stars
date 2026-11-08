# Agents: start here

<!--
Template: kazoku-ui templates/AGENTS.md. Copy it to AGENTS.md at the repo root and fill in the Facts table below the marker.
Everything above the marker is the same in every package repo: change it here, then copy it over, never by hand in one repo.
Everything below the marker belongs to the repo. Public repo: no private hosts, addresses, home paths, logins or keys.
-->

This repo is one of the family of John Morris's npm packages. The rules every package repo shares are below; what differs is in the **Facts** table under the marker.

## Read first

1. spx-stats `docs/package-work.md` (https://github.com/spxis/spx-stats/blob/main/docs/package-work.md), and the section "Who may change what" in spx-stats `AGENTS.md`. They hold the boards, filing, checks, release, hand-off and reporting rules. If your session has an spx-stats checkout, `git pull` it first.
2. This repo's `CONTRIBUTING.md` and README, for the rules and commands of the code itself.
3. The Facts table below: your board, ports, checks, release path and hand-off project.

## Work

- **Board.** Every ticket for this repo is on the board named in Facts, titled `<title prefix>: ...` with `--area <title prefix>`. From the spx-stats checkout's `web/` directory: `pnpm task --board <board> list`, then `claim <id> "<who>"` with the whole id before you start. Read the ticket's full detail first. Anything you find outside your ticket becomes a new ticket; say so in your report. Never run `done`: the coordinating session closes tickets.
- **A gap in a shared part** (the view controls, theme switch, language picker, address state, save-as-image) is a `kazoku-ui:` ticket on the `kazoku-ui` board, not a copy or a workaround here.
- **One agent per repo**, in a new git worktree from `origin/main`. Never work in the main checkout or in another agent's worktree.
- **The must-have list.** A package is not released without its demo on Pages, an embed page, a documentation site in English and Japanese, the family files and tested usage examples (spx-stats `docs/package-work.md`, "The must-have list"; kazoku-ui `docs/package-standard.md`). `scripts/check-standard.mjs`, copied unchanged from kazoku-ui `templates/check-standard.mjs`, fails `pnpm check` when one is missing.
- **Ports.** Only the block in Facts. Check `lsof -iTCP:<port> -sTCP:LISTEN` first, stop only your own process by its PID, never `pkill`.
- **Commits.** As John Morris <john@johnmorris.ca>, Conventional Commits, subject 50 characters or less, no AI attribution, files added by name (never `git add -A`). Push fast-forward to `main` after `git fetch` and a rebase.
- **Live 3D (WebGL) needs a freeze test and software drawing.** A package with WebGL has `e2e/freeze.demo.*` and `pnpm test:freeze` (one frame at a time, nothing drawn at rest or out of sight, live contexts and GPU objects flat, canvas within 6 million pixels and 4096 a side), its `release.yml` passes `freeze-command: pnpm test:freeze` to the shared release, and every Chromium project in `playwright.config` draws in software (`SOFTWARE_GL_ARGS` from `@johnmorrisdotca/kazoku-ui/testing`), never on the Mac's graphics card. One headless browser at a time, closed when finished. Details: spx-stats `docs/package-work.md`, "No 3D release without a freeze test".
- **No long pages of fold-open sections.** A stack or loop of `<details>` or accordions that a reader scrolls through to find things is not allowed in a demo or site. Put choices in clicks in a row (kind, then family, then model), tabs, a grid or a search, with the chosen thing and its options on one screen. One small "More options" fold, or one "The call that draws it" fold beside its own demo, is fine. Details: spx-stats `docs/package-work.md`, "No long pages of fold-open sections".
- **Never.** GitHub issues, pull requests, discussions or comments; a token, key or private address in any file, commit or ticket; John's SPX, SPXN or SPXIS marks in an MIT package; anything that bills; a new package name, first publish, major version, deprecation or licence change without John's yes.
- **Japanese.** Whatever you write for John, give the English beside it. A docs page is in one language.

## Checks, release, hand-off

- **Before every push** run the checks in Facts, all of what a release runs (`pnpm check`, the browser tests, `pnpm test:usage`, and `pnpm test:freeze` for live 3D), never a subset. Green locally, then green in CI after the push (`gh run watch`).
- **Main stays green.** Whoever turns `main` red fixes it or reverts within the hour and says so (`coord.py log --kind note`). A flaky test gets a ticket at once and is fixed, never run again until it passes. A change to a shared file (the family template, `docs-site.mjs`, `check-standard.mjs`, a workflow) is tried on a branch of every repo and green in each CI before it goes to any `main`. machine1 checks every `main` once a day and lists the red ones with their owner. Details: spx-stats `docs/package-work.md`, "Main stays green".
- **Release.** Make a release commit (bump `package.json`, move the CHANGELOG's Unreleased block under the version), push it, wait for CI. **Do not tag and do not publish.** John runs the Release workflow (Actions → Release → Run workflow, from `main`). It checks the tag against `package.json`, runs the repo's check script, skips a version already on npm, tags `v<version>`, and publishes by trusted publishing. The repo's `release.yml` should call kazoku-ui's `reusable-release.yml` (kazoku-ui `docs/release-workflow.md`); the trusted-publisher entry on npmjs.com names `release.yml`.
- **Hand-off** for every finished ticket: write `<ticket-id>.json` and run `SPX_HANDOFF_PROJECT=<hand-off project> python3 -I scripts/handoff/handoff.py check|write <file>` from the spx-stats checkout (the variable on the same command line; the id is the ticket's whole id). Read the replies at the start and before you finish. Then release your hold: `pnpm task --board <board> release <id> --by "<who>"`.
- **Report** in under 12 lines, first line `<your name>, ticket <id> (<title>)` (`subagent of <name>` for a subagent): what changed, shas, CI, anything John must decide, new tickets, and last `HAND-OFF WRITTEN: <path>`. If you stop for any reason, say so at once.

<!-- repo-specific: everything below this line belongs to this repo. A template update never touches it. -->

## Facts

| | |
|---|---|
| Package | `@johnmorrisdotca/hoshi-stars` |
| Repo | `johnmorrisdotca/hoshi-stars` |
| Board | `modules` |
| Title prefix and `--area` | `hoshi-stars` |
| Ports | 8500 to 8599: 8500 the demo and dev, 8501 the tests, 8502 the picture scripts, 8503 and up anything else |
| Checks before a push | `pnpm check` (the demo, usage and docs checks join the list as those parts are built) |
| Release | `release.yml` → `reusable-release.yml`; trusted publisher entry: `release.yml` |
| Hand-off project | `hoshi-stars` |

## This repo

The stars: the 5,080 of the Yale Bright Star Catalogue to visual magnitude 6.0 today; constellations, deep-sky objects, the Milky Way and a star-chart function next, each its own import so a page pays only for what it uses. The data is in tiers and each tier's licence is stated in `NOTICE.md`.

- **Data licences are the hard rule.** Only data with a clear licence that an MIT package can pass on goes in: Yale with credit (informal public domain), facts typed from published lists, our own figures. NOT in this package: ESA's Hipparcos, Tycho and Gaia (CC BY-NC 3.0 IGO, non-commercial), HYG, AT-HYG and OpenNGC (CC BY-SA), Stellarium's files (GPL), d3-celestial's data (licence unstated). Fainter-than-6.0 stars are a bring-your-own-data script until a clear-licence catalogue is found. Read a licence text before adding a source; write the sentence and the date in `NOTICE.md`.
- **Draw from numbers; copy no artwork, text or code.** Wikipedia text is CC BY-SA: do not copy it.
- **This package never imports wakusei-planets.** The dependency runs the other way: wakusei-planets' `/stars` will re-export this one. A planet on a star chart arrives through an optional peer, never a dependency.
- **The core is pure:** no DOM, no clock reads, no state beyond the parsed table. Every export has TSDoc with an `@example`.
