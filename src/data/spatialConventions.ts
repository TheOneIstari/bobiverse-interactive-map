export type PositionQuality = 'measured' | 'inferred' | 'fictional' | 'approximate';
export type SourceFrame = 'galactic' | 'equatorial' | 'cartesian';

export interface SourcePosition {
  frame: SourceFrame;
  distanceLy?: number;
  raDeg?: number;
  decDeg?: number;
  galacticLongitudeDeg?: number;
  galacticLatitudeDeg?: number;
  xLy?: number;
  yLy?: number;
  zLy?: number;
  source: string;
  sourceUrl?: string;
  positionQuality: PositionQuality;
  distanceUncertaintyLy?: number;
  notes?: string;
}

export interface RenderPosition {
  xLy: number;
  yLy: number;
  zLy: number;
}

export interface SystemRecord {
  id: string;
  name: string;
  aliases?: string[];
  canonName?: string;
  realWorldCandidate?: string;
  isCanon: boolean;
  faction?: string;
  status?: string;
  era?: {
    fromYear?: number;
    toYear?: number;
  };
  sourcePosition: SourcePosition;
  renderPosition: RenderPosition;
}

const DEG_TO_RAD = Math.PI / 180;

export function galacticToCartesian(distanceLy: number, galacticLongitudeDeg: number, galacticLatitudeDeg: number): RenderPosition {
  const l = galacticLongitudeDeg * DEG_TO_RAD;
  const b = galacticLatitudeDeg * DEG_TO_RAD;

  const cosB = Math.cos(b);

  return {
    xLy: distanceLy * cosB * Math.cos(l),
    yLy: distanceLy * cosB * Math.sin(l),
    zLy: distanceLy * Math.sin(b),
  };
}

export function cartesianDistanceLy(a: RenderPosition, b: RenderPosition): number {
  const dx = a.xLy - b.xLy;
  const dy = a.yLy - b.yLy;
  const dz = a.zLy - b.zLy;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function formatDistanceLy(distanceLy: number): string {
  if (distanceLy >= 1000) {
    return `${(distanceLy / 1000).toFixed(1)} kly`;
  }

  if (distanceLy >= 10) {
    return `${distanceLy.toFixed(1)} ly`;
  }

  return `${distanceLy.toFixed(2)} ly`;
}

export function recenterPosition(position: RenderPosition, focus: RenderPosition): RenderPosition {
  return {
    xLy: position.xLy - focus.xLy,
    yLy: position.yLy - focus.yLy,
    zLy: position.zLy - focus.zLy,
  };
}

export const SCIENCE_NOTES = {
  canonicalFrame: 'Heliocentric local Galactic Cartesian frame in light-years',
  axes: {
    x: '+X toward Galactic Centre',
    y: '+Y in direction of Galactic rotation',
    z: '+Z toward North Galactic Pole',
  },
  origin: 'Sol at (0, 0, 0)',
  renderingPolicy: 'Keep real positions; fake sprite/label sizes if needed for readability.',
  precisionPolicy: 'Use floating-origin recentering around the current focus target for rendering stability.',
} as const;
