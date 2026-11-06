# Browser regression tests

```sh
yarn install --immutable
yarn exec playwright install --with-deps chromium firefox
yarn build
yarn test:browser
```

The tests serve raw patches from a temporary loopback HTTP server and inject the
actual Chrome/Firefox content bundles at document start. They exercise Shadow DOM
layout, document wheel scrolling, sidebar resizing/navigation/scroll-spy, split and
unified modes, tree ordering, footer exclusion, offscreen rendering skips, and
large-file expansion. They do not test extension installation, host permissions,
or background-script registration.

The regular suite includes 120 files / 9,600 added lines and a 6 MB giant-line
fixture. Frame-gap and load-time limits are coarse freeze detectors, not FPS
benchmarks. Virtualization checks inspect actual skipped offscreen descendants,
then verify they become visible after navigation.

For the optional 105 MB stress case with six 17.5 MB lines:

```sh
GPV_STRESS_GIANT_LINE_CHARS=17500000 yarn test:browser --grep 'giant lines'
```

This disables tracing to avoid copying the huge patch into trace artifacts. The
stress load budget is 60 seconds and includes browser raw-text loading, which can
be much slower in Firefox than in Chromium. Expansion remains bounded by existing
line truncation and word-diff limits. Console output records observed timings.

To compare the same test with content bundles built from an earlier revision,
set `GPV_BUNDLE_ROOT` to that build's directory.
