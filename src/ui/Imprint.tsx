// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Hermann (CNC Kitchen) <stefan@cnckitchen.com>

// Imprint (Impressum) + privacy policy — German legal requirement
// (§ 5 DDG / Art. 13 DSGVO). Opened from the status strip.

import { plugins } from '../plugins/registry'
import { useStore } from '../state/store'
import { APP_VERSION } from '../version'
import { useDismiss } from './useDismiss'

export function ImprintModal() {
  const open = useStore((s) => s.imprintOpen)
  const close = useStore((s) => s.openImprint)

  // Escape closes it. Captured, so the workspace's own Escape handling — which
  // would discard the draft behind the dialog — never sees the key.
  useDismiss(open, () => close(false))

  if (!open) return null
  // The plugins' notices on the third-party software they ship.
  const notices = plugins().flatMap((p) => (p.notices ? [{ id: p.id, Notices: p.notices }] : []))
  return (
    <div className="modalback" onClick={() => close(false)}>
      <div className="modal imprint" onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <h2>Imprint &amp; Privacy Policy</h2>
          <button className="x" onClick={() => close(false)} aria-label="Close">
            ×
          </button>
        </div>
        <p className="dim" data-test="imprint-version">
          ScanRuler v{APP_VERSION} — quote the number when reporting a problem.
        </p>

        <h3>About this preview</h3><p>This preview is furnished by Icebound Flame LLC. ScanRuler is the original work of Stefan Hermann (CNC Kitchen).</p><p><a href="https://github.com/rotatrix/ScanRuler/tree/rotatrix-preview">Preview source code</a></p>
        <p>
          Local Rotatrix integration prototype. OpenAxis SDK 1.0.0-rc.1,
          revision 8f8b5e50e6eb1f3b15e2bd6ebaccc6208ce50bcc, used under GPLv3.{' '}
          <a href={import.meta.env.BASE_URL + "licenses/openaxis/LICENSE"}>SDK license</a>{' · '}
          <a href={import.meta.env.BASE_URL + "licenses/openaxis/LEGAL.md"}>SDK notices</a>{' · '}
          <a href="https://github.com/rotatrix/openaxis/tree/8f8b5e50e6eb1f3b15e2bd6ebaccc6208ce50bcc">SDK source</a>.
          Navigation exchanges camera and scene facts with the local Rotatrix app.
        </p>
        {notices.length > 0 && (
          <>
            <h3>Third-party software</h3>
            {notices.map(({ id, Notices }) => (
              <Notices key={id} />
            ))}
          </>
        )}

        <h3>Privacy</h3>
        <ul>
          <li>GitHub Pages hosts this preview. See the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>.</li>
          <li>
            Your scans, reference models, fitted elements and every measurement made from them
            are processed entirely in your browser. They are held in memory for the duration of
            the session only, are never uploaded, and are gone when you close the tab. The one
            exception is the optional agent connection: if you switch it on and accept its warning,
            what the AI agent you connected reads is processed by that agent and, unless its model
            runs on your computer, by the model’s provider, under that provider’s terms. ScanRuler
            itself sends none of this anywhere and has no part in that processing.
          </li>
          <li>
            This preview stores interface preferences and whether you dismissed its welcome in your browser’s local storage.
          </li>
          <li>This website does not use cookies, analytics, or any tracking technologies.</li>
          <li>
            This site contains links to external websites (e.g., GitHub, CNCKitchen.STORE,
            PayPal, Ko-fi). These sites have their own privacy policies, over which we have no
            control.
          </li>
          <li>
            Under the GDPR you have the right to access, rectification, erasure, restriction of
            processing, data portability, and the right to lodge a complaint with a supervisory
            authority.
          </li>
        </ul>
      </div>
    </div>
  )
}
