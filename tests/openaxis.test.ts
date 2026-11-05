// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { OrthographicCamera, Quaternion, Vector3 } from 'three'
import { UNAVAILABLE } from '@openaxis/sdk'
import { ScanNavigationAdapter, fromOpenAxis, toOpenAxis } from '../src/integrations/openaxis/adapter'
import { readNavigationCamera, writeNavigationCamera } from '../src/viewer/navigationCamera'
import type { NavigationHost } from '../src/viewer/navigationHost'

describe('navigation camera handoff', () => {
  it('preserves an off-center requested view and survives native lookAt', () => {
    const camera = new OrthographicCamera(-50, 50, 25, -25, 0.01, 1000)
    camera.position.set(0, 0, 100)
    const target = new Vector3()
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 1.2)
    const requested = { position: [12, -5, 80] as [number, number, number], quaternion: q.toArray(), extent: 30 }
    expect(writeNavigationCamera(camera, target, requested, [50, 20, 0])).toBe(true)
    camera.lookAt(target)
    expect(camera.quaternion.angleTo(q)).toBeLessThan(1e-7)
    expect(readNavigationCamera(camera).extent).toBeCloseTo(30)
    expect(camera.position.toArray()).toEqual(requested.position)
    const decoded = fromOpenAxis(toOpenAxis(readNavigationCamera(camera)))!
    expect(new Quaternion(...decoded.quaternion).angleTo(q)).toBeLessThan(1e-7)
  })
  it('rejects invalid projection without changing camera state', () => {
    const camera = new OrthographicCamera()
    const pose = readNavigationCamera(camera)
    expect(writeNavigationCamera(camera, new Vector3(), { ...pose, extent: -1 })).toBe(false)
    expect(readNavigationCamera(camera)).toEqual(pose)
    expect(fromOpenAxis({ t: [0, 0, 0], r: [0, 0, 0], fov: 1 })).toBeUndefined()
  })
})

function fixture() {
  let context: object | undefined = {}
  let selected = false
  let writes = 0
  const samples: number[][] = []
  const host: NavigationHost = {
    eligible: () => true, viewspace: '3d',
    canvas: { getBoundingClientRect: () => ({ left: 100, top: 50, right: 500, bottom: 250, width: 400, height: 200 }) } as HTMLCanvasElement,
    container: {} as HTMLElement,
    context: () => context,
    readCamera: () => ({ position: [0, 0, 100], quaternion: [0, 0, 0, 1], extent: 50 }),
    writeCamera: () => { writes++; return true },
    hasSelection: () => selected,
    bounds: () => ({ min: [-10, -10, -10], max: [10, 10, 10] }),
    pick: (x, y, only) => { samples.push([x, y, Number(only)]); return undefined },
    project: point => point, showPivot: () => {}, dispose: () => {},
  }
  return { host, samples, invalidate: () => { context = undefined }, select: () => { selected = true }, writes: () => writes }
}

describe('navigation query boundaries', () => {
  it('distinguishes an outside cursor, a tested miss and an absent selection', () => {
    const f = fixture(), adapter = new ScanNavigationAdapter(f.host, () => true)
    adapter.cursor = [90, 60]
    const capture = adapter.beginQuery(adapter.captureContext()!)
    expect(capture.resolve('viewport.cursor')).toBe(UNAVAILABLE)
    expect(capture.resolve('pick.cursor')).toBe(UNAVAILABLE)
    expect(capture.resolve('pick.viewport_center.selection')).toBe(UNAVAILABLE)
    expect(capture.resolve('pick.viewport_center')).toEqual({ markerPosition: [200, 100] })
    expect(f.samples).toEqual([[300, 150, 0]])
  })
  it('captures cursor coordinates and routes selected picks independently', () => {
    const f = fixture(), adapter = new ScanNavigationAdapter(f.host, () => true)
    f.select(); adapter.cursor = [200, 100]
    const capture = adapter.beginQuery(adapter.captureContext()!)
    adapter.cursor = [450, 200]
    expect(capture.resolve('viewport.cursor')).toEqual([-0.5, 0.5])
    capture.resolve('pick.cursor.selection'); capture.resolve('pick.viewport_center.selection')
    expect(f.samples).toEqual([[200, 100, 1], [300, 150, 1]])
  })
  it('rejects pending queries and writes after target replacement', () => {
    const f = fixture(), adapter = new ScanNavigationAdapter(f.host, () => true)
    const context = adapter.captureContext()!, capture = adapter.beginQuery(context)
    f.invalidate()
    expect(capture.resolve('camera.pose')).toBe(UNAVAILABLE)
    expect(adapter.applyPose(context, { t: [0, 0, 0], r: [0, 0, 0], ortho_extent: 10 }, undefined)).toEqual({ success: false })
    expect(f.writes()).toBe(0)
  })
})
