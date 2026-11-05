// SPDX-License-Identifier: MIT
import { NavigationDiagnostics, NavigationSession, OpenAxisClient, OpenAxisConnectionManager, configureLogging, comparePoses, UNAVAILABLE, type NavigationAdapter, type CameraPoseValue } from '@openaxis/sdk'
import { activeNavigationView, type NavigationView } from '../../viewer/navigationViews'
import { ScanNavigationAdapter } from './adapter'
import { NavigationPresentation } from './presentation'

let diagnosticsVisible = false
const visibilityListeners = new Set<() => void>()
export const diagnosticsSnapshot = () => diagnosticsVisible
export function subscribeDiagnostics(listener: () => void) { visibilityListeners.add(listener); return () => { visibilityListeners.delete(listener) } }
export function toggleDiagnostics() { diagnosticsVisible = !diagnosticsVisible; for (const listener of visibilityListeners) listener() }

export function attachOpenAxis(): () => void {
  let stopped = false
  let suspended = false
  let status = 'connecting'
  const available = () => !stopped && !suspended && !document.hidden && document.hasFocus()
  let view: NavigationView | undefined
  let adapter: ScanNavigationAdapter | undefined
  let presentation: NavigationPresentation | undefined
  const routing: NavigationAdapter<object> = {
    captureContext: () => adapter?.captureContext(),
    isCurrent: context => adapter?.isCurrent(context) ?? false,
    beginQuery: context => {
      if (!adapter || !adapter.isCurrent(context)) return { resolve: () => UNAVAILABLE }
      adapter.cursor = view?.cursor
      return adapter.beginQuery(context)
    },
    applyPose: (context, pose, state, pivot) => adapter?.applyPose(context, pose, state, pivot) ?? { success: false },
    showPivot: (context, point) => {
      if (adapter?.isCurrent(context)) adapter.showPivot(context, point)
    },
  }
  const client = new OpenAxisClient({ clientName: 'ScanRuler Rotatrix prototype', url: 'ws://127.0.0.1:6607', target: { app: 'scanruler' } })
  configureLogging('scanruler-openaxis')
  const diagnostics = new NavigationDiagnostics({ enabled: diagnosticsVisible })
  const session = new NavigationSession(client, routing, { diagnostics, observation: context => adapter?.isCurrent(context) ? adapter.read() : undefined })
  const connection = new OpenAxisConnectionManager(client, {
    metadata: () => ({ capabilities: ['navigation'], tags: ['scanruler', ...(view ? ['viewspace.' + view.host.viewspace] : [])], focused: available() && !!view?.host.context() }),
    onState: state => { status = state; if (state !== 'ready') { diagnostics.clear(); view?.host.showPivot() } },
  })
  let previousContext: object | undefined
  let previousPose: CameraPoseValue | undefined
  let frame = 0
  let transition: Promise<unknown> = Promise.resolve()
  let running: Promise<unknown> | undefined
  const updates = new Set<Promise<unknown>>()
  const refresh = () => {
    const promise = connection.refreshMetadata().catch(error => console.debug('OpenAxis metadata interrupted', error))
    updates.add(promise)
    void promise.finally(() => updates.delete(promise))
  }
  const invalidate = () => { session.contextChanged(); diagnostics.clear(); view?.host.showPivot() }
  const resume = () => {
    transition = transition.then(() => {
      if (available()) running = connection.start().catch(error => console.error('OpenAxis connection failed', error))
    })
  }
  const focus = () => { invalidate(); refresh(); resume() }
  const blur = () => { if (view) view.cursor = undefined; invalidate(); refresh() }
  const pagehide = () => { suspended = true; invalidate(); transition = transition.then(() => connection.stop()) }
  const pageshow = () => { suspended = false; focus() }
  const visibility = () => { if (document.hidden) blur(); else focus() }
  window.addEventListener('focus', focus)
  window.addEventListener('blur', blur)
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('pageshow', pageshow)
  document.addEventListener('visibilitychange', visibility)
  const tick = () => {
    if (stopped) return
    const nextView = activeNavigationView()
    const switched = nextView !== view
    if (switched) {
      invalidate()
      presentation?.dispose()
      view = nextView
      const bound = nextView
      adapter = bound && new ScanNavigationAdapter(bound.host, () => available() && bound === activeNavigationView())
      presentation = bound && new NavigationPresentation(bound.host)
      previousPose = undefined
      previousContext = undefined
    }
    const context = adapter?.captureContext()
    const pose = adapter?.read()
    if (switched || context !== previousContext) {
      if (!switched) invalidate()
      previousContext = context
      refresh()
    }
    else if (context && pose && previousPose && adapter && comparePoses(previousPose, pose).changed && (!adapter.lastWrite || comparePoses(adapter.lastWrite, pose).changed)) session.nativeCameraChanged()
    if (adapter) adapter.lastWrite = undefined
    previousPose = pose
    diagnostics.setEnabled(diagnosticsVisible)
    const evidence = diagnosticsVisible ? diagnostics.presentation() : undefined
    presentation?.draw(evidence && (evidence.context === undefined || evidence.context === context) ? evidence : undefined, context ? status : `${status} — viewport unavailable`)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  resume()
  return () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    window.removeEventListener('focus', focus); window.removeEventListener('blur', blur)
    window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow)
    document.removeEventListener('visibilitychange', visibility)
    // Synchronous React teardown invalidates callbacks before WebGL is destroyed.
    session.close()
    view?.host.showPivot()
    presentation?.dispose()
    void transition.then(async () => { await connection.stop(); await running; await Promise.allSettled(updates) }).catch(error => console.debug('OpenAxis shutdown', error))
  }
}
