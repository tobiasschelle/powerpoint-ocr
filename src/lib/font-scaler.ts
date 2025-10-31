export interface FontScaleConfig {
  elementCount: number;
  scaleFactor: number;
  minFontSize: number;
  maxFontSize: number;
}

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 72;

export function calculateFontScaleFactor(elementCount: number): FontScaleConfig {
  let scaleFactor = 1.0;

  if (elementCount <= 10) {
    scaleFactor = 1.0;
  } else if (elementCount <= 20) {
    scaleFactor = 0.85;
  } else if (elementCount <= 30) {
    scaleFactor = 0.7;
  } else if (elementCount <= 40) {
    scaleFactor = 0.6;
  } else {
    scaleFactor = 0.5;
  }

  console.log(`Font scaling: ${elementCount} elements → ${(scaleFactor * 100).toFixed(0)}% scale factor`);

  return {
    elementCount,
    scaleFactor,
    minFontSize: MIN_FONT_SIZE,
    maxFontSize: MAX_FONT_SIZE,
  };
}

export function applyFontScale(fontSize: number, scaleFactor: number): number {
  const scaled = fontSize * scaleFactor;
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, scaled));
  return Math.round(clamped);
}

export function scaleTextElements<T extends { font_size?: number }>(
  elements: T[],
  scaleFactor: number
): T[] {
  return elements.map(element => ({
    ...element,
    font_size: element.font_size
      ? applyFontScale(element.font_size, scaleFactor)
      : 14,
  }));
}

export function calculateDensityMetrics(elementCount: number): {
  density: 'low' | 'medium' | 'high' | 'very-high';
  recommendedAction: string;
} {
  if (elementCount <= 10) {
    return {
      density: 'low',
      recommendedAction: 'No scaling needed',
    };
  } else if (elementCount <= 20) {
    return {
      density: 'medium',
      recommendedAction: 'Mild font reduction applied',
    };
  } else if (elementCount <= 30) {
    return {
      density: 'high',
      recommendedAction: 'Moderate font reduction applied',
    };
  } else {
    return {
      density: 'very-high',
      recommendedAction: 'Aggressive font reduction applied',
    };
  }
}
