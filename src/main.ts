import './styles/app.css';
import * as THREE from 'three';
import { BOOKS, EVENTS, MAX_DISTANCE_FROM_SOL_LY, MAX_YEAR, MIN_YEAR, SCIENCE_AUDIT, SYSTEMS, type SystemEntry } from './data/bobiverse';
import { cartesianDistanceLy, formatDistanceLy } from './data/spatialConventions';
import { clamp, yearRangeLabel } from './utils/format';

interface Filters {
  maxSpoiler: number;
  year: number;
  faction: 'All' | SystemEntry['faction'];
  status: 'All' | SystemEntry['status'];
  search: string;
}

const state: {
  filters: Filters;
  selectedId: string | null;
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
      <p class="muted">The map reveals systems, arcs, and Bob details progressively. Pick a safe ceiling and you can raise it later.</p>
      <div class="spoiler-options" id="spoiler-options"></div>
      <div class="row between">
        <span class="muted small">Default start: <strong>For We Are Many</strong></span>
        <button id="enter-default">Launch map</button>
      </div>
    </div>
  </div>
  <div class="mobile-bar">
    <button class="mobile-toggle secondary" id="open-left">Filters</button>
    <strong>Bobiverse Map</strong>
    <button class="mobile-toggle secondary" id="open-right">Details</button>
  </div>
  <div class="app-shell">
    <aside class="panel" id="left-panel">
      <div class="panel-scroll" id="left-content"></div>
    </aside>
    <main class="canvas-wrap">
      <div id="scene-root"></div>
      <div class="canvas-overlay">
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

document.querySelector<HTMLButtonElement>('#enter-default')?.addEventListener('click', () => {
  state.acceptedSpoilers = true;
  spoilerGate.style.display = 'none';
  render();
});

document.querySelector<HTMLButtonElement>('#open-left')?.addEventListener('click', () => {
  state.leftOpen = !state.leftOpen;
  leftPanel.classList.toggle('open', state.leftOpen);
});
document.querySelector<HTMLButtonElement>('#open-right')?.addEventListener('click', () => {
  state.rightOpen = !state.rightOpen;
  rightPanel.classList.toggle('open', state.rightOpen);
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
scene.fog = new THREE.FogExp2(0x050912, 0.0032);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
camera.position.set(0, 40, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const starGeo = new THREE.BufferGeometry();
const starCount = 1400;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const radius = 420 * Math.random();
  const theta = Math.random() * Math.PI * 2;
  const spread = (Math.random() - 0.5) * 80;
  starPositions[i * 3] = Math.cos(theta) * radius;
  starPositions[i * 3 + 1] = spread * 0.25;
  starPositions[i * 3 + 2] = Math.sin(theta) * radius;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starfield = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.65 }));
scene.add(starfield);

const grid = new THREE.GridHelper(520, 16, 0x274567, 0x1b3048);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.35;
scene.add(grid);

const ambient = new THREE.AmbientLight(0xa9c8ff, 1.4);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(60, 90, 40);
scene.add(keyLight);

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
  const geometry = new THREE.SphereGeometry(system.status === 'conflict' ? 2.2 : 1.65, 16, 16);
  const material = new THREE.MeshStandardMaterial({ color: pointColors[system.faction], emissive: pointColors[system.faction], emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.15 });
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
let yaw = 0.28;
let pitch = 0.24;
let radius = 190;

function updateCamera() {
  const x = Math.cos(yaw) * Math.cos(pitch) * radius;
  const y = Math.sin(pitch) * radius;
  const z = Math.sin(yaw) * Math.cos(pitch) * radius;
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}
updateCamera();

renderer.domElement.addEventListener('pointerdown', (event) => {
  isDragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
});
window.addEventListener('pointerup', () => {
  isDragging = false;
});
window.addEventListener('pointermove', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  if (!isDragging) return;
  yaw -= (event.clientX - lastX) * 0.005;
  pitch = clamp(pitch - (event.clientY - lastY) * 0.005, -1.1, 1.1);
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
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...systemMeshes.values()]);
  const first = hits[0];
  if (!first) return;
  state.selectedId = String(first.object.userData.systemId);
  state.rightOpen = true;
  rightPanel.classList.toggle('open', state.rightOpen);
  render();
});

function filteredSystems(): SystemEntry[] {
  const q = state.filters.search.trim().toLowerCase();
  return SYSTEMS.filter((system) => system.firstRelevantBook <= state.filters.maxSpoiler)
    .filter((system) => (eventsForSystem(system).some((event) => event.year <= state.filters.year) || system.id === 'sol'))
    .filter((system) => state.filters.faction === 'All' ? true : system.faction === state.filters.faction)
    .filter((system) => state.filters.status === 'All' ? true : system.status === state.filters.status)
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

function renderFilters(systems: SystemEntry[]) {
  const factions = ['All', 'Bob', 'Human', 'Pav', 'Other', 'Unknown'] as const;
  const statuses = ['All', 'colony', 'expedition', 'conflict', 'discovery', 'relay', 'homeworld', 'megastructure', 'deep-space', 'other'] as const;
  const visibleEvents = EVENTS.filter((event) => event.spoilerBookIndex <= state.filters.maxSpoiler && event.year <= state.filters.year);
  leftContent.innerHTML = `
    <div class="kicker">Navigation</div>
    <h1 class="h1">Bobiverse interactive map</h1>
    <p class="muted">Three-dimensional story map with physically grounded Sol-distance data, provenance notes, and scene compression only where galaxy-scale context would otherwise wreck usability.</p>

    <div class="card stack">
      <div class="row between"><strong>Visible systems</strong><span class="badge">${systems.length}</span></div>
      <div class="row between"><strong>Visible events</strong><span class="badge">${visibleEvents.length}</span></div>
      <div class="row between"><strong>Max Sol distance</strong><span class="badge">${formatDistanceLy(MAX_DISTANCE_FROM_SOL_LY)}</span></div>
      <label>
        Search names, tags, Bobs
        <input type="search" id="search" value="${state.filters.search}" placeholder="Sol, Howard, Pav, topopolis..." />
      </label>
      <label>
        Timeline year: <strong>${state.filters.year}</strong>
        <input type="range" id="year" min="${MIN_YEAR}" max="${MAX_YEAR}" step="1" value="${state.filters.year}" />
      </label>
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
      <div class="muted small">${SCIENCE_AUDIT.farFieldCompression}</div>
      <div class="row between">
        <button class="secondary" id="reset-filters">Reset filters</button>
        <span class="muted small">Range ${yearRangeLabel(systems)}</span>
      </div>
    </div>

    <div class="card">
      <div class="row between"><strong>System index</strong><span class="muted small">Tap list or stars</span></div>
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
    const button = document.createElement('button');
    button.className = `system-item ${state.selectedId === system.id ? 'active' : ''}`;
    button.innerHTML = `<h3>${system.name}</h3><div class="row between"><span class="muted small">${formatDistanceLy(system.trueDistanceFromSolLy)} • ${system.positionQuality}</span><span class="badge">${system.status}</span></div>`;
    button.addEventListener('click', () => {
      state.selectedId = system.id;
      state.rightOpen = true;
      rightPanel.classList.toggle('open', state.rightOpen);
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
      <div><strong>Inhabitants</strong><p class="muted small">${selection.inhabitants.join(' • ') || 'No non-Bob inhabitants linked in the current dataset.'}</p></div>
      <div><strong>True Sol distance</strong><p class="muted small">${formatDistanceLy(selection.trueDistanceFromSolLy)}${Math.abs(selection.trueDistanceFromSolLy - parseFloat(distanceCheck)) > 0.15 ? ` • Cartesian check ${distanceCheck}` : ''}</p></div>
      <div><strong>True coordinates</strong><p class="muted small">x ${selection.x.toFixed(2)} • y ${selection.y.toFixed(2)} • z ${selection.z.toFixed(2)} ly</p></div>
      <div><strong>Scene coordinates</strong><p class="muted small">x ${selection.sceneX.toFixed(2)} • y ${selection.sceneY.toFixed(2)} • z ${selection.sceneZ.toFixed(2)}${selection.isSceneCompressed ? ' • compressed for overview navigation' : ''}</p></div>
      <div><strong>Spatial provenance</strong><p class="muted small">${selection.positionSource}</p></div>
      <div><strong>Notes</strong><p class="muted small">${selection.positionNotes ?? 'No extra spatial notes.'}</p></div>
      <div><strong>Uncertainty</strong><p class="muted small">${selection.distanceUncertaintyLy != null ? `±${selection.distanceUncertaintyLy.toFixed(2)} ly` : 'Not stated'}</p></div>
      <div>
        <strong>Tags</strong>
        <div class="badges">${selection.tags.map((tag) => `<span class="badge">${tag}</span>`).join('')}</div>
      </div>
      <div class="row">
        <button id="focus-system">Focus in map</button>
        <button class="secondary" id="close-right">Close</button>
      </div>
    </div>

    <div class="card">
      <div class="row between"><strong>Bob activity</strong><span class="muted small">${selection.bobs.length} entries</span></div>
      <div class="bob-list">
        ${selection.bobs.map((bob) => `
          <div class="bob-card">
            <div class="row between"><strong>${bob.name}</strong><span class="badge">gen ${bob.generation}</span></div>
            <div class="muted small">${bob.lineage}</div>
            <p class="small">${bob.statusByBook.slice(0, 2).map((row) => row.summary).join(' ') || 'No timeline status rows attached.'}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="row between"><strong>Visible timeline events</strong><span class="muted small">${visibleEvents.length} entries</span></div>
      <div class="bob-list">
        ${visibleEvents.slice(0, 6).map((event) => `
          <div class="bob-card">
            <div class="row between"><strong>${event.year}</strong><span class="badge">book ${event.bookIndex}</span></div>
            <p class="small">${event.summary}</p>
          </div>
        `).join('') || '<p class="muted small">No visible events for the current filter year/spoiler ceiling.</p>'}
      </div>
    </div>
  `;

  rightContent.querySelector<HTMLButtonElement>('#focus-system')?.addEventListener('click', () => focusSystem(selection));
  rightContent.querySelector<HTMLButtonElement>('#close-right')?.addEventListener('click', () => {
    state.rightOpen = false;
    rightPanel.classList.toggle('open', false);
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

function updateScene(systems: SystemEntry[], selection: SystemEntry | null) {
  const visibleIds = new Set(systems.map((system) => system.id));
  systemMeshes.forEach((mesh, id) => {
    const system = SYSTEMS.find((item) => item.id === id)!;
    mesh.visible = visibleIds.has(id);
    const material = mesh.material as THREE.MeshStandardMaterial;
    const isSelected = selection?.id === id;
    material.emissiveIntensity = isSelected ? 0.95 : 0.45;
    mesh.scale.setScalar(isSelected ? 1.6 : 1);
    mesh.rotation.y += isSelected ? 0.04 : 0.01;
    const pulse = 1 + Math.sin(performance.now() * 0.002 + system.sceneX) * 0.08;
    mesh.scale.multiplyScalar(pulse);
  });
  labelSprites.forEach((sprite, id) => {
    const shouldShow = selection?.id === id || (visibleIds.has(id) && radius < 120);
    sprite.visible = shouldShow;
  });
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
  const systems = filteredSystems();
  const selection = currentSelection(systems);
  state.selectedId = selection?.id ?? null;
  renderFilters(systems);
  renderDetails(selection);
  updateScene(systems, selection);
}

function animate() {
  requestAnimationFrame(animate);
  starfield.rotation.y += 0.00018;
  systemGroup.rotation.y += 0.00045;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...systemMeshes.values()].filter((mesh) => mesh.visible));
  document.body.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  renderer.render(scene, camera);
}

render();
animate();
