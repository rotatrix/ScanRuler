// SPDX-License-Identifier: MIT
import { OrthographicCamera, Quaternion, Vector3 } from 'three'
import type { NavigationCamera, Triple } from './navigationHost'

export function readNavigationCamera(camera: OrthographicCamera): NavigationCamera {
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), extent: (camera.top - camera.bottom) / camera.zoom }
}

export function writeNavigationCamera(camera: OrthographicCamera, target: Vector3, pose: NavigationCamera, pivot?: Triple): boolean {
  if (![...pose.position, ...pose.quaternion, pose.extent].every(Number.isFinite) || pose.extent <= 0) return false
  const q = new Quaternion(...pose.quaternion)
  if (q.lengthSq() < 1e-12) return false
  q.normalize()
  const eye = new Vector3(...pose.position)
  const forward = new Vector3(0, 0, -1).applyQuaternion(q)
  const previousDistance = Math.max(camera.position.distanceTo(target), 1e-6)
  const depth = pivot ? new Vector3(...pivot).sub(eye).dot(forward) : previousDistance
  target.copy(eye).addScaledVector(forward, depth > 1e-6 ? depth : previousDistance)
  camera.position.copy(eye)
  camera.up.set(0, 1, 0).applyQuaternion(q)
  camera.quaternion.copy(q)
  camera.zoom = (camera.top - camera.bottom) / pose.extent
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return true
}
