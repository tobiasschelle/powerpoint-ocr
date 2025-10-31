import { DetectedTextElement, AIAnalysisResult } from '../types';
import { detectLayoutRegions, LayoutRegion } from './layout-detector';
import { performRegionBasedOCR } from './region-ocr';
import { detectTextWithCRAFT, mergeCharacterBoxesToWords, convertCraftBoxesToTextElements } from './craft-detector';
import { detectTextWithDBNet, mergeBoxesToLines, convertDBNetBoxesToTextElements } from './dbnet-detector';
import { mergeDetections, enrichCraftElementsWithClaudeOCR, filterOverlappingDetections, calculateDetectionStats } from './detection-merger';
import { normalizeCoordinates, validateLayoutPlacement, alignElementsWithinRegions } from './layout-placement';
import { performCraftPrimaryDetection } from './craft-primary-detector';
import { performDBNetPrimaryDetection } from './dbnet-primary-detector';
import { analyzeSlideImageWithLayoutDetection } from './claude-vision';

export interface HybridDetectionResult {
  analysis: AIAnalysisResult;
  regions: LayoutRegion[];
  detectionStats: {
    claudeCount: number;
    craftCount: number;
    mergedCount: number;
    overlapCount: number;
    claudeOnlyCount: number;
    craftOnlyCount: number;
  };
  timings: {
    layoutDetectionMs: number;
    claudeOcrMs: number;
    craftDetectionMs: number;
    mergingMs: number;
    totalMs: number;
  };
}

export async function performHybridDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number,
  useHybrid: boolean = true,
  useCraftPrimary: boolean = false,
  useDBNet: boolean = false
): Promise<HybridDetectionResult> {
  if (useCraftPrimary && useHybrid && !useDBNet) {
    return performCraftPrimaryHybridDetection(imageBlob, imageWidth, imageHeight);
  }
  if (useDBNet && useHybrid && useCraftPrimary) {
    return performDBNetPrimaryHybridDetection(imageBlob, imageWidth, imageHeight);
  }
  console.log('\n========================================');
  console.log('=== HYBRID DETECTION PIPELINE START ===');
  console.log('========================================');
  console.log(`Image: ${imageWidth}px × ${imageHeight}px`);
  const detectionMethod = useDBNet ? 'DBNet' : 'CRAFT';
  console.log(`Mode: ${useHybrid ? `HYBRID (Claude + ${detectionMethod})` : 'Claude Only'}`);

  const overallStartTime = Date.now();
  const timings = {
    layoutDetectionMs: 0,
    claudeOcrMs: 0,
    craftDetectionMs: 0,
    mergingMs: 0,
    totalMs: 0,
  };

  console.log('\n--- PHASE 1: Layout Region Detection (Claude) ---');
  const layoutStartTime = Date.now();
  const layoutResult = await detectLayoutRegions(imageBlob, imageWidth, imageHeight);
  timings.layoutDetectionMs = Date.now() - layoutStartTime;
  console.log(`✓ Detected ${layoutResult.regions.length} layout regions in ${timings.layoutDetectionMs}ms`);

  let claudeElements: DetectedTextElement[] = [];

  if (layoutResult.regions.length > 0) {
    console.log('\n--- PHASE 2: Region-Based OCR (Claude) ---');
    const claudeStartTime = Date.now();
    claudeElements = await performRegionBasedOCR(
      imageBlob,
      layoutResult.regions,
      imageWidth,
      imageHeight
    );
    timings.claudeOcrMs = Date.now() - claudeStartTime;

    claudeElements = normalizeCoordinates(claudeElements, layoutResult.regions);
    claudeElements = alignElementsWithinRegions(claudeElements, layoutResult.regions);

    const validation = validateLayoutPlacement(claudeElements, layoutResult.regions);
    if (!validation.isValid) {
      console.warn('⚠ Layout placement warnings:');
      validation.warnings.forEach(w => console.warn(`  - ${w}`));
    }

    console.log(`✓ Claude detected ${claudeElements.length} text elements in ${timings.claudeOcrMs}ms`);
  } else {
    console.warn('⚠ No layout regions detected, skipping Claude OCR phase');
  }

  let finalElements = claudeElements;
  let detectionStats = {
    claudeCount: claudeElements.length,
    craftCount: 0,
    mergedCount: claudeElements.length,
    overlapCount: 0,
    claudeOnlyCount: claudeElements.length,
    craftOnlyCount: 0,
  };

  if (useHybrid) {
    console.log(`\n--- PHASE 3: ${useDBNet ? 'DBNet' : 'CRAFT'} Text Detection ---`);
    const craftStartTime = Date.now();

    let detectorElements: DetectedTextElement[] = [];
    let detectionSuccess = false;

    if (useDBNet) {
      const dbnetResult = await detectTextWithDBNet(imageBlob, imageWidth, imageHeight);
      timings.craftDetectionMs = Date.now() - craftStartTime;

      if (dbnetResult.boxes.length > 0 && !dbnetResult.error) {
        console.log(`✓ DBNet detected ${dbnetResult.boxes.length} text boxes in ${timings.craftDetectionMs}ms`);

        const lineBoxes = mergeBoxesToLines(dbnetResult.boxes);
        detectorElements = convertDBNetBoxesToTextElements(lineBoxes, imageWidth, imageHeight);
        detectionSuccess = true;
      } else {
        console.warn(`⚠ DBNet detection failed or returned no results: ${dbnetResult.error || 'empty response'}`);
      }
    } else {
      const craftResult = await detectTextWithCRAFT(imageBlob, imageWidth, imageHeight);
      timings.craftDetectionMs = Date.now() - craftStartTime;

      if (craftResult.boxes.length > 0 && !craftResult.error) {
        console.log(`✓ CRAFT detected ${craftResult.boxes.length} character boxes in ${timings.craftDetectionMs}ms`);

        const wordBoxes = mergeCharacterBoxesToWords(craftResult.boxes);
        detectorElements = convertCraftBoxesToTextElements(wordBoxes, imageWidth, imageHeight);
        detectionSuccess = true;
      } else {
        console.warn(`⚠ CRAFT detection failed or returned no results: ${craftResult.error || 'empty response'}`);
      }
    }

    if (detectionSuccess) {
      console.log('\n--- PHASE 4: Detection Merging ---');
      const mergingStartTime = Date.now();

      detectorElements = enrichCraftElementsWithClaudeOCR(detectorElements, claudeElements, 0.3);

      const mergeResult = mergeDetections(claudeElements, detectorElements, 0.5);

      finalElements = filterOverlappingDetections(mergeResult.mergedElements, 0.8);

      timings.mergingMs = Date.now() - mergingStartTime;

      detectionStats = calculateDetectionStats(claudeElements, detectorElements, finalElements, 0.5);

      console.log(`✓ Merged ${detectionStats.mergedCount} elements in ${timings.mergingMs}ms`);
      console.log('\nDetection Breakdown:');
      console.log(`  - Claude-only: ${detectionStats.claudeOnlyCount}`);
      console.log(`  - ${useDBNet ? 'DBNet' : 'CRAFT'}-only: ${detectionStats.craftOnlyCount}`);
      console.log(`  - Overlapping: ${detectionStats.overlapCount}`);
      console.log(`  - Final count: ${finalElements.length}`);
    } else {
      console.log('Falling back to Claude-only detection');
    }
  }

  timings.totalMs = Date.now() - overallStartTime;

  console.log('\n========================================');
  console.log('Performance Summary:');
  console.log(`  Layout Detection: ${timings.layoutDetectionMs}ms`);
  console.log(`  Claude OCR: ${timings.claudeOcrMs}ms`);
  if (useHybrid) {
    console.log(`  ${useDBNet ? 'DBNet' : 'CRAFT'} Detection: ${timings.craftDetectionMs}ms`);
    console.log(`  Merging: ${timings.mergingMs}ms`);
  }
  console.log(`  Total: ${timings.totalMs}ms`);
  console.log('========================================');
  console.log('=== HYBRID DETECTION COMPLETE ===');
  console.log('========================================\n');

  return {
    analysis: {
      textElements: finalElements,
      tables: [],
    },
    regions: layoutResult.regions,
    detectionStats,
    timings,
  };
}

export async function performClaudeOnlyDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<HybridDetectionResult> {
  return performHybridDetection(imageBlob, imageWidth, imageHeight, false);
}

export async function performCraftPrimaryHybridDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<HybridDetectionResult> {
  console.log('\n========================================');
  console.log('=== CRAFT-PRIMARY HYBRID DETECTION ===');
  console.log('========================================');
  console.log('Strategy: CRAFT for placement, Claude for text\n');

  const overallStartTime = Date.now();
  const timings = {
    layoutDetectionMs: 0,
    claudeOcrMs: 0,
    craftDetectionMs: 0,
    mergingMs: 0,
    totalMs: 0,
  };

  const craftPrimaryResult = await performCraftPrimaryDetection(
    imageBlob,
    imageWidth,
    imageHeight
  );

  timings.craftDetectionMs = craftPrimaryResult.timings.craftDetectionMs;
  timings.claudeOcrMs = craftPrimaryResult.timings.claudeOcrMs;

  if (craftPrimaryResult.craftBoxCount === 0) {
    console.warn('⚠ CRAFT-primary detection returned no results, falling back to Claude-based detection');
    const fallbackResult = await analyzeSlideImageWithLayoutDetection(
      imageBlob,
      imageWidth,
      imageHeight
    );
    timings.totalMs = Date.now() - overallStartTime;

    return {
      analysis: fallbackResult.analysis,
      regions: fallbackResult.regions,
      detectionStats: {
        claudeCount: fallbackResult.analysis.textElements.length,
        craftCount: 0,
        mergedCount: fallbackResult.analysis.textElements.length,
        overlapCount: 0,
        claudeOnlyCount: fallbackResult.analysis.textElements.length,
        craftOnlyCount: 0,
      },
      timings,
    };
  }

  const detectionStats = {
    claudeCount: 0,
    craftCount: craftPrimaryResult.craftBoxCount,
    mergedCount: craftPrimaryResult.analysis.textElements.length,
    overlapCount: craftPrimaryResult.ocrSuccessCount,
    claudeOnlyCount: 0,
    craftOnlyCount: craftPrimaryResult.craftBoxCount - craftPrimaryResult.ocrSuccessCount,
  };

  timings.totalMs = craftPrimaryResult.timings.totalMs;

  console.log('\n========================================');
  console.log('Performance Summary:');
  console.log(`  CRAFT Detection: ${timings.craftDetectionMs}ms`);
  console.log(`  Claude OCR: ${timings.claudeOcrMs}ms`);
  console.log(`  Total: ${timings.totalMs}ms`);
  console.log('\nResults:');
  console.log(`  CRAFT boxes: ${detectionStats.craftCount}`);
  console.log(`  Successful OCR: ${detectionStats.overlapCount}`);
  console.log(`  Final elements: ${detectionStats.mergedCount}`);
  console.log('========================================');
  console.log('=== CRAFT-PRIMARY DETECTION COMPLETE ===');
  console.log('========================================\n');

  return {
    analysis: craftPrimaryResult.analysis,
    regions: [],
    detectionStats,
    timings,
  };
}

export async function performDBNetPrimaryHybridDetection(
  imageBlob: Blob,
  imageWidth: number,
  imageHeight: number
): Promise<HybridDetectionResult> {
  console.log('\n========================================');
  console.log('=== DBNET-PRIMARY HYBRID DETECTION ===');
  console.log('========================================');
  console.log('Strategy: DBNet for placement, Claude for text\n');

  const overallStartTime = Date.now();
  const timings = {
    layoutDetectionMs: 0,
    claudeOcrMs: 0,
    craftDetectionMs: 0,
    mergingMs: 0,
    totalMs: 0,
  };

  const dbnetPrimaryResult = await performDBNetPrimaryDetection(
    imageBlob,
    imageWidth,
    imageHeight
  );

  timings.craftDetectionMs = dbnetPrimaryResult.timings.dbnetDetectionMs;
  timings.claudeOcrMs = dbnetPrimaryResult.timings.claudeOcrMs;

  if (dbnetPrimaryResult.dbnetBoxCount === 0) {
    console.warn('⚠ DBNet-primary detection returned no results, falling back to Claude-based detection');
    const fallbackResult = await analyzeSlideImageWithLayoutDetection(
      imageBlob,
      imageWidth,
      imageHeight
    );
    timings.totalMs = Date.now() - overallStartTime;

    return {
      analysis: fallbackResult.analysis,
      regions: fallbackResult.regions,
      detectionStats: {
        claudeCount: fallbackResult.analysis.textElements.length,
        craftCount: 0,
        mergedCount: fallbackResult.analysis.textElements.length,
        overlapCount: 0,
        claudeOnlyCount: fallbackResult.analysis.textElements.length,
        craftOnlyCount: 0,
      },
      timings,
    };
  }

  const detectionStats = {
    claudeCount: 0,
    craftCount: dbnetPrimaryResult.dbnetBoxCount,
    mergedCount: dbnetPrimaryResult.analysis.textElements.length,
    overlapCount: dbnetPrimaryResult.ocrSuccessCount,
    claudeOnlyCount: 0,
    craftOnlyCount: dbnetPrimaryResult.dbnetBoxCount - dbnetPrimaryResult.ocrSuccessCount,
  };

  timings.totalMs = dbnetPrimaryResult.timings.totalMs;

  console.log('\n========================================');
  console.log('Performance Summary:');
  console.log(`  DBNet Detection: ${timings.craftDetectionMs}ms`);
  console.log(`  Claude OCR: ${timings.claudeOcrMs}ms`);
  console.log(`  Total: ${timings.totalMs}ms`);
  console.log('\nResults:');
  console.log(`  DBNet boxes: ${detectionStats.craftCount}`);
  console.log(`  Successful OCR: ${detectionStats.overlapCount}`);
  console.log(`  Final elements: ${detectionStats.mergedCount}`);
  console.log('========================================');
  console.log('=== DBNET-PRIMARY DETECTION COMPLETE ===');
  console.log('========================================\n');

  return {
    analysis: dbnetPrimaryResult.analysis,
    regions: [],
    detectionStats,
    timings,
  };
}
