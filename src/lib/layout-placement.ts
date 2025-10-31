import { LayoutRegion } from './layout-detector';
import { DetectedTextElement } from '../types';

export interface LayoutAwarePlacement {
  element: DetectedTextElement;
  region: LayoutRegion;
  placementQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export function normalizeCoordinates(
  textElements: DetectedTextElement[],
  regions: LayoutRegion[]
): DetectedTextElement[] {
  console.log('\n=== COORDINATE NORMALIZATION ===');
  console.log(`Normalizing ${textElements.length} text elements across ${regions.length} regions`);

  const normalized = textElements.map((element, idx) => {
    const containingRegion = findContainingRegion(element, regions);

    if (containingRegion) {
      console.log(`Element ${idx + 1}: Found in region type "${containingRegion.type}"`);
      return normalizeWithinRegion(element, containingRegion);
    } else {
      console.log(`Element ${idx + 1}: No containing region, using absolute positioning`);
      return element;
    }
  });

  console.log('=== NORMALIZATION COMPLETE ===\n');
  return normalized;
}

function findContainingRegion(
  element: DetectedTextElement,
  regions: LayoutRegion[]
): LayoutRegion | null {
  const SLIDE_WIDTH = 10;
  const SLIDE_HEIGHT = 5.625;

  const elementCenterX = element.position_x + element.width / 2;
  const elementCenterY = element.position_y + element.height / 2;

  for (const region of regions) {
    const regionXInches = (region.x / 1920) * SLIDE_WIDTH;
    const regionYInches = (region.y / 1080) * SLIDE_HEIGHT;
    const regionWidthInches = (region.width / 1920) * SLIDE_WIDTH;
    const regionHeightInches = (region.height / 1080) * SLIDE_HEIGHT;

    const regionLeft = regionXInches;
    const regionRight = regionXInches + regionWidthInches;
    const regionTop = regionYInches;
    const regionBottom = regionYInches + regionHeightInches;

    if (
      elementCenterX >= regionLeft &&
      elementCenterX <= regionRight &&
      elementCenterY >= regionTop &&
      elementCenterY <= regionBottom
    ) {
      return region;
    }
  }

  return null;
}

function normalizeWithinRegion(
  element: DetectedTextElement,
  region: LayoutRegion
): DetectedTextElement {
  const SLIDE_WIDTH = 10;
  const SLIDE_HEIGHT = 5.625;

  const regionXInches = (region.x / 1920) * SLIDE_WIDTH;
  const regionYInches = (region.y / 1080) * SLIDE_HEIGHT;
  const regionWidthInches = (region.width / 1920) * SLIDE_WIDTH;
  const regionHeightInches = (region.height / 1080) * SLIDE_HEIGHT;

  const clampedX = Math.max(
    regionXInches,
    Math.min(element.position_x, regionXInches + regionWidthInches - element.width)
  );
  const clampedY = Math.max(
    regionYInches,
    Math.min(element.position_y, regionYInches + regionHeightInches - element.height)
  );

  const clampedWidth = Math.min(
    element.width,
    regionWidthInches - (clampedX - regionXInches)
  );
  const clampedHeight = Math.min(
    element.height,
    regionHeightInches - (clampedY - regionYInches)
  );

  return {
    ...element,
    position_x: clampedX,
    position_y: clampedY,
    width: Math.max(0.1, clampedWidth),
    height: Math.max(0.1, clampedHeight),
  };
}

export function validateLayoutPlacement(
  textElements: DetectedTextElement[],
  regions: LayoutRegion[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  for (let i = 0; i < textElements.length; i++) {
    const element = textElements[i];

    if (element.position_x < 0 || element.position_x > 10) {
      warnings.push(`Element ${i + 1}: X position ${element.position_x}" is out of bounds`);
    }

    if (element.position_y < 0 || element.position_y > 5.625) {
      warnings.push(`Element ${i + 1}: Y position ${element.position_y}" is out of bounds`);
    }

    if (element.width <= 0 || element.width > 10) {
      warnings.push(`Element ${i + 1}: Width ${element.width}" is invalid`);
    }

    if (element.height <= 0 || element.height > 5.625) {
      warnings.push(`Element ${i + 1}: Height ${element.height}" is invalid`);
    }

    if (element.position_x + element.width > 10.1) {
      warnings.push(`Element ${i + 1}: Extends beyond right edge of slide`);
    }

    if (element.position_y + element.height > 5.725) {
      warnings.push(`Element ${i + 1}: Extends beyond bottom edge of slide`);
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

export function alignElementsWithinRegions(
  textElements: DetectedTextElement[],
  regions: LayoutRegion[]
): DetectedTextElement[] {
  console.log('\n=== REGION ALIGNMENT ===');

  const aligned = textElements.map((element, idx) => {
    const region = findContainingRegion(element, regions);

    if (!region) {
      return element;
    }

    const SLIDE_WIDTH = 10;
    const SLIDE_HEIGHT = 5.625;

    const regionXInches = (region.x / 1920) * SLIDE_WIDTH;
    const regionYInches = (region.y / 1080) * SLIDE_HEIGHT;
    const regionWidthInches = (region.width / 1920) * SLIDE_WIDTH;
    const regionHeightInches = (region.height / 1080) * SLIDE_HEIGHT;

    const relativeX = element.position_x - regionXInches;
    const relativeY = element.position_y - regionYInches;

    let alignedElement = { ...element };

    if (relativeX < 0.05) {
      alignedElement.position_x = regionXInches + 0.05;
      console.log(`Element ${idx + 1}: Aligned to left edge of region`);
    }

    if (relativeY < 0.05) {
      alignedElement.position_y = regionYInches + 0.05;
      console.log(`Element ${idx + 1}: Aligned to top edge of region`);
    }

    const rightEdgeDistance = (regionXInches + regionWidthInches) - (element.position_x + element.width);
    if (rightEdgeDistance < 0.05 && rightEdgeDistance > 0) {
      alignedElement.position_x = regionXInches + regionWidthInches - element.width - 0.05;
      console.log(`Element ${idx + 1}: Aligned to right edge of region`);
    }

    const bottomEdgeDistance = (regionYInches + regionHeightInches) - (element.position_y + element.height);
    if (bottomEdgeDistance < 0.05 && bottomEdgeDistance > 0) {
      alignedElement.position_y = regionYInches + regionHeightInches - element.height - 0.05;
      console.log(`Element ${idx + 1}: Aligned to bottom edge of region`);
    }

    return alignedElement;
  });

  console.log('=== ALIGNMENT COMPLETE ===\n');
  return aligned;
}

export function computePlacementQuality(
  textElements: DetectedTextElement[],
  regions: LayoutRegion[]
): LayoutAwarePlacement[] {
  return textElements.map(element => {
    const region = findContainingRegion(element, regions);

    if (!region) {
      return {
        element,
        region: {
          type: 'text_box',
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          confidence: 0,
          contains_text: true,
          shape_type: 'none'
        },
        placementQuality: 'poor'
      };
    }

    const quality = assessPlacementQuality(element, region);

    return {
      element,
      region,
      placementQuality: quality
    };
  });
}

function assessPlacementQuality(
  element: DetectedTextElement,
  region: LayoutRegion
): 'excellent' | 'good' | 'fair' | 'poor' {
  const SLIDE_WIDTH = 10;
  const SLIDE_HEIGHT = 5.625;

  const regionXInches = (region.x / 1920) * SLIDE_WIDTH;
  const regionYInches = (region.y / 1080) * SLIDE_HEIGHT;
  const regionWidthInches = (region.width / 1920) * SLIDE_WIDTH;
  const regionHeightInches = (region.height / 1080) * SLIDE_HEIGHT;

  const withinRegionX = element.position_x >= regionXInches &&
    element.position_x + element.width <= regionXInches + regionWidthInches;

  const withinRegionY = element.position_y >= regionYInches &&
    element.position_y + element.height <= regionYInches + regionHeightInches;

  const hasGoodMargins =
    element.position_x > regionXInches + 0.05 &&
    element.position_y > regionYInches + 0.05 &&
    element.position_x + element.width < regionXInches + regionWidthInches - 0.05 &&
    element.position_y + element.height < regionYInches + regionHeightInches - 0.05;

  if (withinRegionX && withinRegionY && hasGoodMargins && region.confidence > 90) {
    return 'excellent';
  }

  if (withinRegionX && withinRegionY && region.confidence > 75) {
    return 'good';
  }

  if (withinRegionX || withinRegionY) {
    return 'fair';
  }

  return 'poor';
}
