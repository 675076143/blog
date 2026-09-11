import { categoryColor } from './archiveCategories.js'
import { cabinetLayout, cabinetRowY } from './cabinetLayout.js'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export function createCabinetScene(canvas, { onPick, onFailure, onHover, onBrowse }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 680 ? 1.25 : 1.5))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.setClearColor(0x000000, 0)
  renderer.transmissionResolutionScale = .65
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 70)
  camera.position.set(6.6, 5.6, 11.8)
  const look = new THREE.Vector3(0, 1.35, 0)
  const cameraTarget = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, .04)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()
  const hemi = new THREE.HemisphereLight(0xf6f4e9, 0x8c9489, 2.5)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff2da, 4)
  key.position.set(-3, 8, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 25 })
  key.shadow.bias = -.0004
  key.shadow.normalBias = .025
  key.shadow.radius = 3
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xcce5ef, 2)
  fill.position.set(5, 3, -4)
  scene.add(fill)
  const floorMaterial = new THREE.ShadowMaterial({ opacity: .17 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -3
  floor.receiveShadow = true
  scene.add(floor)
  const assembly = new THREE.Group()
  scene.add(assembly)
  const backGeometry = new RoundedBoxGeometry(2.12, 2.84, .11, 2, .04)
  const coverGeometry = new RoundedBoxGeometry(2.08, 2.8, .12, 3, .045)
  const ringGeometry = new THREE.TorusGeometry(.66, .045, 10, 64)
  const innerGeometry = new THREE.TorusGeometry(.45, .085, 10, 48)
  const screwGeometry = new THREE.CylinderGeometry(.032, .032, .065, 10)
  const labelGeometry = new THREE.PlaneGeometry(1.8, .84)
  const tabGeometry = new THREE.BoxGeometry(.19, .19, .09)
  const lineGeometry = new THREE.EdgesGeometry(backGeometry, 25)
  const railGeometry = new THREE.BoxGeometry(.035, 2.58, .19)
  const metal = new THREE.MeshStandardMaterial({ color: 0x87948e, metalness: .85, roughness: .26 })
  const white = new THREE.MeshStandardMaterial({ color: 0xdddcd2, metalness: .3, roughness: .38 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9913b, metalness: .65, roughness: .23 })
  const backMaterial = new THREE.MeshStandardMaterial({ color: 0xe4e6df, metalness: .2, roughness: .44 })
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xb7c3bb, transparent: true, opacity: .7 })
  const resources = new Set([backGeometry, coverGeometry, ringGeometry, innerGeometry, screwGeometry, labelGeometry, tabGeometry, lineGeometry, railGeometry, metal, white, gold, backMaterial, edgeMaterial, floor.geometry, floorMaterial])
  const spineGeometry = new RoundedBoxGeometry(.1, 2.84, .48, 2, .035)
  const shelfGeometry = new THREE.BoxGeometry(1, .09, 1.8)
  resources.add(spineGeometry); resources.add(shelfGeometry)
  const shelves = []
  function syncShelves(count) {
    while (shelves.length > count) scene.remove(shelves.pop())
    while (shelves.length < count) {
      const shelf = new THREE.Mesh(shelfGeometry, metal)
      shelf.receiveShadow = true; shelf.castShadow = true
      scene.add(shelf); shelves.push(shelf)
    }
  }
  const categoryMaterials = new Map()
  function categoryMaterial(category) {
    if (!categoryMaterials.has(category)) {
      const material = new THREE.MeshBasicMaterial({ color: categoryColor(category), toneMapped: false })
      categoryMaterials.set(category, material); resources.add(material)
    }
    return categoryMaterials.get(category)
  }
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const idleRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.035, -Math.PI * .32, -.025))
  const frontRotation = new THREE.Quaternion()
  const targetPosition = new THREE.Vector3()
  const extractedPosition = new THREE.Vector3(0, 1.8, 2.6)
  const targetRotation = new THREE.Quaternion()
  const dragRotation = new THREE.Quaternion()
  const dragEuler = new THREE.Euler()
  let files = [], chosen = null, hovered = null, active = false, reduced = false, frame = 0, last = 0, width = 1, height = 1, disposed = false
  let down = null, yaw = 0, pitch = 0, focus = 0, position = 0, wheelDistance = 0, dark = false
  function label(post) {
    const image = document.createElement('canvas')
    image.width = 768; image.height = 360
    const ctx = image.getContext('2d')
    // Transparent ink: the glass remains visible between every glyph.
    ctx.clearRect(0, 0, 768, 360)
    ctx.fillStyle = '#b9b9b9'; ctx.font = '24px monospace'
    ctx.fillText(`ROBIN                         ${post.id}`, 24, 38)
    const wrap = () => {
      const lines = []; let line = ''
      for (const character of post.text) {
        if (line && ctx.measureText(line + character).width > 720) { lines.push(line); line = '' }
        line += character
      }
      if (line) lines.push(line)
      return lines
    }
    let size = 58, lines
    do { ctx.font = `600 ${size}px sans-serif`; lines = wrap(); if (lines.length <= 4) break; size -= 2 } while (size > 12)
    ctx.fillStyle = '#ffffff'
    const lineHeight = Math.min(size * 1.35, 270 / lines.length)
    lines.forEach((line, index) => ctx.fillText(line, 24, 62 + lineHeight * (index + 1)))
    const texture = new THREE.CanvasTexture(image)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    return texture
  }
  function clearFiles() {
    for (const file of files) {
      assembly.remove(file.group)
      file.glass.dispose(); file.labelMaterial.dispose(); file.texture.dispose()
    }
    files = []
  }
  function setFiles(posts) {
    clearFiles()
    hovered = null; onHover?.(null); yaw = 0; pitch = 0; focus = 0; position = 0
    posts.forEach((post, i) => {
      const group = new THREE.Group()
      const home = new THREE.Vector3(i * .64, 1.48, -i * .39)
      group.position.copy(home); group.quaternion.copy(idleRotation)
      const back = new THREE.Mesh(backGeometry, backMaterial)
      back.position.z = -.13; back.castShadow = true; back.receiveShadow = true
      group.add(back)
      const edges = new THREE.LineSegments(lineGeometry, edgeMaterial)
      edges.position.z = -.13; group.add(edges)
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xf2fff6, metalness: 0, roughness: .1, transmission: .92, thickness: .28, ior: 1.46, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.8, attenuationColor: 0xb6dac8, attenuationDistance: 2.8 })
      const spine = new THREE.Mesh(spineGeometry, glass)
      spine.position.set(1.025, 0, .025)
      spine.castShadow = true; group.add(spine)
      // The identification strip faces out from the spine while stored upright.
      const spineMarker = new THREE.Mesh(tabGeometry, categoryMaterial(post.category))
      spineMarker.scale.set(.4, 1.8, 1)
      spineMarker.position.set(1.09, .9, .025); group.add(spineMarker)
      const cover = new THREE.Mesh(coverGeometry, glass)
      cover.position.z = .18
      group.add(cover)
      for (const [geometry, material] of [[ringGeometry, metal], [innerGeometry, white]]) {
        const ring = new THREE.Mesh(geometry, material)
        ring.scale.setScalar(.8); ring.position.set(0, -.28, -.01); group.add(ring)
      }
      const core = new THREE.Mesh(tabGeometry, gold)
      core.position.set(0, -.28, .015); core.rotation.z = Math.PI / 4; group.add(core)
      for (const x of [-.95, .95]) {
        const rail = new THREE.Mesh(railGeometry, metal)
        rail.position.set(x, 0, 0); group.add(rail)
        for (const y of [-1.28, 1.28]) {
          const screw = new THREE.Mesh(screwGeometry, metal)
          screw.rotation.x = Math.PI / 2; screw.position.set(x, y, .265); group.add(screw)
        }
      }
      const tab = new THREE.Mesh(tabGeometry, categoryMaterial(post.category))
      tab.position.set(.69, 1.26, .23); group.add(tab)
      const texture = label(post)
      const labelMaterial = new THREE.MeshStandardMaterial({
        map: texture, color: dark ? 0xd1e0d7 : 0x26372f,
        transparent: true, depthWrite: false, alphaTest: .015,
        roughness: .65, metalness: .05, envMapIntensity: .3,
      })
      const sticker = new THREE.Mesh(labelGeometry, labelMaterial)
      sticker.renderOrder = 2
      sticker.position.set(0, .83, cover.position.z + .064); group.add(sticker)
      group.traverse(object => { object.userData.file = post.link })
      assembly.add(group)
      files.push({ index: i, post, group, home, glass, cover, sticker, labelMaterial, texture, progress: 0, hover: 0 })
    })
    wake()
  }
  function setFocus(value) { focus = THREE.MathUtils.clamp(value, 0, Math.max(0, files.length - 1)); hovered = null; wake() }
  function setSelected(link) { chosen = link; yaw = 0; pitch = 0; wake() }
  function draw(now) {
    frame = 0
    if (disposed || !active) return
    const dt = Math.min((now - last) / 1000 || .016, .04); last = now
    const damping = reduced ? 1 : 1 - Math.exp(-6 * dt)
    const layout = cabinetLayout(width, files.length, focus, height)
    let moving = Math.abs(position - layout.startRow) > .001
    position = moving ? THREE.MathUtils.lerp(position, layout.startRow, damping) : layout.startRow
    const open = files.some(file => file.post.link === chosen)
    const tangent = Math.tan(THREE.MathUtils.degToRad(18))
    const distance = Math.max((layout.visibleRows * 2.45 + .5) / (2 * tangent), (layout.columns * 1.15 + 1) / (2 * tangent * width / height)) + 1.5
    cameraTarget.set(open ? 0 : -1.4, open ? 1.8 : 3.0, open ? Math.max(9, distance * .82) : distance)
    lookTarget.set(0, 1.8, 0)
    if (camera.position.distanceTo(cameraTarget) > .001 || look.distanceTo(lookTarget) > .001) moving = true
    camera.position.lerp(cameraTarget, damping); look.lerp(lookTarget, damping); camera.lookAt(look)
    frontRotation.copy(camera.quaternion)
    dragRotation.setFromEuler(dragEuler.set(pitch, yaw, -.025))
    frontRotation.multiply(dragRotation)
    syncShelves(layout.rows)
    shelves.forEach((shelf, row) => {
      const relative = row - position
      shelf.visible = relative >= -.5 && relative < layout.visibleRows - .5
      shelf.scale.x = layout.columns * 1.15 + .45
      shelf.position.set(0, cabinetRowY(row, layout.visibleRows, position) - 1.07, -.1)
    })
    for (const file of files) {
      const relative = Math.floor(file.index / layout.columns) - position
      file.home.set((file.index % layout.columns - (layout.columns - 1) / 2) * 1.15, cabinetRowY(Math.floor(file.index / layout.columns), layout.visibleRows, position), (file.index % layout.columns - (layout.columns - 1) / 2) * -.06)
      // Keep a card for every document; skip offscreen draw calls and raycasts.
      file.group.visible = (relative >= -.5 && relative < layout.visibleRows - .5) || file.progress > .001 || file.post.link === chosen
      const target = file.post.link === chosen ? 1 : 0
      const hoverTarget = file.post.link === hovered && !open ? .24 : 0
      file.progress += (target - file.progress) * damping
      file.hover += (hoverTarget - file.hover) * damping
      if (Math.abs(target - file.progress) < .0005) file.progress = target
      if (Math.abs(hoverTarget - file.hover) < .0005) file.hover = hoverTarget
      const t = file.progress
      // Slide clear of the neighbouring spines before rotating the cover forward.
      const pull = THREE.MathUtils.smoothstep(t, 0, .55)
      const approach = THREE.MathUtils.smoothstep(t, .45, 1)
      targetPosition.copy(file.home)
      targetPosition.z += pull * 1.9 + file.hover * 2
      targetPosition.lerp(extractedPosition, approach)
      targetPosition.y += Math.sin(t * Math.PI) * .12
      file.group.scale.setScalar(.72 + .28 * approach)
      targetRotation.copy(idleRotation).slerp(frontRotation, Math.max(approach, file.hover * 1.4))
      if (file.group.position.distanceTo(targetPosition) > .001 || file.group.quaternion.angleTo(targetRotation) > .001 || file.progress !== target || file.hover !== hoverTarget) moving = true
      file.group.position.copy(targetPosition)
      file.group.quaternion.slerp(targetRotation, reduced ? 1 : damping)
      file.glass.roughness = .12 - .07 * Math.max(approach, file.hover * 3)
      file.cover.position.z = .22 + .09 * approach + file.hover * .08
      // Keep the printed title outside the refractive cover throughout extraction.
      file.sticker.position.z = file.cover.position.z + .064
    }
    try { renderer.render(scene, camera) } catch (error) {
      console.warn("Archive rendering failed", error)
      setActive(false); onFailure(); return
    }
    if (moving && !reduced) frame = requestAnimationFrame(draw)
  }
  function wake() { if (!frame && active && !disposed) { last = performance.now(); frame = requestAnimationFrame(draw) } }
  function resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); wake() }
  function hit(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(assembly.children.filter(group => group.visible), true)[0]?.object.userData.file || null
  }
  function pointerDown(event) { down = { x: event.clientX, y: event.clientY, yaw, pitch, dragged: false, type: event.pointerType } }
  function pointerMove(event) {
    if (down && chosen && down.type === 'mouse') {
      const dx = event.clientX - down.x, dy = event.clientY - down.y
      down.dragged ||= Math.hypot(dx, dy) > 6
      yaw = THREE.MathUtils.clamp(down.yaw + dx * .006, -.6, .6)
      pitch = THREE.MathUtils.clamp(down.pitch + dy * .004, -.35, .35)
      wake(); return
    }
    if (event.pointerType === 'touch') return
    const next = hit(event)
    if (hovered !== next) { hovered = next; onHover?.(next); canvas.style.cursor = next ? 'pointer' : 'default'; wake() }
  }
  function pointerUp(event) {
    if (down?.type === 'touch' && Math.abs(event.clientY - down.y) > 35 && Math.abs(event.clientY - down.y) > Math.abs(event.clientX - down.x)) {
      onBrowse?.(event.clientY < down.y ? 1 : -1)
      down = null; return
    }
    if (down && !down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8) {
      const link = hit(event); if (link) onPick(link)
    }
    down = null
  }
  function pointerLeave() { down = null; hovered = null; onHover?.(null); canvas.style.cursor = 'default'; wake() }
  function wheel(event) {
    event.preventDefault()
    wheelDistance += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(wheelDistance) >= 45) { onBrowse?.(Math.sign(wheelDistance)); wheelDistance = 0 }
  }
  function contextLost(event) { event.preventDefault(); setActive(false); onFailure() }
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointerleave', pointerLeave)
  canvas.addEventListener('pointercancel', pointerLeave)
  canvas.addEventListener('webglcontextlost', contextLost)
  function setActive(value) { active = value; if (active) wake(); else { cancelAnimationFrame(frame); frame = 0 } }
  return {
    setFiles, setSelected, setFocus, resize, setActive,
    setReducedMotion(value) { reduced = value; wake() },
    setDark(value) { dark = value; files.forEach(file => file.labelMaterial.color.set(value ? 0xd1e0d7 : 0x26372f)); backMaterial.color.set(value ? 0x45524c : 0xe4e6df); white.color.set(value ? 0xb9c7bf : 0xdddcd2); floorMaterial.opacity = value ? .32 : .17; renderer.toneMappingExposure = value ? 1 : 1.25; wake() },
    dispose() {
      disposed = true; cancelAnimationFrame(frame)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointerleave', pointerLeave)
      canvas.removeEventListener('pointercancel', pointerLeave); canvas.removeEventListener('webglcontextlost', contextLost)
      clearFiles(); resources.forEach(resource => resource.dispose()); environment.dispose(); key.shadow.dispose(); renderer.dispose()
    },
  }
}
