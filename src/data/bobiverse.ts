import rawDataset from '../../bobiverse_dataset.json';
import { cartesianDistanceLy, galacticToCartesian, type PositionQuality, type SourceFrame } from './spatialConventions';
import { referenceSystems } from './referenceSystems';

export type Certainty = 'high' | 'medium' | 'low';
export type Faction = 'Bob' | 'Human' | 'Pav' | 'Other' | 'Unknown';
export type Status = 'colony' | 'expedition' | 'conflict' | 'discovery' | 'relay' | 'homeworld' | 'megastructure' | 'deep-space' | 'other';

interface RawBook {
  book_index: number;
  id: string;
  title: string;
  short_title: string;
  spoiler_label: string;
}

interface RawSystem {
  id: string;
  name: string;
  type?: string;
  parent_system_id?: string | null;
  distance_from_sol_ly?: number | null;
  first_relevant_book: number;
  tags: string[];
  summary: string;
  certainty: Certainty;
}

interface RawBob {
  id: string;
  name: string;
  aka?: string[];
  generation: number;
  origin_bob_id?: string | null;
  origin_human?: string | null;
  created?: { year?: number; month?: number; day?: number; system_id?: string | null };
  first_book: number;
  lineage_note: string;
  known_children_ids?: string[];
  primary_system_ids?: string[];
  certainty: Certainty;
}

interface RawNonBobEntity {
  id: string;
  name: string;
  type: string;
  first_book: number;
  system_ids?: string[];
  summary: string;
  certainty: Certainty;
}

interface RawEvent {
  id: string;
  year: number;
  month?: number | null;
  day?: number | null;
  date_precision: string;
  book_index: number;
  spoiler_book_index: number;
  system_id?: string | null;
  location_label?: string | null;
  participants: string[];
  summary: string;
  certainty: Certainty;
}

interface RawBobStatus {
  bob_id: string;
  book_index: number;
  system_id?: string | null;
  summary: string;
  certainty: Certainty;
}

interface RawDataset {
  books: RawBook[];
  systems: RawSystem[];
  bobs: RawBob[];
  non_bob_entities: RawNonBobEntity[];
  events: RawEvent[];
  bob_status_by_book: RawBobStatus[];
  open_questions_for_text_verification: string[];
}

const dataset = rawDataset as RawDataset;

export interface BookEntry {
  id: string;
  label: string;
  shortLabel: string;
  spoilerLevel: number;
  spoilerLabel: string;
}

export interface BobContact {
  id: string;
  name: string;
  generation: number;
  lineage: string;
  certainty: Certainty;
  statusByBook: Array<{ bookIndex: number; summary: string; systemId?: string | null; certainty: Certainty }>;
}

export interface EventEntry {
  id: string;
  year: number;
  month?: number | null;
  day?: number | null;
  datePrecision: string;
  bookIndex: number;
  spoilerBookIndex: number;
  systemId?: string | null;
  title: string;
  summary: string;
  participantIds: string[];
  participantNames: string[];
  certainty: Certainty;
}

export interface SystemEntry {
  id: string;
  name: string;
  type: string;
  parentSystemId?: string | null;
  firstRelevantBook: number;
  faction: Faction;
  status: Status;
  x: number;
  y: number;
  z: number;
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  trueDistanceFromSolLy: number;
  summary: string;
  tags: string[];
  certainty: Certainty;
  inhabitants: string[];
  bobs: BobContact[];
  events: EventEntry[];
  sourceFrame: SourceFrame;
  positionQuality: PositionQuality;
  positionSource: string;
  positionSourceUrl?: string;
  distanceUncertaintyLy?: number;
  positionNotes?: string;
  isSceneCompressed: boolean;
}

const referenceById = new Map(referenceSystems.map((system) => [system.id, system]));
const bobById = new Map(dataset.bobs.map((bob) => [bob.id, bob]));
const entityById = new Map(dataset.non_bob_entities.map((entity) => [entity.id, entity]));

export const BOOKS: BookEntry[] = dataset.books.map((book) => ({
  id: book.id,
  label: book.title,
  shortLabel: book.short_title,
  spoilerLevel: book.book_index,
  spoilerLabel: book.spoiler_label,
}));

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function inferredGalacticPosition(id: string, distanceLy: number, bookIndex: number) {
  const hash = hashSeed(id);
  const l = (hash % 36000) / 100;
  const bBase = ((hash >> 9) % 12000) / 100 - 60;
  const b = Math.max(-75, Math.min(75, bBase + (bookIndex - 2) * 2.5));
  const renderPosition = galacticToCartesian(distanceLy, l, b);

  return {
    frame: 'galactic' as const,
    distanceLy,
    galacticLongitudeDeg: l,
    galacticLatitudeDeg: b,
    source: 'Deterministic inferred placement for ambiguous/uncatalogued story location',
    positionQuality: 'inferred' as const,
    distanceUncertaintyLy: Math.max(2, distanceLy * 0.15),
    notes: 'Used only when no anchored real-star reference is available; preserves stated Sol distance while making the 3D placement explicit as inferred.',
    renderPosition,
  };
}

function compressSceneCoordinate(value: number, radiusLy: number): number {
  if (radiusLy <= 250) return value;
  const compressedRadius = 250 + Math.log10(radiusLy / 250 + 1) * 180;
  return value * (compressedRadius / radiusLy);
}

function makeScenePosition(xLy: number, yLy: number, zLy: number) {
  const radiusLy = Math.hypot(xLy, yLy, zLy);
  return {
    sceneX: Number(compressSceneCoordinate(xLy, radiusLy).toFixed(2)),
    sceneY: Number(compressSceneCoordinate(yLy, radiusLy).toFixed(2)),
    sceneZ: Number(compressSceneCoordinate(zLy, radiusLy).toFixed(2)),
    isSceneCompressed: radiusLy > 250,
  };
}

function inferFaction(system: RawSystem): Faction {
  const tags = system.tags.join(' ').toLowerCase();
  if (tags.includes('pav')) return 'Pav';
  if (tags.includes('human') || system.id === 'sol') return 'Human';
  if (tags.includes('others')) return 'Other';
  if (tags.includes('quinlan')) return 'Other';
  if (tags.includes('bob') || tags.includes('bill') || tags.includes('mario') || tags.includes('bender')) return 'Bob';
  return 'Unknown';
}

function inferStatus(system: RawSystem): Status {
  const text = `${system.type ?? ''} ${system.tags.join(' ')}`.toLowerCase();
  if (text.includes('megastructure') || text.includes('topopolis')) return 'megastructure';
  if (text.includes('home system') || text.includes('homeworld')) return 'homeworld';
  if (text.includes('colony')) return 'colony';
  if (text.includes('conflict') || text.includes('strike') || text.includes('attack')) return 'conflict';
  if (text.includes('relay') || text.includes('network')) return 'relay';
  if (text.includes('expedition') || text.includes('trail')) return 'expedition';
  if (text.includes('destination') || text.includes('deep-time') || text.includes('deep')) return 'deep-space';
  return 'discovery';
}

function titleFromSummary(summary: string): string {
  return summary.split(/[.;:]/)[0].trim();
}

const statusesByBob = new Map<string, Array<{ bookIndex: number; summary: string; systemId?: string | null; certainty: Certainty }>>();
for (const row of dataset.bob_status_by_book) {
  const items = statusesByBob.get(row.bob_id) ?? [];
  items.push({ bookIndex: row.book_index, summary: row.summary, systemId: row.system_id, certainty: row.certainty });
  statusesByBob.set(row.bob_id, items);
}

const eventsBySystem = new Map<string, EventEntry[]>();
const topLevelSystemIds = new Set(dataset.systems.filter((system) => system.type !== 'planet' && system.parent_system_id == null).map((system) => system.id));

export const EVENTS: EventEntry[] = dataset.events.map((event) => {
  const participantNames = event.participants.map((id) => bobById.get(id)?.name ?? entityById.get(id)?.name ?? id);
  const mappedSystemId = event.system_id && topLevelSystemIds.has(event.system_id)
    ? event.system_id
    : dataset.systems.find((system) => system.id === event.system_id)?.parent_system_id ?? event.system_id ?? undefined;
  const normalized: EventEntry = {
    id: event.id,
    year: event.year,
    month: event.month,
    day: event.day,
    datePrecision: event.date_precision,
    bookIndex: event.book_index,
    spoilerBookIndex: event.spoiler_book_index,
    systemId: mappedSystemId ?? undefined,
    title: titleFromSummary(event.summary),
    summary: event.summary,
    participantIds: event.participants,
    participantNames,
    certainty: event.certainty,
  };
  if (normalized.systemId) {
    const items = eventsBySystem.get(normalized.systemId) ?? [];
    items.push(normalized);
    eventsBySystem.set(normalized.systemId, items);
  }
  return normalized;
}).sort((a, b) => a.year - b.year || a.bookIndex - b.bookIndex);

export const SYSTEMS: SystemEntry[] = dataset.systems
  .filter((system) => system.type !== 'planet')
  .map((system) => {
    const ref = referenceById.get(system.id);
    const parentRef = system.parent_system_id ? referenceById.get(system.parent_system_id) : undefined;
    const source = ref
      ? {
          frame: ref.sourcePosition.frame,
          positionQuality: ref.sourcePosition.positionQuality,
          positionSource: ref.sourcePosition.source,
          positionSourceUrl: ref.sourcePosition.sourceUrl,
          distanceUncertaintyLy: ref.sourcePosition.distanceUncertaintyLy,
          positionNotes: ref.sourcePosition.notes,
          xLy: ref.renderPosition.xLy,
          yLy: ref.renderPosition.yLy,
          zLy: ref.renderPosition.zLy,
          trueDistanceFromSolLy: ref.sourcePosition.distanceLy ?? Math.hypot(ref.renderPosition.xLy, ref.renderPosition.yLy, ref.renderPosition.zLy),
        }
      : parentRef
        ? (() => {
            const parentX = parentRef.renderPosition.xLy;
            const parentY = parentRef.renderPosition.yLy;
            const parentZ = parentRef.renderPosition.zLy;
            const offset = inferredGalacticPosition(`${system.id}-local-offset`, 0.02, system.first_relevant_book).renderPosition;
            const xLy = parentX + offset.xLy;
            const yLy = parentY + offset.yLy;
            const zLy = parentZ + offset.zLy;
            return {
              frame: 'cartesian' as const,
              positionQuality: 'fictional' as const,
              positionSource: 'Placed as a tight local offset from parent star/system for UI separation',
              positionSourceUrl: undefined,
              distanceUncertaintyLy: undefined,
              positionNotes: 'Child location within parent system; offset is explicitly non-astronomical and only prevents exact overlap in the map.',
              xLy,
              yLy,
              zLy,
              trueDistanceFromSolLy: Math.hypot(xLy, yLy, zLy),
            };
          })()
        : (() => {
            const inferredDistance = system.distance_from_sol_ly ?? (18 + (hashSeed(system.id) % 90) + system.first_relevant_book * 8);
            const inferred = inferredGalacticPosition(system.id, inferredDistance, system.first_relevant_book);
            return {
              frame: inferred.frame,
              positionQuality: inferred.positionQuality,
              positionSource: inferred.source,
              positionSourceUrl: undefined,
              distanceUncertaintyLy: inferred.distanceUncertaintyLy,
              positionNotes: inferred.notes,
              xLy: inferred.renderPosition.xLy,
              yLy: inferred.renderPosition.yLy,
              zLy: inferred.renderPosition.zLy,
              trueDistanceFromSolLy: inferred.distanceLy,
            };
          })();

    const relatedBobIds = dataset.bobs.filter((bob) => bob.primary_system_ids?.includes(system.id)).map((bob) => bob.id);
    const inhabitants = dataset.non_bob_entities
      .filter((entity) => entity.system_ids?.includes(system.id))
      .map((entity) => entity.name);

    const scene = makeScenePosition(source.xLy, source.zLy, source.yLy);

    return {
      id: system.id,
      name: system.name,
      type: system.type ?? 'system',
      parentSystemId: system.parent_system_id,
      firstRelevantBook: system.first_relevant_book,
      faction: inferFaction(system),
      status: inferStatus(system),
      x: Number(source.xLy.toFixed(2)),
      y: Number(source.zLy.toFixed(2)),
      z: Number(source.yLy.toFixed(2)),
      sceneX: scene.sceneX,
      sceneY: scene.sceneY,
      sceneZ: scene.sceneZ,
      trueDistanceFromSolLy: Number(source.trueDistanceFromSolLy.toFixed(2)),
      summary: system.summary,
      tags: system.tags,
      certainty: system.certainty,
      inhabitants,
      bobs: relatedBobIds.map((bobId) => {
        const bob = bobById.get(bobId)!;
        return {
          id: bob.id,
          name: bob.name,
          generation: bob.generation,
          lineage: bob.lineage_note,
          certainty: bob.certainty,
          statusByBook: (statusesByBob.get(bob.id) ?? []).sort((a, b) => a.bookIndex - b.bookIndex),
        };
      }),
      events: (eventsBySystem.get(system.id) ?? []).sort((a, b) => a.year - b.year),
      sourceFrame: source.frame,
      positionQuality: source.positionQuality,
      positionSource: source.positionSource,
      positionSourceUrl: source.positionSourceUrl,
      distanceUncertaintyLy: source.distanceUncertaintyLy,
      positionNotes: source.positionNotes,
      isSceneCompressed: scene.isSceneCompressed,
    } satisfies SystemEntry;
  })
  .sort((a, b) => a.firstRelevantBook - b.firstRelevantBook || a.name.localeCompare(b.name));

export const OPEN_QUESTIONS = dataset.open_questions_for_text_verification;
export const MAX_YEAR = Math.max(...EVENTS.map((event) => event.year));
export const MIN_YEAR = Math.min(...EVENTS.map((event) => event.year));
export const MAX_DISTANCE_FROM_SOL_LY = Math.max(...SYSTEMS.map((system) => system.trueDistanceFromSolLy));
export const SCIENCE_AUDIT = {
  canonicalDataFrame: 'Heliocentric local Galactic Cartesian coordinates in light-years',
  sceneAxisMapping: 'scene.x = galactic +X, scene.y = galactic +Z, scene.z = galactic +Y',
  farFieldCompression: 'For scene usability, radii beyond 250 ly are logarithmically compressed in sceneX/sceneY/sceneZ only; x/y/z remain true ly coordinates.',
  childPlacement: 'Planet/megastructure children are shown near their parent with tiny synthetic offsets and are explicitly marked non-astronomical in notes.',
  measuredDistanceSanity: {
    epsilonEridaniFromSolLy: Number(cartesianDistanceLy({ xLy: 0, yLy: 0, zLy: 0 }, referenceById.get('epsilon-eridani')!.renderPosition).toFixed(2)),
    deltaEridaniFromSolLy: Number(cartesianDistanceLy({ xLy: 0, yLy: 0, zLy: 0 }, referenceById.get('delta-eridani')!.renderPosition).toFixed(2)),
    sagittariusARegionFromSolLy: Number(cartesianDistanceLy({ xLy: 0, yLy: 0, zLy: 0 }, referenceById.get('sagittarius-a-region')!.renderPosition).toFixed(0)),
  },
} as const;
