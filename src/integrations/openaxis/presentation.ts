// SPDX-License-Identifier: MIT
import { DIAGNOSTIC_COLORS, type DiagnosticPresentation } from '@openaxis/sdk'
import type { NavigationHost } from '../../viewer/navigationHost'

export class NavigationPresentation {
  readonly output = document.createElement('div')
  readonly canvas = document.createElement('canvas')
  constructor(private host: NavigationHost) {
    this.output.className = 'openaxis-diagnostics'
    this.canvas.className = 'openaxis-diagnostic-graphics'
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '5' })
    this.canvas.setAttribute('aria-hidden', 'true')
    host.container.append(this.canvas, this.output)
  }
  draw(frame: DiagnosticPresentation | undefined, status: string) {
    this.canvas.hidden = !frame
    this.output.hidden = !frame
    // The host's `.viewport canvas { display: block }` overrides HTML hidden.
    this.canvas.style.display = frame ? 'block' : 'none'
    if (!frame) {
      const ctx = this.canvas.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.output.replaceChildren()
      return
    }
    const { width, height } = this.host.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(width * dpr), h = Math.round(height * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h }
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.output.replaceChildren()
    for (const row of [{ text: `OpenAxis: ${status}`, tone: 'text' as const }, ...frame.lines]) {
      const line = document.createElement('div')
      line.textContent = row.text
      line.style.color = `rgb(${DIAGNOSTIC_COLORS[row.tone].join(',')})`
      this.output.append(line)
    }
    const ctx = this.canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    for (const segment of frame.segments) {
      // Orthographic projection is affine: clip in NDC before mapping to pixels.
      const a = this.host.project(segment.start), b = this.host.project(segment.end)
      let low = 0, high = 1
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
        const f = 1 + sign * a[axis], g = 1 + sign * b[axis]
        if (f < 0 && g < 0) high = -1
        else if (f < 0) low = Math.max(low, f / (f - g))
        else if (g < 0) high = Math.min(high, f / (f - g))
      }
      if (low > high) continue
      const pixel = (t: number) => [(1 + a[0] + (b[0] - a[0]) * t) * width / 2, (1 - a[1] - (b[1] - a[1]) * t) * height / 2]
      const p = pixel(low), q = pixel(high)
      ctx.globalAlpha = segment.opacity ?? 1
      ctx.strokeStyle = `rgb(${DIAGNOSTIC_COLORS[segment.tone].join(',')})`
      ctx.lineWidth = segment.width
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke()
    }
    ctx.globalAlpha = 0.65
    ctx.font = '12px system-ui'
    for (const marker of frame.markers) {
      const [x, y] = marker.point
      ctx.strokeStyle = `rgb(${DIAGNOSTIC_COLORS[marker.tone].join(',')})`
      ctx.fillStyle = ctx.strokeStyle
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke()
      marker.label.split('\n').forEach((label, i) => {
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3
        ctx.strokeText(label, x + 12, y - 8 + i * 15)
        ctx.fillText(label, x + 12, y - 8 + i * 15)
      })
    }
    ctx.globalAlpha = 1
  }
  dispose() { this.output.remove(); this.canvas.remove() }
}
