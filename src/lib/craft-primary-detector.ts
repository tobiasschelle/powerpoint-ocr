import { DetectedTextElement, AIAnalysisResult } from '../types';
import { detectTextWithCRAFT, mergeCharacterBoxesToWords, CraftBox } from './craft-detector';
import { performOCROnCraftRegions } from './craft-region-ocr';
import { pixelsToInches } from './coordinate-utils';

export interface CraftPrimaryResult {
  analysis: AIAnalysisResult;
  craftBoxCount: number;
  ocrSuccessCount: number;
  timings: {
    craftDetectionMs: number;
    claudeOcrMs: number;
    totalMs: number;
  };
}

export async function performCraftPrimaryDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<CraftPrimaryResult> {
  console.log('\n========================================');
  console.log('=== CRAFT-PRIMARY DETECTION START ===');
  console.log('========================================');
  console.log(`Image: ${imageWidth}px × ${imageHeight}px`);
  console.log('Strategy: CRAFT for placement, Claude for text');

  const overallStartTime = Date.now();
  const timings = {
    craftDetectionMs: 0,
    claudeOcrMs: 0,
    totalMs: 0,
  };

  console.log('\n--- PHASE 1: CRAFT Bounding Box Detection ---');
  const craftStartTime = Date.now();
  const craftResult = await detectTextWithCRAFT(imageBlob, imageWidth, imageHeight);
  timings.craftDetectionMs = Date.now() - craftStartTime;

  if (craftResult.error || craftResult.boxes.length === 0) {
    console.warn(`⚠ CRAFT detection failed or returned no results: ${craftResult.error || 'empty response'}`);
    console.log('Cannot proceed with CRAFT-primary detection');

    timings.totalMs = Date.now() - overallStartTime;

    return {
      analysis: { textElements: [], tables: [] },
      craftBoxCount: 0,
      ocrSuccessCount: 0,
      timings,
    };
  }

  console.log(`✓ CRAFT detected ${craftResult.boxes.length} character boxes in ${timings.craftDetectionMs}ms`);

  console.log('\n--- PHASE 2: Merge Character Boxes to Words ---');
  const wordBoxes = mergeCharacterBoxesToWords(craftResult.boxes);
  console.log(`✓ Merged into ${wordBoxes.length} word-level bounding boxes`);

  console.log('\n--- PHASE 3: Claude OCR on CRAFT Regions ---');
  const claudeStartTime = Date.now();
  const textElements = await performOCROnCraftRegions(
    imageBlob,
    wordBoxes,
    imageWidth,
    imageHeight
  );
  timings.claudeOcrMs = Date.now() - claudeStartTime;

  const ocrSuccessCount = textElements.filter(el => el.content && el.content.trim().length > 0).length;
  console.log(`✓ Claude OCR completed: ${ocrSuccessCount}/${wordBoxes.length} regions successfully extracted`);

  timings.totalMs = Date.now() - overallStartTime;

  console.log('\n========================================');
  console.log('Performance Summary:');
  console.log(`  CRAFT Detection: ${timings.craftDetectionMs}ms`);
  console.log(`  Claude OCR: ${timings.claudeOcrMs}ms`);
  console.log(`  Total: ${timings.totalMs}ms`);
  console.log('\nResults Summary:');
  console.log(`  CRAFT boxes detected: ${craftResult.boxes.length}`);
  console.log(`  Word boxes merged: ${wordBoxes.length}`);
  console.log(`  Successful OCR: ${ocrSuccessCount}`);
  console.log(`  Final elements: ${textElements.length}`);
  console.log('========================================');
  console.log('=== CRAFT-PRIMARY DETECTION COMPLETE ===');
  console.log('========================================\n');

  return {
    analysis: {
      textElements,
      tables: [],
    },
    craftBoxCount: wordBoxes.length,
    ocrSuccessCount,
    timings,
  };
}

export function convertCraftBoxToCoordinates(
  box: CraftBox,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: pixelsToInches(box.x, imageWidth, 10),
    y: pixelsToInches(box.y, imageHeight, 5.625),
    width: pixelsToInches(box.width, imageWidth, 10),
    height: pixelsToInches(box.height, imageHeight, 5.625),
  };
}
