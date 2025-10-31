import { DetectedTextElement, AIAnalysisResult } from '../types';
import { detectTextWithDBNet, mergeBoxesToLines, DBNetBox } from './dbnet-detector';
import { performOCROnDBNetRegions } from './dbnet-region-ocr';
import { pixelsToInches } from './coordinate-utils';

export interface DBNetPrimaryResult {
  analysis: AIAnalysisResult;
  dbnetBoxCount: number;
  ocrSuccessCount: number;
  timings: {
    dbnetDetectionMs: number;
    claudeOcrMs: number;
    totalMs: number;
  };
}

export async function performDBNetPrimaryDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number,
  detDbThresh: number = 0.3,
  detDbBoxThresh: number = 0.5,
  detDbUnclipRatio: number = 1.8
): Promise<DBNetPrimaryResult> {
  console.log('\n========================================');
  console.log('=== DBNET-PRIMARY DETECTION START ===');
  console.log('========================================');
  console.log(`Image: ${imageWidth}px × ${imageHeight}px`);
  console.log('Strategy: DBNet for placement, Claude for text');

  const overallStartTime = Date.now();
  const timings = {
    dbnetDetectionMs: 0,
    claudeOcrMs: 0,
    totalMs: 0,
  };

  console.log('\n--- PHASE 1: DBNet Bounding Box Detection ---');
  const dbnetStartTime = Date.now();
  const dbnetResult = await detectTextWithDBNet(
    imageBlob,
    imageWidth,
    imageHeight,
    detDbThresh,
    detDbBoxThresh,
    detDbUnclipRatio
  );
  timings.dbnetDetectionMs = Date.now() - dbnetStartTime;

  if (dbnetResult.error || dbnetResult.boxes.length === 0) {
    console.warn(`⚠ DBNet detection failed or returned no results: ${dbnetResult.error || 'empty response'}`);
    console.log('Cannot proceed with DBNet-primary detection');

    timings.totalMs = Date.now() - overallStartTime;

    return {
      analysis: { textElements: [], tables: [] },
      dbnetBoxCount: 0,
      ocrSuccessCount: 0,
      timings,
    };
  }

  console.log(`✓ DBNet detected ${dbnetResult.boxes.length} text boxes in ${timings.dbnetDetectionMs}ms`);

  console.log('\n--- PHASE 2: Merge Boxes to Line Level ---');
  const lineBoxes = mergeBoxesToLines(dbnetResult.boxes);
  console.log(`✓ Merged into ${lineBoxes.length} line-level bounding boxes`);

  console.log('\n--- PHASE 3: Claude OCR on DBNet Regions ---');
  const claudeStartTime = Date.now();
  const textElements = await performOCROnDBNetRegions(
    imageBlob,
    lineBoxes,
    imageWidth,
    imageHeight
  );
  timings.claudeOcrMs = Date.now() - claudeStartTime;

  const ocrSuccessCount = textElements.filter(el => el.content && el.content.trim().length > 0).length;
  console.log(`✓ Claude OCR completed: ${ocrSuccessCount}/${lineBoxes.length} regions successfully extracted`);

  timings.totalMs = Date.now() - overallStartTime;

  console.log('\n========================================');
  console.log('Performance Summary:');
  console.log(`  DBNet Detection: ${timings.dbnetDetectionMs}ms`);
  console.log(`  Claude OCR: ${timings.claudeOcrMs}ms`);
  console.log(`  Total: ${timings.totalMs}ms`);
  console.log('\nResults Summary:');
  console.log(`  DBNet boxes detected: ${dbnetResult.boxes.length}`);
  console.log(`  Line boxes merged: ${lineBoxes.length}`);
  console.log(`  Successful OCR: ${ocrSuccessCount}`);
  console.log(`  Final elements: ${textElements.length}`);
  console.log('========================================');
  console.log('=== DBNET-PRIMARY DETECTION COMPLETE ===');
  console.log('========================================\n');

  return {
    analysis: {
      textElements,
      tables: [],
    },
    dbnetBoxCount: lineBoxes.length,
    ocrSuccessCount,
    timings,
  };
}

export function convertDBNetBoxToCoordinates(
  box: DBNetBox,
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
