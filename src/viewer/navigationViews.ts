// SPDX-License-Identifier: MIT
import type { NavigationHost } from './navigationHost'

export interface NavigationView {
  host: NavigationHost
  cursor?: [number, number]
}

// Most recently pointed-at or opened pane wins. Hidden panes release the device.
const views: NavigationView[] = []
export function activeNavigationView(): NavigationView | undefined {
  return views.find(({ host }) => host.canvas.isConnected && host.eligible())
}

export function registerNavigationHost(host: NavigationHost): () => void {
  const view: NavigationView = { host }
  views.unshift(view)
  const point = (event: PointerEvent) => {
    if (views[0] !== view) {
      views.splice(views.indexOf(view), 1)
      views.unshift(view)
    }
    view.cursor = [event.clientX, event.clientY]
  }
  const leave = () => { view.cursor = undefined }
  host.canvas.addEventListener('pointerenter', point)
  host.canvas.addEventListener('pointermove', point)
  host.canvas.addEventListener('pointerdown', point)
  host.canvas.addEventListener('pointerleave', leave)
  return () => {
    views.splice(views.indexOf(view), 1)
    host.canvas.removeEventListener('pointerenter', point)
    host.canvas.removeEventListener('pointermove', point)
    host.canvas.removeEventListener('pointerdown', point)
    host.canvas.removeEventListener('pointerleave', leave)
  }
}
