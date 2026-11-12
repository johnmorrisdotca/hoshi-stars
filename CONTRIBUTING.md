# Contributing

Thank you for helping. Bug reports and ideas go in the [issues](https://github.com/johnmorrisdotca/hoshi-stars/issues).

## The rules

- **No runtime dependencies except kazoku-ui, for the element.** The package is plain TypeScript. `@johnmorrisdotca/kazoku-ui` (the family's view controls) is its one dependency, and only `/chart/element` and `/chart/define` import it: `chartSvg` and every other entry load nothing of it.
- **The core is pure.** Every function returns a new value; nothing reads the clock, uses randomness or does I/O. A moment is an explicit argument.
- **Data licences.** Only data a MIT package can pass on goes in. `NOTICE.md` names every source with the sentence relied on and the date read. ESA's catalogues (CC BY-NC) and CC BY-SA or GPL sets are not used.
- **Every export has TSDoc with an `@example`**, and a test that names it.
- **Needs Node 22 or later** to use the package and **22.18 or later** to work on it: the tests and scripts run TypeScript directly.
- **Ports.** 8250 to 8274 (the space packages share 8200 to 8299, 25 each); 8250 is the demo, 8251 the tests, 8252 the pictures; check with `lsof -iTCP:<port> -sTCP:LISTEN` first and stop a server by its process id, never by name.

## Commands

```sh
pnpm check      # lint, types, tests, the build and the packed package
pnpm dev        # build the demo and serve it at http://127.0.0.1:8250/hoshi-stars/
pnpm test:readme # run every example of the README and the guides against the built package
pnpm images     # retake the thumbnail, dark thumbnail and icon (docs/images)
pnpm test:demo  # play the demo in Chromium and WebKit at a phone's width and a desk's
```

Add a line to `CHANGELOG.md` under **Unreleased** for every change.

## Releasing

Make a release commit (bump `package.json`, move the changelog's Unreleased block under the version) and push it. The Release workflow (Actions, Release, Run workflow, from `main`) checks the tag, runs `pnpm check` and publishes by npm trusted publishing, which names `release.yml`. Nobody publishes from a laptop.
