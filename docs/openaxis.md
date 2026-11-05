# OpenAxis prototype

This fork connects automatically to the local Rotatrix app at
`ws://127.0.0.1:6607`. Load a scan in the main 3D viewport and use the
Rotatrix navigation controls. **OpenAxis Diagnostics** in the view bar
shows connection state and navigation evidence. The normal pivot remains
visible when diagnostics are off.

One OpenAxis session follows the last visible pane you pointed at. It supports
the main scan, the linked comparison, either alignment picker, and both
standalone sheets and transparent sketch overlays. Sheets keep their native
orientation while panning and zooming. Closing a pane returns navigation to
an eligible pane. Selection queries use the painted scan region where available.
For selection surface picking, all three triangle vertices must be marked.
The renderer's own navigation targets supply model bounds and general picks.

## Build and test

Use Node 22+ and pnpm 10.28.1. The SDK revision is pinned because the npm
release does not yet match this prototype's Navigation API.

```sh
node scripts/setup-openaxis.mjs
npm ci --install-links
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Alternatively pass a clean OpenAxis checkout at the pinned revision to
`node scripts/setup-openaxis.mjs /path/to/openaxis`. The helper verifies its
revision and builds the SDK. Generated SDK files stay in ignored `.openaxis/`.
For the production build, use `npm run preview -- --host 127.0.0.1`.

Check orbit/pan/zoom, native mouse input during a gesture, off-center pivots,
marked-region selection, resize, load/replace, and restarting Rotatrix.
Browser/physical-device acceptance remains necessary beyond automated tests.

## Sharing a preview

For a hosted pilot, pick a distinct fork name and hosting project, update the
visible branding and source link, then publish the matching fork revision with
its license notices. Build that revision using the steps above and serve
`dist/` from a static HTTPS site. The checked-in Cloudflare Workers assets
configuration is one option. Change its upstream project name before deploying.
Test the hosted URL on another computer with local Rotatrix running, including
browser local-network permission, connection, navigation, and reconnect. Once
that passes, testers need only the URL and their local Rotatrix installation.
For a loopback-only pilot, serve the same build locally on each tester's computer.

## Licenses

The original adapter files marked MIT are available under the MIT license
in `src/integrations/openaxis/LICENSE`. Changes to ScanRuler source retain
its AGPL-3.0-only license. OpenAxis itself is separately dual licensed under
ELv2 or GPL-3.0-only. This AGPL fork uses the GPL-3.0-only option; MIT adapter
code does not relicense the SDK. Preserve the SDK's LICENSE and LEGAL.md.
SDK source: https://github.com/rotatrix/openaxis/tree/8f8b5e50e6eb1f3b15e2bd6ebaccc6208ce50bcc

This prototype's SDK dependency is a fork-specific exception to upstream's
dependency policy, not an upstream-approved commercial licensing arrangement.
Distribution and CI packaging are not established by this local prototype.
