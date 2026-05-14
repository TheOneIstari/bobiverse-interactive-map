import './styles/app.css';
import * as THREE from 'three';
import { AdditiveBlending } from 'three';
import { BOOKS, EVENTS, MAX_DISTANCE_FROM_SOL_LY, MAX_YEAR, MIN_YEAR, SCIENCE_AUDIT, SYSTEMS, type BobContact, type EventEntry, type SystemEntry } from './data/bobiverse';
import { cartesianDistanceLy, formatDistanceLy } from './data/spatialConventions';
import { clamp, formatEventDate, yearRangeLabel } from './utils/format';

interface Filters {
  maxSpoiler: number;
  year: number;
  faction: 'All' | SystemEntry['faction'];
  status: 'All' | SystemEntry['status'];
  search: string;
}

interface BobMovementStep {
  bob: BobContact;
  system: SystemEntry;
  year: number;
  bookIndex: number;
  summary: string;
}

const state: {
  filters: Filters;
  selectedId: string | null;
  selectedBobId: string | null;
  leftOpen: boolean;
  rightOpen: boolean;
  acceptedSpoilers: boolean;
} = {
  filters: {
    maxSpoiler: 2,
    year: MAX_YEAR,
    faction: 'All',
    status: 'All',
    search: '',
  },
  selectedId: 'sol',
  selectedBobId: null,
  leftOpen: false,
  rightOpen: false,
  acceptedSpoilers: false,
};

const pointColors: Record<SystemEntry['faction'], string> = {
  Bob: '#76c7ff',
  Human: '#ffe082',
  Pav: '#b388ff',
  Other: '#ff8a80',
  Unknown: '#b0bec5',
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root missing');

app.innerHTML = `
  <div class="spoiler-gate" id="spoiler-gate">
    <div class="spoiler-box">
      <div class="kicker">Mind the spoilers</div>
      <h1 class="h1">Choose how far into Bobiverse you’ve read</h1>
      <p class="muted spoiler-intro">The map reveals systems, arcs, and Bob details progressively. Pick a safe ceiling and you can raise it later.</p>
      <div class="spoiler-options" id="spoiler-options"></div>
      <div class="spoiler-actions row between wrap-on-mobile">
        <span class="muted small">Default start: <strong>For We Are Many</strong></span>
        <button id="enter-default">Launch map</button>
      </div>
    </div>
  </div>
  <div class="mobile-bar">
    <button class="menu-toggle" id="open-left" aria-label="Toggle filters" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <div class="mobile-title">
      <div class="kicker">Bobiverse</div>
      <strong>Story map</strong>
    </div>
    <button class="mobile-selection secondary" id="selection-summary">Pick a star</button>
  </div>
  <div class="app-shell">
    <aside class="panel" id="left-panel">
      <div class="panel-scroll" id="left-content"></div>
    </aside>
    <main class="canvas-wrap">
      <div id="scene-root"></div>
      <div class="canvas-overlay top">
        <div class="top-timeline-shell" id="top-timeline"></div>
      </div>
      <div class="canvas-tools" aria-label="Map camera controls">
        <button class="secondary tool-button" id="zoom-out" aria-label="Zoom out">−</button>
        <button class="secondary tool-button" id="zoom-reset" aria-label="Reset view">◎</button>
        <button class="secondary tool-button" id="zoom-in" aria-label="Zoom in">+</button>
        <div class="tool-hint muted small">Drag to orbit • pinch or use ± to zoom</div>
      </div>
      <div class="canvas-overlay bottom">
        <div class="floating-legend">
          <span><span class="dot" style="background:#76c7ff"></span> Bob space</span>
          <span><span class="dot" style="background:#ffe082"></span> Human systems</span>
          <span><span class="dot" style="background:#b388ff"></span> Pav contact</span>
          <span><span class="dot" style="background:#ff8a80"></span> Conflict / Others</span>
        </div>
      </div>
    </main>
    <aside class="panel right" id="right-panel">
      <div class="panel-scroll" id="right-content"></div>
    </aside>
  </div>
`;

const spoilerGate = document.querySelector<HTMLElement>('#spoiler-gate')!;
const spoilerOptions = document.querySelector<HTMLDivElement>('#spoiler-options')!;
const leftPanel = document.querySelector<HTMLElement>('#left-panel')!;
const rightPanel = document.querySelector<HTMLElement>('#right-panel')!;
const leftContent = document.querySelector<HTMLDivElement>('#left-content')!;
const rightContent = document.querySelector<HTMLDivElement>('#right-content')!;
const sceneRoot = document.querySelector<HTMLDivElement>('#scene-root')!;
const topTimeline = document.querySelector<HTMLDivElement>('#top-timeline')!;
const menuToggle = document.querySelector<HTMLButtonElement>('#open-left')!;
const selectionSummaryButton = document.querySelector<HTMLButtonElement>('#selection-summary')!;
const zoomInButton = document.querySelector<HTMLButtonElement>('#zoom-in');
const zoomOutButton = document.querySelector<HTMLButtonElement>('#zoom-out');
const zoomResetButton = document.querySelector<HTMLButtonElement>('#zoom-reset');

const systemById = new Map(SYSTEMS.map((system) => [system.id, system]));
const eventToSystem = (event: EventEntry) => event.systemId ? systemById.get(event.systemId) ?? null : null;

function syncPanelControls() {
  leftPanel.classList.toggle('open', state.leftOpen);
  rightPanel.classList.toggle('open', state.rightOpen);
  menuToggle.classList.toggle('open', state.leftOpen);
  menuToggle.setAttribute('aria-expanded', String(state.leftOpen));
}

document.querySelector<HTMLButtonElement>('#enter-default')?.addEventListener('click', () => {
  state.acceptedSpoilers = true;
  spoilerGate.style.display = 'none';
  render();
});

menuToggle.addEventListener('click', () => {
  state.leftOpen = !state.leftOpen;
  leftPanel.classList.toggle('open', state.leftOpen);
  menuToggle.classList.toggle('open', state.leftOpen);
  menuToggle.setAttribute('aria-expanded', String(state.leftOpen));
  if (state.leftOpen) {
    state.rightOpen = false;
    syncPanelControls();
  }
});

selectionSummaryButton.addEventListener('click', () => {
  if (!state.selectedId) return;
  state.rightOpen = !state.rightOpen;
  rightPanel.classList.toggle('open', state.rightOpen);
  if (state.rightOpen) {
    state.leftOpen = false;
    leftPanel.classList.toggle('open', false);
    menuToggle.classList.toggle('open', false);
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

zoomOutButton?.addEventListener('click', () => nudgeZoom(1));
zoomInButton?.addEventListener('click', () => nudgeZoom(-1));
zoomResetButton?.addEventListener('click', () => {
  const selection = state.selectedId ? systemById.get(state.selectedId) ?? null : null;
  if (selection) {
    focusSystem(selection);
    return;
  }
  resetCameraView();
});

BOOKS.forEach((book) => {
  const button = document.createElement('button');
  button.className = 'spoiler-option';
  button.innerHTML = `<strong>${book.label}</strong><span class="muted">Show material through spoiler level ${book.spoilerLevel}.</span>`;
  button.addEventListener('click', () => {
    state.filters.maxSpoiler = book.spoilerLevel;
    state.filters.year = clamp(state.filters.year, MIN_YEAR, MAX_YEAR);
    state.acceptedSpoilers = true;
    spoilerGate.style.display = 'none';
    render();
  });
  spoilerOptions.appendChild(button);
});

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040914, 0.0028);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
camera.position.set(0, 40, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const movementLineGroup = new THREE.Group();
scene.add(movementLineGroup);

function makeGlowTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context missing');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.98)');
  gradient.addColorStop(0.4, outer);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const starTexture = makeGlowTexture('rgba(255,255,255,1)', 'rgba(130,190,255,0.5)');
const milkyTexture = makeGlowTexture('rgba(255,245,255,0.9)', 'rgba(170,135,255,0.26)');

function makeStarfield(count: number, radiusLimit: number, spreadY: number, sizeRange: [number, number]) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = radiusLimit * Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
    const tint = Math.random();
    colors[i * 3] = 0.78 + tint * 0.22;
    colors[i * 3 + 1] = 0.83 + tint * 0.17;
    colors[i * 3 + 2] = 1;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: starTexture,
    size: THREE.MathUtils.randFloat(sizeRange[0], sizeRange[1]),
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

const starfieldNear = makeStarfield(1800, 520, 150, [1.2, 1.8]);
const starfieldFar = makeStarfield(1400, 900, 260, [0.45, 1]);
scene.add(starfieldFar, starfieldNear);

const milkyWayGeo = new THREE.BufferGeometry();
const milkyCount = 2600;
const milkyPositions = new Float32Array(milkyCount * 3);
const milkyColors = new Float32Array(milkyCount * 3);
for (let i = 0; i < milkyCount; i += 1) {
  const arm = Math.random() > 0.5 ? 1 : -1;
  const x = (Math.random() - 0.5) * 1200;
  const z = arm * (Math.random() ** 1.6) * 140 + (Math.random() - 0.5) * 50;
  const y = (Math.random() - 0.5) * 28;
  milkyPositions[i * 3] = x;
  milkyPositions[i * 3 + 1] = y;
  milkyPositions[i * 3 + 2] = z;
  milkyColors[i * 3] = 0.45 + Math.random() * 0.35;
  milkyColors[i * 3 + 1] = 0.45 + Math.random() * 0.24;
  milkyColors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
}
milkyWayGeo.setAttribute('position', new THREE.BufferAttribute(milkyPositions, 3));
milkyWayGeo.setAttribute('color', new THREE.BufferAttribute(milkyColors, 3));
const milkyWay = new THREE.Points(milkyWayGeo, new THREE.PointsMaterial({
  map: milkyTexture,
  size: 4.8,
  transparent: true,
  opacity: 0.2,
  vertexColors: true,
  blending: AdditiveBlending,
  depthWrite: false,
}));
milkyWay.rotation.x = -0.55;
milkyWay.rotation.z = 0.38;
scene.add(milkyWay);

const grid = new THREE.GridHelper(520, 16, 0x274567, 0x1b3048);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.1;
grid.position.y = -18;
scene.add(grid);

const nebulaMaterial = new THREE.MeshBasicMaterial({
  color: 0x6d9cff,
  transparent: true,
  opacity: 0.11,
  blending: AdditiveBlending,
  depthWrite: false,
});
const nebula = new THREE.Mesh(new THREE.PlaneGeometry(1100, 300), nebulaMaterial);
nebula.rotation.x = -Math.PI / 2.4;
nebula.rotation.z = 0.26;
nebula.position.set(0, -30, -40);
scene.add(nebula);

const halo = new THREE.Mesh(
  new THREE.RingGeometry(180, 310, 96),
  new THREE.MeshBasicMaterial({
    color: 0x8c72ff,
    transparent: true,
    opacity: 0.09,
    blending: AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
halo.rotation.x = Math.PI / 2;
halo.position.y = -8;
scene.add(halo);

const ambient = new THREE.AmbientLight(0xa9c8ff, 1.5);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(60, 90, 40);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8f7dff, 0.6);
rimLight.position.set(-120, 60, -80);
scene.add(rimLight);

const systemMeshes = new Map<string, THREE.Mesh>();
const labelSprites = new Map<string, THREE.Sprite>();
const systemGroup = new THREE.Group();
scene.add(systemGroup);

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context missing');
  ctx.fillStyle = 'rgba(4, 10, 18, 0.78)';
  ctx.strokeStyle = 'rgba(118, 199, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(6, 10, 244, 52, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ecf4ff';
  ctx.font = '600 28px Inter, sans-serif';
  ctx.fillText(text, 20, 46);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(20, 7.5, 1);
  return sprite;
}

SYSTEMS.forEach((system) => {
  const geometry = new THREE.SphereGeometry(system.status === 'conflict' ? 2.2 : 1.65, 18, 18);
  const material = new THREE.MeshStandardMaterial({
    color: pointColors[system.faction],
    emissive: pointColors[system.faction],
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.15,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(system.sceneX, system.sceneY, system.sceneZ);
  mesh.userData.systemId = system.id;
  systemMeshes.set(system.id, mesh);
  systemGroup.add(mesh);

  const label = makeLabel(system.name);
  label.position.set(system.sceneX, system.sceneY + 5, system.sceneZ);
  label.visible = false;
  labelSprites.set(system.id, label);
  systemGroup.add(label);
});

let isDragging = false;
let lastX = 0;
let lastY = 0;
const defaultCamera = { yaw: 0.28, pitch: 0.24, radius: 190 };
let yaw = defaultCamera.yaw;
let pitch = defaultCamera.pitch;
let radius = defaultCamera.radius;
let dragDistance = 0;

function updateCamera() {
  const x = Math.cos(yaw) * Math.cos(pitch) * radius;
  const y = Math.sin(pitch) * radius;
  const z = Math.sin(yaw) * Math.cos(pitch) * radius;
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}

function nudgeZoom(direction: 1 | -1) {
  radius = clamp(radius + direction * Math.max(12, radius * 0.14), 45, 900);
  updateCamera();
}

function resetCameraView() {
  yaw = defaultCamera.yaw;
  pitch = defaultCamera.pitch;
  radius = defaultCamera.radius;
  updateCamera();
}

updateCamera();

function updatePointer(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragDistance = 0;
  lastX = event.clientX;
  lastY = event.clientY;
  updatePointer(event);
  renderer.domElement.setPointerCapture(event.pointerId);
  if (event.pointerType === 'touch') return;
  isDragging = true;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  isDragging = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  updatePointer(event);
  if (event.pointerType === 'touch' && touchPoints.size > 1) return;
  if (!isDragging && event.pointerType !== 'touch') return;
  if (event.pointerType === 'touch' && touchPoints.size === 1) isDragging = true;
  if (!isDragging) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  dragDistance += Math.abs(dx) + Math.abs(dy);
  yaw -= dx * 0.005;
  pitch = clamp(pitch - dy * 0.005, -1.1, 1.1);
  lastX = event.clientX;
  lastY = event.clientY;
  updateCamera();
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  radius = clamp(radius + event.deltaY * Math.max(0.04, radius * 0.0012), 45, 900);
  updateCamera();
}, { passive: false });
renderer.domElement.addEventListener('click', () => {
  if (dragDistance > 10 || touchPoints.size > 0) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...systemMeshes.values()].filter((mesh) => mesh.visible));
  const first = hits[0];
  if (!first) return;
  state.selectedId = String(first.object.userData.systemId);
  const selectedSystem = systemById.get(state.selectedId);
  if (selectedSystem?.bobs[0]) state.selectedBobId = selectedSystem.bobs[0].id;
  state.leftOpen = false;
  state.rightOpen = true;
  syncPanelControls();
  render();
});

let pinchStartDistance = 0;
let pinchStartRadius = radius;
const touchPoints = new Map<number, PointerEvent>();
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  touchPoints.set(event.pointerId, event);
  if (touchPoints.size === 2) {
    const [a, b] = [...touchPoints.values()];
    pinchStartDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchStartRadius = radius;
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || !touchPoints.has(event.pointerId)) return;
  touchPoints.set(event.pointerId, event);
  if (touchPoints.size === 2) {
    isDragging = false;
    const [a, b] = [...touchPoints.values()];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchStartDistance > 0) {
      radius = clamp(pinchStartRadius - (distance - pinchStartDistance) * 0.26, 45, 900);
      updateCamera();
    }
  }
});
renderer.domElement.addEventListener('pointerup', (event) => {
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) pinchStartDistance = 0;
  if (touchPoints.size === 1) {
    const [touch] = [...touchPoints.values()];
    lastX = touch.clientX;
    lastY = touch.clientY;
  }
});
renderer.domElement.addEventListener('pointercancel', (event) => {
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) pinchStartDistance = 0;
});

function filteredSystems(): SystemEntry[] {
  const q = state.filters.search.trim().toLowerCase();
  return SYSTEMS.filter((system) => system.firstRelevantBook <= state.filters.maxSpoiler)
    .filter((system) => (eventsForSystem(system).some((event) => event.year <= state.filters.year) || system.id === 'sol'))
    .filter((system) => (state.filters.faction === 'All' ? true : system.faction === state.filters.faction))
    .filter((system) => (state.filters.status === 'All' ? true : system.status === state.filters.status))
    .filter((system) => {
      if (!q) return true;
      return [system.name, system.summary, system.positionSource, system.positionNotes ?? '', ...system.tags, ...system.inhabitants, ...system.bobs.map((bob) => bob.name)].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => a.firstRelevantBook - b.firstRelevantBook || a.name.localeCompare(b.name));
}

function currentSelection(systems: SystemEntry[]): SystemEntry | null {
  const existing = systems.find((system) => system.id === state.selectedId);
  if (existing) return existing;
  return systems[0] ?? null;
}

function eventsForSystem(system: SystemEntry) {
  return system.events.filter((event) => event.spoilerBookIndex <= state.filters.maxSpoiler);
}

function selectedBookLabel() {
  const active = [...BOOKS].reverse().find((book) => book.spoilerLevel <= state.filters.maxSpoiler) ?? BOOKS[0];
  return active?.shortLabel ?? `Book ${state.filters.maxSpoiler}`;
}

function relevantEvents() {
  return EVENTS.filter((event) => event.spoilerBookIndex <= state.filters.maxSpoiler && event.year <= state.filters.year);
}

function isCompactMobileViewport() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function visibleNearbyEvents(): EventEntry[] {
  const events = EVENTS.filter((event) => event.spoilerBookIndex <= state.filters.maxSpoiler);
  const limit = isCompactMobileViewport() ? 3 : 5;
  return events
    .slice()
    .sort((a, b) => Math.abs(a.year - state.filters.year) - Math.abs(b.year - state.filters.year) || a.year - b.year)
    .slice(0, limit)
    .sort((a, b) => a.year - b.year);
}

function movementForBob(bob: BobContact | null): BobMovementStep[] {
  if (!bob) return [];
  return bob.statusByBook
    .filter((row) => row.bookIndex <= state.filters.maxSpoiler)
    .map((row) => {
      const event = EVENTS.find((candidate) => candidate.systemId === row.systemId && candidate.bookIndex === row.bookIndex && candidate.participantIds.includes(bob.id));
      const system = row.systemId ? systemById.get(row.systemId) ?? null : null;
      if (!system) return null;
      return {
        bob,
        system,
        year: event?.year ?? MIN_YEAR + row.bookIndex * 6,
        bookIndex: row.bookIndex,
        summary: row.summary,
      } satisfies BobMovementStep;
    })
    .filter((item): item is BobMovementStep => Boolean(item))
    .sort((a, b) => a.year - b.year || a.bookIndex - b.bookIndex);
}

function activeInputSnapshot() {
  const active = document.activeElement as HTMLInputElement | HTMLSelectElement | null;
  if (!active?.id) return null;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLSelectElement)) return null;
  return {
    id: active.id,
    start: active instanceof HTMLInputElement ? active.selectionStart : null,
    end: active instanceof HTMLInputElement ? active.selectionEnd : null,
  };
}

function restoreActiveInput(snapshot: ReturnType<typeof activeInputSnapshot>) {
  if (!snapshot) return;
  const next = document.getElementById(snapshot.id) as HTMLInputElement | HTMLSelectElement | null;
  if (!next) return;
  next.focus({ preventScroll: true });
  if (next instanceof HTMLInputElement && snapshot.start != null && snapshot.end != null) {
    next.setSelectionRange(snapshot.start, snapshot.end);
  }
}

function renderTopTimeline(selection: SystemEntry | null) {
  const compactMobile = isCompactMobileViewport();
  const currentYearPct = ((state.filters.year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
  const events = visibleNearbyEvents();
  const currentEvents = relevantEvents();
  const visibleSystemCount = filteredSystems().length;
  const primaryBob = selection?.bobs.find((bob) => bob.id === state.selectedBobId) ?? selection?.bobs[0] ?? null;
  const bobMovement = movementForBob(primaryBob);
  const bobNow = [...bobMovement].reverse().find((step) => step.year <= state.filters.year) ?? bobMovement[0] ?? null;
  const timelineSubcopy = compactMobile
    ? `${currentEvents.length} events • ${selection?.name ?? 'No system selected'}`
    : `${selectedBookLabel()} spoiler ceiling • ${currentEvents.length} visible events • ${selection?.name ?? 'No system selected'}`;
  const bobBadge = bobNow
    ? (compactMobile ? `${bobNow.bob.name} → ${bobNow.system.name}` : `${bobNow.bob.name} → ${bobNow.system.name}`)
    : 'Tap a star to open details';

  topTimeline.innerHTML = `
    <div class="top-timeline card ${compactMobile ? 'compact-mobile' : ''}">
      <div class="timeline-head row between wrap-on-mobile">
        <div class="timeline-title-block">
          <div class="kicker">Slide the story timeline</div>
          <div class="timeline-year-row">
            <div class="timeline-year">${state.filters.year}</div>
            <span class="badge active-badge mobile-year-badge">${selectedBookLabel()}</span>
          </div>
          <div class="muted small timeline-subcopy">${timelineSubcopy}</div>
        </div>
        <div class="timeline-head-stats">
          <span class="badge active-badge desktop-only-badge">Year ${state.filters.year}</span>
          <span class="badge">Systems ${selection ? visibleSystemCount : 0}</span>
          <span class="badge timeline-bob-badge">${bobBadge}</span>
        </div>
      </div>
      <div class="timeline-track-wrap">
        <div class="timeline-track-bar">
          <div class="timeline-progress" style="width:${currentYearPct}%"></div>
          <div class="timeline-markers">
            ${BOOKS.map((book) => {
              const pct = ((Math.min(MAX_YEAR, Math.max(MIN_YEAR, book.spoilerLevel === 1 ? MIN_YEAR : EVENTS.filter((event) => event.bookIndex <= book.spoilerLevel).at(-1)?.year ?? MAX_YEAR)) - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
              return `<button class="timeline-marker ${book.spoilerLevel <= state.filters.maxSpoiler ? 'active' : ''}" data-book="${book.spoilerLevel}" style="left:${pct}%" title="${book.label}">${book.shortLabel}</button>`;
            }).join('')}
          </div>
          <div class="timeline-year-pin" style="left:${currentYearPct}%"></div>
        </div>
        <input type="range" id="top-year" min="${MIN_YEAR}" max="${MAX_YEAR}" step="1" value="${state.filters.year}" />
      </div>
      <div class="timeline-event-strip-label muted small">Nearest visible beats</div>
      <div class="timeline-event-strip">
        ${events.map((event) => {
          const system = eventToSystem(event);
          const active = event.year === state.filters.year ? 'active' : '';
          return `<button class="timeline-event-pill ${active}" data-year="${event.year}" data-system="${system?.id ?? ''}"><strong>${event.year}</strong><span>${event.title}</span></button>`;
        }).join('')}
      </div>
    </div>
  `;

  topTimeline.querySelector<HTMLInputElement>('#top-year')?.addEventListener('input', (event) => {
    state.filters.year = Number((event.target as HTMLInputElement).value);
    render();
  });
  topTimeline.querySelectorAll<HTMLButtonElement>('.timeline-marker').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.maxSpoiler = Number(button.dataset.book);
      render();
    });
  });
  topTimeline.querySelectorAll<HTMLButtonElement>('.timeline-event-pill').forEach((button) => {
    button.addEventListener('click', () => {
      const year = Number(button.dataset.year);
      const systemId = button.dataset.system || null;
      state.filters.year = year;
      if (systemId) {
        state.selectedId = systemId;
        focusSystem(systemById.get(systemId)!);
        state.rightOpen = true;
        rightPanel.classList.toggle('open', true);
      }
      render();
    });
  });
}

function renderFilters(systems: SystemEntry[]) {
  const factions = ['All', 'Bob', 'Human', 'Pav', 'Other', 'Unknown'] as const;
  const statuses = ['All', 'colony', 'expedition', 'conflict', 'discovery', 'relay', 'homeworld', 'megastructure', 'deep-space', 'other'] as const;
  const visibleEvents = relevantEvents();
  leftContent.innerHTML = `
    <div class="kicker">Navigation</div>
    <h1 class="h1">Bobiverse interactive map</h1>
    <p class="muted">Story map with grounded Sol-distance data, clearer timeline state, and mobile-friendly controls.</p>

    <div class="card stack">
      <div class="stats-grid">
        <div class="stat"><span class="muted small">Visible systems</span><strong>${systems.length}</strong></div>
        <div class="stat"><span class="muted small">Visible events</span><strong>${visibleEvents.length}</strong></div>
        <div class="stat"><span class="muted small">Current year</span><strong>${state.filters.year}</strong></div>
        <div class="stat"><span class="muted small">Max Sol distance</span><strong>${formatDistanceLy(MAX_DISTANCE_FROM_SOL_LY)}</strong></div>
      </div>
      <label>
        Search names, tags, Bobs
        <input type="search" id="search" value="${state.filters.search}" placeholder="Sol, Howard, Pav, topopolis..." autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
      <label>
        Timeline year
        <input type="range" id="year" min="${MIN_YEAR}" max="${MAX_YEAR}" step="1" value="${state.filters.year}" />
        <div class="row between"><span class="badge active-badge">${state.filters.year}</span><span class="muted small">Range ${yearRangeLabel(SYSTEMS)}</span></div>
      </label>
      <div class="filter-grid">
        <label>
          Spoiler ceiling
          <select id="spoiler">
            ${BOOKS.map((book) => `<option value="${book.spoilerLevel}" ${book.spoilerLevel === state.filters.maxSpoiler ? 'selected' : ''}>${book.label}</option>`).join('')}
          </select>
        </label>
        <label>
          Faction
          <select id="faction">
            ${factions.map((faction) => `<option value="${faction}" ${state.filters.faction === faction ? 'selected' : ''}>${faction}</option>`).join('')}
          </select>
        </label>
        <label>
          Status
          <select id="status">
            ${statuses.map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="muted small">${SCIENCE_AUDIT.farFieldCompression}</div>
      <div class="row between wrap-on-mobile">
        <button class="secondary" id="reset-filters">Reset filters</button>
        <span class="muted small">Top timeline mirrors this same story year.</span>
      </div>
    </div>

    <div class="card">
      <div class="row between wrap-on-mobile"><strong>System index</strong><span class="muted small">Tap list or stars</span></div>
      <div class="system-list" id="system-list"></div>
    </div>
  `;

  leftContent.querySelector<HTMLInputElement>('#search')?.addEventListener('input', (event) => {
    state.filters.search = (event.target as HTMLInputElement).value;
    render();
  });
  leftContent.querySelector<HTMLInputElement>('#year')?.addEventListener('input', (event) => {
    state.filters.year = Number((event.target as HTMLInputElement).value);
    render();
  });
  leftContent.querySelector<HTMLSelectElement>('#spoiler')?.addEventListener('change', (event) => {
    state.filters.maxSpoiler = Number((event.target as HTMLSelectElement).value);
    render();
  });
  leftContent.querySelector<HTMLSelectElement>('#faction')?.addEventListener('change', (event) => {
    state.filters.faction = (event.target as HTMLSelectElement).value as Filters['faction'];
    render();
  });
  leftContent.querySelector<HTMLSelectElement>('#status')?.addEventListener('change', (event) => {
    state.filters.status = (event.target as HTMLSelectElement).value as Filters['status'];
    render();
  });
  leftContent.querySelector<HTMLButtonElement>('#reset-filters')?.addEventListener('click', () => {
    state.filters = { maxSpoiler: 2, year: MAX_YEAR, faction: 'All', status: 'All', search: '' };
    render();
  });

  const systemList = leftContent.querySelector<HTMLDivElement>('#system-list');
  systems.forEach((system) => {
    const latestEvent = eventsForSystem(system).filter((event) => event.year <= state.filters.year).at(-1);
    const button = document.createElement('button');
    button.className = `system-item ${state.selectedId === system.id ? 'active' : ''}`;
    button.innerHTML = `<h3>${system.name}</h3><div class="row between wrap-on-mobile"><span class="muted small">${formatDistanceLy(system.trueDistanceFromSolLy)} • ${system.positionQuality}</span><span class="badge">${system.status}</span></div><div class="system-meta">${latestEvent ? `${latestEvent.year}: ${latestEvent.title}` : 'No event yet at current year'}</div>`;
    button.addEventListener('click', () => {
      state.selectedId = system.id;
      state.rightOpen = true;
      state.leftOpen = false;
      if (system.bobs[0]) state.selectedBobId = system.bobs[0].id;
      focusSystem(system);
      render();
    });
    systemList?.appendChild(button);
  });
}

function renderDetails(selection: SystemEntry | null) {
  if (!selection) {
    rightContent.innerHTML = `<div class="details-empty">No systems match the current filter stack. Try widening the timeline or spoiler ceiling.</div>`;
    return;
  }

  const sol = SYSTEMS.find((system) => system.id === 'sol')!;
  const distanceCheck = formatDistanceLy(cartesianDistanceLy(
    { xLy: selection.x, yLy: selection.z, zLy: selection.y },
    { xLy: sol.x, yLy: sol.z, zLy: sol.y },
  ));
  const visibleEvents = eventsForSystem(selection).filter((event) => event.year <= state.filters.year);
  const selectedBob = selection.bobs.find((bob) => bob.id === state.selectedBobId) ?? selection.bobs[0] ?? null;
  const bobMovement = movementForBob(selectedBob);
  const currentLocation = [...bobMovement].reverse().find((step) => step.year <= state.filters.year) ?? bobMovement[0] ?? null;

  rightContent.innerHTML = `
    <div class="kicker">Selected system</div>
    <h2 class="h1">${selection.name}</h2>
    <div class="badges">
      <span class="badge">Book ${selection.firstRelevantBook}</span>
      <span class="badge">${selection.faction}</span>
      <span class="badge">${selection.status}</span>
      <span class="badge">${selection.positionQuality}</span>
    </div>

    <div class="card stack">
      <p>${selection.summary}</p>
      <div class="info-grid">
        <div><strong>Current story year</strong><p class="muted small">${state.filters.year}</p></div>
        <div><strong>Latest visible event</strong><p class="muted small">${visibleEvents.at(-1)?.title ?? 'Nothing visible yet at this year'}</p></div>
        <div><strong>Inhabitants</strong><p class="muted small">${selection.inhabitants.join(' • ') || 'No non-Bob inhabitants linked in the current dataset.'}</p></div>
        <div><strong>True Sol distance</strong><p class="muted small">${formatDistanceLy(selection.trueDistanceFromSolLy)}${Math.abs(selection.trueDistanceFromSolLy - parseFloat(distanceCheck)) > 0.15 ? ` • Cartesian check ${distanceCheck}` : ''}</p></div>
        <div><strong>True coordinates</strong><p class="muted small">x ${selection.x.toFixed(2)} • y ${selection.y.toFixed(2)} • z ${selection.z.toFixed(2)} ly</p></div>
        <div><strong>Scene coordinates</strong><p class="muted small">x ${selection.sceneX.toFixed(2)} • y ${selection.sceneY.toFixed(2)} • z ${selection.sceneZ.toFixed(2)}${selection.isSceneCompressed ? ' • compressed for overview navigation' : ''}</p></div>
      </div>
      <div><strong>Spatial provenance</strong><p class="muted small">${selection.positionSource}</p></div>
      <div><strong>Notes</strong><p class="muted small">${selection.positionNotes ?? 'No extra spatial notes.'}</p></div>
      <div><strong>Uncertainty</strong><p class="muted small">${selection.distanceUncertaintyLy != null ? `±${selection.distanceUncertaintyLy.toFixed(2)} ly` : 'Not stated'}</p></div>
      <div>
        <strong>Tags</strong>
        <div class="badges">${selection.tags.map((tag) => `<span class="badge">${tag}</span>`).join('')}</div>
      </div>
      <div class="row wrap-on-mobile">
        <button id="focus-system">Focus in map</button>
        <button class="secondary" id="jump-current-bob">Track selected Bob</button>
        <button class="secondary" id="close-right">Close</button>
      </div>
    </div>

    <div class="card">
      <div class="row between wrap-on-mobile"><strong>Bob activity</strong><span class="muted small">${selection.bobs.length} entries</span></div>
      <div class="badges bob-chips">
        ${selection.bobs.map((bob) => `<button class="badge bob-chip ${state.selectedBobId === bob.id ? 'chip-active' : ''}" data-bob="${bob.id}">${bob.name} <span class="muted">gen ${bob.generation}</span></button>`).join('') || '<span class="muted small">No Bob contacts in this system.</span>'}
      </div>
      ${selectedBob ? `
        <div class="bob-card timeline-card">
          <div class="row between wrap-on-mobile"><strong>${selectedBob.name}</strong><span class="badge">${currentLocation ? `${currentLocation.system.name} in ${currentLocation.year}` : 'Movement data partial'}</span></div>
          <div class="muted small">${selectedBob.lineage}</div>
          <div class="timeline-list dense">
            ${bobMovement.map((step) => `<div class="timeline-item static ${currentLocation?.year === step.year && currentLocation.system.id === step.system.id ? 'active-badge' : ''}"><div class="row between wrap-on-mobile"><strong>${step.year}</strong><span class="badge">${step.system.name}</span></div><p class="small">${step.summary}</p></div>`).join('') || '<p class="muted small">No mapable movement records for this Bob in the current spoiler range.</p>'}
          </div>
        </div>` : ''}
    </div>

    <div class="card">
      <div class="row between wrap-on-mobile"><strong>Visible timeline events</strong><span class="muted small">${visibleEvents.length} entries</span></div>
      <div class="bob-list">
        ${visibleEvents.slice(-8).reverse().map((event) => `
          <div class="bob-card">
            <div class="row between wrap-on-mobile"><strong>${formatEventDate(event.year, event.month, event.day)}</strong><span class="badge">book ${event.bookIndex}</span></div>
            <p class="small">${event.summary}</p>
          </div>
        `).join('') || '<p class="muted small">No visible events for the current filter year/spoiler ceiling.</p>'}
      </div>
    </div>
  `;

  rightContent.querySelector<HTMLButtonElement>('#focus-system')?.addEventListener('click', () => focusSystem(selection));
  rightContent.querySelector<HTMLButtonElement>('#jump-current-bob')?.addEventListener('click', () => {
    if (currentLocation) focusSystem(currentLocation.system);
  });
  rightContent.querySelector<HTMLButtonElement>('#close-right')?.addEventListener('click', () => {
    state.rightOpen = false;
    syncPanelControls();
  });
  rightContent.querySelectorAll<HTMLButtonElement>('.bob-chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedBobId = button.dataset.bob ?? null;
      render();
    });
  });
}

function focusSystem(system: SystemEntry) {
  const desiredYaw = Math.atan2(system.sceneZ, system.sceneX);
  const flatDistance = Math.max(20, Math.hypot(system.sceneX, system.sceneZ));
  yaw = desiredYaw - 0.42;
  pitch = clamp(Math.atan2(system.sceneY + 8, flatDistance), -0.8, 0.8);
  radius = clamp(Math.hypot(system.sceneX, system.sceneY, system.sceneZ) + (system.isSceneCompressed ? 70 : 45), 60, 900);
  updateCamera();
}

function rebuildMovementLines(selection: SystemEntry | null) {
  movementLineGroup.clear();
  if (!selection) return;
  const bob = selection.bobs.find((entry) => entry.id === state.selectedBobId) ?? selection.bobs[0] ?? null;
  const movement = movementForBob(bob).filter((step) => step.year <= state.filters.year);
  if (movement.length < 2) return;

  const points = movement.map((step) => new THREE.Vector3(step.system.sceneX, step.system.sceneY, step.system.sceneZ));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x9fe2ff, transparent: true, opacity: 0.98 });
  const line = new THREE.Line(geometry, material);
  movementLineGroup.add(line);

  const glowMaterial = new THREE.LineBasicMaterial({ color: 0x4db7ff, transparent: true, opacity: 0.36 });
  const glowLine = new THREE.Line(geometry, glowMaterial);
  glowLine.scale.setScalar(1.002);
  movementLineGroup.add(glowLine);

  movement.forEach((step, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(index === movement.length - 1 ? 1.7 : 1.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: index === movement.length - 1 ? 0xfff0a5 : 0x8dd6ff }),
    );
    marker.position.set(step.system.sceneX, step.system.sceneY, step.system.sceneZ);
    movementLineGroup.add(marker);

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(index === movement.length - 1 ? 3.4 : 2.4, 16, 16),
      new THREE.MeshBasicMaterial({ color: index === movement.length - 1 ? 0xffd76a : 0x57c1ff, transparent: true, opacity: index === movement.length - 1 ? 0.2 : 0.12 }),
    );
    pulse.position.copy(marker.position);
    movementLineGroup.add(pulse);
  });
}

function updateScene(systems: SystemEntry[], selection: SystemEntry | null) {
  const visibleIds = new Set(systems.map((system) => system.id));
  systemMeshes.forEach((mesh, id) => {
    const system = systemById.get(id)!;
    mesh.visible = visibleIds.has(id);
    const material = mesh.material as THREE.MeshStandardMaterial;
    const isSelected = selection?.id === id;
    material.emissiveIntensity = isSelected ? 1.08 : 0.55;
    const pulse = 1 + Math.sin(performance.now() * 0.0018 + system.sceneX * 0.2) * (isSelected ? 0.16 : 0.08);
    mesh.scale.setScalar((isSelected ? 1.35 : 1) * pulse);
    mesh.rotation.y += isSelected ? 0.04 : 0.01;
  });
  labelSprites.forEach((sprite, id) => {
    const shouldShow = selection?.id === id || (visibleIds.has(id) && radius < 120);
    sprite.visible = shouldShow;
  });
  rebuildMovementLines(selection);
}

function resize() {
  const { clientWidth, clientHeight } = sceneRoot;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function render() {
  const snapshot = activeInputSnapshot();
  const systems = filteredSystems();
  const selection = currentSelection(systems);
  state.selectedId = selection?.id ?? null;
  if (selection && !selection.bobs.some((bob) => bob.id === state.selectedBobId)) {
    state.selectedBobId = selection.bobs[0]?.id ?? null;
  }
  renderTopTimeline(selection);
  renderFilters(systems);
  renderDetails(selection);
  selectionSummaryButton.textContent = selection ? `${selection.name}${state.selectedBobId ? ` • ${selection.bobs.find((bob) => bob.id === state.selectedBobId)?.name ?? 'Details'}` : ''}` : 'Pick a star';
  syncPanelControls();
  updateScene(systems, selection);
  restoreActiveInput(snapshot);
}

function animate() {
  requestAnimationFrame(animate);
  starfieldNear.rotation.y += 0.00022;
  starfieldFar.rotation.y += 0.00005;
  milkyWay.rotation.y += 0.00008;
  nebula.rotation.z += 0.00012;
  halo.rotation.z -= 0.00018;
  systemGroup.rotation.y += 0.00038;
  movementLineGroup.rotation.y = systemGroup.rotation.y;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...systemMeshes.values()].filter((mesh) => mesh.visible));
  document.body.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  renderer.render(scene, camera);
}

render();
animate();
