// SPDX-License-Identifier: MIT
import { Quaternion, Vector3 } from 'three'
import { UNAVAILABLE, type CameraPoseValue, type NavigationAdapter } from '@openaxis/sdk'
import type { NavigationCamera, NavigationHost } from '../../viewer/navigationHost'

export function toOpenAxis(pose: NavigationCamera): CameraPoseValue {
  const q = new Quaternion(...pose.quaternion).normalize()
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w)
  const sin = Math.hypot(q.x, q.y, q.z)
  const scale = sin < 1e-12 ? 2 : 2 * Math.atan2(sin, q.w) / sin
  return { t: [...pose.position], r: [q.x * scale, q.y * scale, q.z * scale], ortho_extent: pose.extent }
}

export function fromOpenAxis(pose: CameraPoseValue): NavigationCamera | undefined {
  if (!pose.ortho_extent || pose.fov !== undefined || ![...pose.t, ...pose.r, pose.ortho_extent].every(Number.isFinite) || pose.ortho_extent <= 0) return undefined
  const axis = new Vector3(...pose.r)
  const angle = axis.length()
  const q = angle < 1e-12 ? new Quaternion() : new Quaternion().setFromAxisAngle(axis.divideScalar(angle), angle)
  return { position: [...pose.t], quaternion: q.toArray(), extent: pose.ortho_extent }
}

export class ScanNavigationAdapter implements NavigationAdapter<object> {
  cursor?: [number, number]
  lastWrite?: CameraPoseValue
  constructor(readonly host: NavigationHost, private readonly available: () => boolean) {}
  captureContext() { return this.available() ? this.host.context() : undefined }
  isCurrent(context: object) { return this.captureContext() === context }
  read() { return toOpenAxis(this.host.readCamera()) }
  beginQuery(context: object) {
    const pose = this.read()
    const rect = this.host.canvas.getBoundingClientRect()
    const savedCursor = this.cursor && [...this.cursor] as [number, number]
    const cursor = savedCursor && savedCursor[0] >= rect.left && savedCursor[0] <= rect.right && savedCursor[1] >= rect.top && savedCursor[1] <= rect.bottom ? savedCursor : undefined
    const selected = this.host.hasSelection()
    // The synchronous resolver never yields to model workers or DOM events.
    return {
      initialObservation: () => structuredClone(pose),
      resolve: (name: string): unknown => {
        if (!this.isCurrent(context)) return UNAVAILABLE
        if (name === 'camera.pose') return structuredClone(pose)
        if (name === 'world.orientation') return { up: [0, 0, 1], forward: [0, 1, 0], handedness: 'right' }
        if (name === 'viewport.aspect') return rect.width > 0 && rect.height > 0 ? rect.width / rect.height : UNAVAILABLE
        if (name === 'viewport.cursor') return cursor ? [2 * (cursor[0] - rect.left) / rect.width - 1, 1 - 2 * (cursor[1] - rect.top) / rect.height] : UNAVAILABLE
        if (name === 'model.bounds') return this.host.bounds(false) ?? UNAVAILABLE
        if (name === 'selection.bounds') return selected ? this.host.bounds(true) ?? UNAVAILABLE : UNAVAILABLE
        if (!['pick.cursor', 'pick.cursor.selection', 'pick.viewport_center', 'pick.viewport_center.selection'].includes(name)) return UNAVAILABLE
        const onlySelected = name.endsWith('.selection')
        if (onlySelected && !selected) return UNAVAILABLE
        const sample = name.startsWith('pick.cursor') ? cursor : [rect.left + rect.width / 2, rect.top + rect.height / 2]
        if (!sample || rect.width <= 0 || rect.height <= 0) return UNAVAILABLE
        const hit = this.host.pick(sample[0], sample[1], onlySelected)
        return { ...hit, markerPosition: [sample[0] - rect.left, sample[1] - rect.top] }
      },
    }
  }
  applyPose(context: object, desired: CameraPoseValue, _navigation: unknown, pivot?: [number, number, number]) {
    const native = fromOpenAxis(desired)
    if (!this.isCurrent(context) || !native || !this.host.writeCamera(native, pivot)) return { success: false }
    this.lastWrite = this.read()
    return { success: true, realizedPose: structuredClone(this.lastWrite) }
  }
  showPivot(context: object, point?: [number, number, number]) {
    if (!point || this.isCurrent(context)) this.host.showPivot(point)
  }
}
