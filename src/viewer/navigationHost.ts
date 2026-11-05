// SPDX-License-Identifier: MIT
// Host-owned values: no SDK dependency. Suitable for an adapter or RPC transport.
export type Triple = [number, number, number]
export interface NavigationCamera { position: Triple; quaternion: [number, number, number, number]; extent: number }
export interface NavigationBounds { min: Triple; max: Triple }
export interface NavigationHost {
  eligible(): boolean
  viewspace: '2d' | '3d'
  canvas: HTMLCanvasElement
  container: HTMLElement
  context(): object | undefined
  readCamera(): NavigationCamera
  writeCamera(pose: NavigationCamera, pivot?: Triple): boolean
  bounds(selected: boolean): NavigationBounds | undefined
  pick(x: number, y: number, selected: boolean): { point: Triple; bounds?: NavigationBounds } | undefined
  hasSelection(): boolean
  // Projection for transient graphics; values are NDC, including clipping depth.
  project(point: Triple): Triple
  showPivot(point?: Triple): void
  dispose(): void
}
