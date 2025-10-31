import { DetectedTextElement } from '../types';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MergeResult {
  mergedElements: DetectedTextElement[];
  claudeOnlyCount: number;
  craftOnlyCount: number;
  overlapCount: number;
  mergedCount: number;
}

export interface DetectionStats {
  claudeCount: number;
  craftCount: number;
  mergedCount: number;
  overlapCount: number;
  claudeOnlyCount: number;
  craftOnlyCount: number;
}

export function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersectionArea = (x2 - x1) * (y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  if (unionArea === 0) return 0;

  return intersectionArea / unionArea;
}

export function mergeDetections(
  claudeElements: DetectedTextElement[],
  craftElements: DetectedTextElement[],
  overlapThreshold: number = 0.5
): MergeResult {
  console.log('\n=== MERGING DETECTIONS ===');
  console.log(`Claude elements: ${claudeElements.length}`);
  console.log(`CRAFT elements: ${craftElements.length}`);
  console.log(`Overlap threshold: ${overlapThreshold}`);

  const mergedElements: DetectedTextElement[] = [];
  const craftMatched = new Set<number>();
  let overlapCount = 0;

  for (const claudeElement of claudeElements) {
    let bestMatch: { index: number; iou: number } | null = null;

    for (let i = 0; i < craftElements.length; i++) {
      if (craftMatched.has(i)) continue;

      const iou = calculateIoU(
        {
          x: claudeElement.position_x,
          y: claudeElement.position_y,
          width: claudeElement.width,
          height: claudeElement.height,
        },
        {
          x: craftElements[i].position_x,
          y: craftElements[i].position_y,
          width: craftElements[i].width,
          height: craftElements[i].height,
        }
      );

      if (iou >= overlapThreshold) {
        if (!bestMatch || iou > bestMatch.iou) {
          bestMatch = { index: i, iou };
        }
      }
    }

    if (bestMatch) {
      craftMatched.add(bestMatch.index);
      overlapCount++;

      const craftElement = craftElements[bestMatch.index];

      const avgX = (claudeElement.position_x + craftElement.position_x) / 2;
      const avgY = (claudeElement.position_y + craftElement.position_y) / 2;
      const avgWidth = (claudeElement.width + craftElement.width) / 2;
      const avgHeight = (claudeElement.height + craftElement.height) / 2;

      mergedElements.push({
        ...claudeElement,
        position_x: avgX,
        position_y: avgY,
        width: avgWidth,
        height: avgHeight,
        confidence_score: Math.max(
          claudeElement.confidence_score || 0,
          craftElement.confidence_score || 0
        ),
      });

      console.log(`  Merged: Claude "${claudeElement.content.substring(0, 30)}" + CRAFT (IoU: ${bestMatch.iou.toFixed(3)})`);
    } else {
      mergedElements.push(claudeElement);
    }
  }

  const claudeOnlyCount = claudeElements.length - overlapCount;

  for (let i = 0; i < craftElements.length; i++) {
    if (!craftMatched.has(i)) {
      mergedElements.push(craftElements[i]);
      console.log(`  CRAFT-only: "${craftElements[i].content.substring(0, 30)}"`);
    }
  }

  const craftOnlyCount = craftElements.length - overlapCount;

  console.log('\nMerge Results:');
  console.log(`  Claude-only: ${claudeOnlyCount}`);
  console.log(`  CRAFT-only: ${craftOnlyCount}`);
  console.log(`  Overlapping: ${overlapCount}`);
  console.log(`  Total merged: ${mergedElements.length}`);
  console.log('=== MERGE COMPLETE ===\n');

  return {
    mergedElements,
    claudeOnlyCount,
    craftOnlyCount,
    overlapCount,
    mergedCount: mergedElements.length,
  };
}

export function enrichCraftElementsWithClaudeOCR(
  craftElements: DetectedTextElement[],
  claudeElements: DetectedTextElement[],
  overlapThreshold: number = 0.3
): DetectedTextElement[] {
  console.log('\n=== ENRICHING CRAFT ELEMENTS WITH CLAUDE OCR ===');

  const enrichedElements = craftElements.map((craftElement) => {
    for (const claudeElement of claudeElements) {
      const iou = calculateIoU(
        {
          x: craftElement.position_x,
          y: craftElement.position_y,
          width: craftElement.width,
          height: craftElement.height,
        },
        {
          x: claudeElement.position_x,
          y: claudeElement.position_y,
          width: claudeElement.width,
          height: claudeElement.height,
        }
      );

      if (iou >= overlapThreshold) {
        console.log(`  Enriching CRAFT box with Claude text: "${claudeElement.content.substring(0, 30)}"`);
        return {
          ...craftElement,
          content: claudeElement.content,
          font_family: claudeElement.font_family,
          font_size: claudeElement.font_size,
          font_color: claudeElement.font_color,
          is_bold: claudeElement.is_bold,
          is_italic: claudeElement.is_italic,
          is_underline: claudeElement.is_underline,
          align: claudeElement.align,
        };
      }
    }

    return craftElement;
  });

  console.log('=== ENRICHMENT COMPLETE ===\n');

  return enrichedElements;
}

export function filterOverlappingDetections(
  elements: DetectedTextElement[],
  overlapThreshold: number = 0.8
): DetectedTextElement[] {
  console.log('\n=== FILTERING OVERLAPPING DETECTIONS ===');
  console.log(`Input elements: ${elements.length}`);

  const filtered: DetectedTextElement[] = [];
  const toRemove = new Set<number>();

  for (let i = 0; i < elements.length; i++) {
    if (toRemove.has(i)) continue;

    for (let j = i + 1; j < elements.length; j++) {
      if (toRemove.has(j)) continue;

      const iou = calculateIoU(
        {
          x: elements[i].position_x,
          y: elements[i].position_y,
          width: elements[i].width,
          height: elements[i].height,
        },
        {
          x: elements[j].position_x,
          y: elements[j].position_y,
          width: elements[j].width,
          height: elements[j].height,
        }
      );

      if (iou >= overlapThreshold) {
        const keepIndex = (elements[i].confidence_score || 0) >= (elements[j].confidence_score || 0) ? i : j;
        const removeIndex = keepIndex === i ? j : i;
        toRemove.add(removeIndex);
        console.log(`  Removing duplicate (IoU: ${iou.toFixed(3)})`);
      }
    }
  }

  for (let i = 0; i < elements.length; i++) {
    if (!toRemove.has(i)) {
      filtered.push(elements[i]);
    }
  }

  console.log(`Filtered elements: ${filtered.length} (removed ${toRemove.size})`);
  console.log('=== FILTERING COMPLETE ===\n');

  return filtered;
}

export function calculateDetectionStats(
  claudeElements: DetectedTextElement[],
  craftElements: DetectedTextElement[],
  mergedElements: DetectedTextElement[],
  overlapThreshold: number = 0.5
): DetectionStats {
  let overlapCount = 0;
  const craftMatched = new Set<number>();

  for (const claudeElement of claudeElements) {
    for (let i = 0; i < craftElements.length; i++) {
      if (craftMatched.has(i)) continue;

      const iou = calculateIoU(
        {
          x: claudeElement.position_x,
          y: claudeElement.position_y,
          width: claudeElement.width,
          height: claudeElement.height,
        },
        {
          x: craftElements[i].position_x,
          y: craftElements[i].position_y,
          width: craftElements[i].width,
          height: craftElements[i].height,
        }
      );

      if (iou >= overlapThreshold) {
        craftMatched.add(i);
        overlapCount++;
        break;
      }
    }
  }

  return {
    claudeCount: claudeElements.length,
    craftCount: craftElements.length,
    mergedCount: mergedElements.length,
    overlapCount,
    claudeOnlyCount: claudeElements.length - overlapCount,
    craftOnlyCount: craftElements.length - overlapCount,
  };
}
