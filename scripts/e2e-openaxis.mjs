// SPDX-License-Identifier: MIT
// Native browser smoke plus adapter integration checks. No device emulation or
// bypass of the SDK's server/license verification; real connection status is reported.
import { writeFileSync } from 'node:fs'
import { Mesh, SphereGeometry } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { launchApp, loadScan, check, finish, shotPath, sleep } from './e2e-lib.mjs'

const fixture = shotPath('navigation-sphere.stl')
writeFileSync(fixture, new STLExporter().parse(new Mesh(new SphereGeometry(25, 32, 24))))
const { browser, page, consoleErrors } = await launchApp()
try {
  await loadScan(page, fixture)
  await page.locator('button::-p-text(OpenAxis Diagnostics)').click()
  await sleep(1000)
  const status = await page.$eval('.openaxis-diagnostics', el => el.textContent)
  console.log('Real OpenAxis connection:', status)
  check(status.includes('OpenAxis:'), 'viewport diagnostics show connection status')
  await page.screenshot({ path: shotPath('openaxis-main.png') })
  await page.locator('button::-p-text(OpenAxis Diagnostics)').click()
  await page.waitForFunction(() => document.querySelector('.openaxis-diagnostics')?.hidden)
  check(await page.$eval('.openaxis-diagnostics', el => el.hidden), 'diagnostic toggle hides presentation')
  check(await page.$eval('.openaxis-diagnostic-graphics', el => getComputedStyle(el).display === 'none' && el.getClientRects().length === 0), 'diagnostic graphics are actually hidden by CSS')

  if (!process.env.PRODUCTION) {
    const cleared = await page.evaluate(async () => {
      const { NavigationPresentation } = await import('/src/integrations/openaxis/presentation.ts')
      const container = document.querySelector('.viewport')
      const viewport = container.querySelector('canvas')
      const presentation = new NavigationPresentation({ container, canvas: viewport, project: p => p })
      try {
        presentation.draw({ revision: 1, lines: [], segments: [], markers: [{ point: [30, 30], label: 'test pick', tone: 'text' }] }, 'test')
        const canvas = presentation.canvas
        const pixels = () => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        const painted = pixels().some((value, i) => i % 4 === 3 && value > 0)
        presentation.draw(undefined, 'test')
        return painted && !pixels().some(value => value > 0) && presentation.output.textContent === '' && getComputedStyle(canvas).display === 'none'
      } finally { presentation.dispose() }
    })
    check(cleared, 'disabling diagnostics clears previously painted markers and text')
    const result = await page.evaluate(async () => {
      const { SceneManager } = await import('/src/viewer/SceneManager.ts')
      const { ScanNavigationAdapter } = await import('/src/integrations/openaxis/adapter.ts')
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const container = document.createElement('div')
      Object.assign(container.style, { position: 'fixed', left: '400px', top: '100px', width: '640px', height: '480px', zIndex: '10000' })
      document.body.append(container)
      const scene = new SceneManager(container)
      const geometry = new THREE.BoxGeometry(20, 30, 40)
      scene.setMesh(geometry.attributes.position.array, new Uint32Array(geometry.index.array), geometry.attributes.normal.array)
      const host = scene.navigationHost()
      const adapter = new ScanNavigationAdapter(host, () => true)
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const context = adapter.captureContext()
        const capture = adapter.beginQuery(context)
        const bounds = capture.resolve('model.bounds')
        const center = capture.resolve('pick.viewport_center')
        const before = adapter.read()
        const desired = { ...before, t: [before.t[0] + 2, before.t[1] - 3, before.t[2]], ortho_extent: before.ortho_extent * 0.8 }
        const write = adapter.applyPose(context, desired, undefined, [0, 0, 0])
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const actual = adapter.read()
        scene.setPaintedVertices(Uint32Array.from({ length: geometry.attributes.position.count }, (_, i) => i), '#ff0000')
        const selected = adapter.beginQuery(context).resolve('selection.bounds')
        scene.setAlignPreview(new THREE.Matrix4().makeTranslation(100, 0, 0).elements)
        const stale = adapter.applyPose(context, desired, undefined)
        const moved = host.bounds(false)
        host.showPivot([100, 0, 0])
        const pivotDoesNotChangeBounds = JSON.stringify(moved) === JSON.stringify(host.bounds(false))
        scene.setPaused(true)
        const paused = adapter.captureContext() === undefined
        scene.setPaused(false)
        const { FlatScene } = await import('/src/viewer/FlatScene.ts')
        const { CompareScene } = await import('/src/viewer/CompareScene.ts')
        const { PickScene } = await import('/src/viewer/PickScene.ts')
        const { activeNavigationView } = await import('/src/viewer/navigationViews.ts')
        const theme = scene.layerHost().theme()
        const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const cases = [
          () => { const pane = new CompareScene(container, geometry.clone(), theme); pane.linkTo(scene.viewLink()); return pane },
          () => new PickScene(container, geometry.clone(), theme),
          ...[false, true].map(transparent => () => {
            const pane = new FlatScene(container, theme, { transparent })
            pane.setBlankSheet([-10, -10], [10, 10])
            return pane
          }),
        ]
        const panes = []
        for (const make of cases) {
          const pane = make()
          try {
            const active = activeNavigationView()
            await tick()
            active.host.canvas.dispatchEvent(new PointerEvent('pointerenter', { clientX: 460, clientY: 140 }))
            await tick()
            const camera = active.host.readCamera()
            const planar = active.host.viewspace === '2d'
            const changed = active.host.writeCamera({ ...camera, extent: camera.extent * 0.8, quaternion: planar ? [0.5, 0.5, 0.5, 0.5] : camera.quaternion })
            await tick()
            const after = active.host.readCamera()
            const linked = !(pane instanceof CompareScene) || Math.abs(host.readCamera().extent - after.extent) < 1e-6
            const drawnHere = container.querySelectorAll('.openaxis-diagnostics').length === 1
            const captured = active.host.context()
            host.canvas.dispatchEvent(new PointerEvent('pointerenter'))
            panes.push({ routed: active.host !== host, cursor: active.cursor?.[0] === 460, captured: !!captured, changed, linked, drawnHere, camera:
              Math.abs(after.extent - camera.extent * 0.8) < 1e-6 && (!planar || after.quaternion.every((v, i) => Math.abs(v - camera.quaternion[i]) < 1e-6)), returned: activeNavigationView()?.host === host })
          } finally { pane.dispose() }
        }
        return { panes, bounds, center, write, actual, desired, selected, stale, moved, pivotDoesNotChangeBounds, paused }
      } finally { scene.dispose(); geometry.dispose(); container.remove() }
    })
    console.log(JSON.stringify(result, null, 2))
    check(result.panes.every(pane => Object.values(pane).every(Boolean)), 'switch between main, linked comparison, independent picker, sheet and transparent sketch with correct camera constraints')
    check(!!result.center.point, 'native BVH center pick hits visible geometry')
    check(result.write.success && result.actual.t.every((v, i) => Math.abs(v - result.desired.t[i]) < 1e-6), 'SDK camera write survives native render ticks')
    check(Math.abs(result.actual.ortho_extent - result.desired.ortho_extent) < 1e-6, 'orthographic extent round trip')
    check(!!result.selected?.min, 'marked region supplies selection bounds')
    check(!result.stale.success && result.paused, 'changed/paused targets reject old navigation')
    check(Math.abs(result.moved.min[0] - 90) < 1e-6, 'alignment transforms bounds into world coordinates')
    check(result.pivotDoesNotChangeBounds, 'pivot graphics excluded from model bounds')
  }
} catch (error) {
  check(false, error.stack ?? String(error))
} finally {
  // No server is a supported state. Browser transport errors for that exact
  // endpoint are expected; all application exceptions still fail the run.
  const unexpected = consoleErrors.filter(error => !/WebSocket connection to 'ws:\/\/127\.0\.0\.1:6607\/?' failed/.test(error))
  await finish(browser, unexpected)
}
