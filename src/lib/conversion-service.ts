import { supabase } from './supabase';
import { parsePPTX } from './pptx-parser';
import { analyzeSlideImage, analyzeSlideImageWithLayoutDetection } from './claude-vision';
import { performHybridDetection } from './hybrid-detector';
import { generateEditablePPTX, generateAnnotatedPPTX, SlideElements } from './pptx-generator';
import { Conversion, ConversionStatus } from '../types';
import { getUseHybridDetection, getUseCraftPrimary, getUseDBNet } from './settings-service';

export async function createConversion(filename: string, sessionId: string): Promise<Conversion> {
  const { data, error } = await supabase
    .from('conversions')
    .insert({
      original_filename: filename,
      session_id: sessionId,
      status: 'uploading'
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Failed to create conversion');
  return data;
}

export async function updateConversionStatus(
  conversionId: string,
  status: ConversionStatus,
  updates: Partial<Conversion> = {}
) {
  const { error } = await supabase
    .from('conversions')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...updates
    })
    .eq('id', conversionId);

  if (error) throw error;
}

export async function processConversion(
  file: File,
  conversionId: string,
  onProgress: (stage: ConversionStatus, current: number, total: number, message: string) => void
): Promise<{ cleanBlob: Blob; annotatedBlob: Blob }> {
  try {
    onProgress('parsing', 0, 100, 'Parsing PowerPoint file...');
    await updateConversionStatus(conversionId, 'parsing');

    const slideImages = await parsePPTX(file);
    const totalSlides = slideImages.length;

    await updateConversionStatus(conversionId, 'parsing', {
      total_slides: totalSlides
    });

    onProgress('analyzing', 0, totalSlides, `Found ${totalSlides} slides. Starting AI analysis...`);

    const slideElements: SlideElements[] = [];

    for (let i = 0; i < slideImages.length; i++) {
      const slideImage = slideImages[i];
      const slideNumber = i + 1;

      onProgress('analyzing', slideNumber, totalSlides, `Analyzing slide ${slideNumber} of ${totalSlides} with AI...`);

      const imageElement = await createImageFromBlob(slideImage.imageBlob);
      const imageWidth = imageElement.width;
      const imageHeight = imageElement.height;

      console.log(`Slide ${slideNumber}: Image dimensions ${imageWidth}x${imageHeight}`);

      let analysis, regions, detectionStats, timings;

      const useHybridDetection = getUseHybridDetection();
      const useCraftPrimary = getUseCraftPrimary();
      const useDBNet = getUseDBNet();

      if (useHybridDetection) {
        const hybridResult = await performHybridDetection(
          slideImage.imageBlob,
          imageWidth,
          imageHeight,
          true,
          useCraftPrimary,
          useDBNet
        );
        analysis = hybridResult.analysis;
        regions = hybridResult.regions;
        detectionStats = hybridResult.detectionStats;
        timings = hybridResult.timings;

        if (useCraftPrimary) {
          console.log(`Slide ${slideNumber} CRAFT-PRIMARY analysis result:`);
          console.log(`  - CRAFT boxes detected: ${detectionStats.craftCount}`);
          console.log(`  - Successful OCR: ${detectionStats.overlapCount}`);
          console.log(`  - Final text elements: ${analysis.textElements?.length || 0}`);
          console.log(`  - CRAFT detection time: ${timings.craftDetectionMs}ms`);
          console.log(`  - Claude OCR time: ${timings.claudeOcrMs}ms`);
          console.log(`  - Total time: ${timings.totalMs}ms`);
        } else {
          console.log(`Slide ${slideNumber} HYBRID analysis result:`);
          console.log(`  - Layout regions: ${regions.length}`);
          console.log(`  - Text elements: ${analysis.textElements?.length || 0}`);
          console.log(`  - Claude detections: ${detectionStats.claudeCount}`);
          console.log(`  - CRAFT detections: ${detectionStats.craftCount}`);
          console.log(`  - Merged count: ${detectionStats.mergedCount}`);
          console.log(`  - Total time: ${timings.totalMs}ms`);
        }
      } else {
        const layoutResult = await analyzeSlideImageWithLayoutDetection(
          slideImage.imageBlob,
          imageWidth,
          imageHeight
        );
        analysis = layoutResult.analysis;
        regions = layoutResult.regions;

        console.log(`Slide ${slideNumber} analysis result:`);
        console.log(`  - Layout regions: ${regions.length}`);
        console.log(`  - Text elements: ${analysis.textElements?.length || 0}`);
        console.log(`  - Tables: ${analysis.tables?.length || 0}`);
      }

      if (analysis.textElements && analysis.textElements.length > 0) {
        console.log(`  First text element: "${analysis.textElements[0].content.substring(0, 50)}..."`);
      }

      const { data: slide } = await supabase
        .from('slides')
        .insert({
          conversion_id: conversionId,
          slide_number: slideNumber,
          status: 'analyzing',
          image_width: imageWidth,
          image_height: imageHeight,
        })
        .select()
        .maybeSingle();

      if (slide) {
        await saveLayoutRegions(slide.id, regions);
        await saveDetectedElements(slide.id, analysis);

        if (useHybridDetection && detectionStats) {
          await saveDetectionComparison(slide.id, detectionStats, timings);
        }

        await supabase
          .from('slides')
          .update({
            status: 'completed',
            ai_analysis_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', slide.id);
      }

      slideElements.push({
        slideNumber,
        analysis,
        imageWidth,
        imageHeight,
        imageBlob: slideImage.imageBlob,
      });

      await updateConversionStatus(conversionId, 'analyzing', {
        processed_slides: slideNumber,
        progress_percentage: Math.round((slideNumber / totalSlides) * 90)
      });
    }

    onProgress('generating', totalSlides, totalSlides, 'Generating clean PowerPoint...');
    await updateConversionStatus(conversionId, 'generating', {
      progress_percentage: 90
    });

    const cleanBlob = await generateEditablePPTX(slideElements, file.name);

    onProgress('generating', totalSlides, totalSlides, 'Generating annotated PowerPoint...');
    await updateConversionStatus(conversionId, 'generating', {
      progress_percentage: 95
    });

    const annotatedBlob = await generateAnnotatedPPTX(slideElements, file.name, file);

    onProgress('completed', totalSlides, totalSlides, 'Conversion complete!');
    await updateConversionStatus(conversionId, 'completed', {
      progress_percentage: 100,
      completed_at: new Date().toISOString()
    });

    return { cleanBlob, annotatedBlob };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    await updateConversionStatus(conversionId, 'failed', {
      error_message: errorMessage
    });

    throw error;
  }
}

async function saveLayoutRegions(slideId: string, regions: any[]) {
  try {
    if (regions && regions.length > 0) {
      const regionsWithSlideId = regions.map((region: any) => ({
        slide_id: slideId,
        region_type: region.type,
        position_x: region.x,
        position_y: region.y,
        width: region.width,
        height: region.height,
        confidence_score: region.confidence,
        contains_text: region.contains_text,
        background_color: region.background_color,
        border_color: region.border_color,
        shape_type: region.shape_type,
      }));
      await supabase.from('detected_layout_regions').insert(regionsWithSlideId);
      console.log(`  Saved ${regions.length} layout regions to database`);
    }
  } catch (error) {
    console.error('Error saving layout regions:', error);
  }
}

async function saveDetectedElements(slideId: string, analysis: any) {
  try {
    if (analysis.textElements && analysis.textElements.length > 0) {
      const textElementsWithSlideId = analysis.textElements.map((element: any) => ({
        ...element,
        slide_id: slideId,
        detection_source: element.detection_source || 'claude',
      }));
      await supabase.from('detected_text_elements').insert(textElementsWithSlideId);
      console.log(`  Saved ${analysis.textElements.length} text elements to database`);
    }

    if (analysis.tables && analysis.tables.length > 0) {
      for (const table of analysis.tables) {
        const { cells, ...tableWithoutCells } = table;

        const { data: insertedTable } = await supabase
          .from('detected_tables')
          .insert({
            ...tableWithoutCells,
            slide_id: slideId,
          })
          .select()
          .maybeSingle();

        if (insertedTable && cells && cells.length > 0) {
          const cellsWithTableId = cells.map((cell: any) => ({
            ...cell,
            table_id: insertedTable.id,
          }));
          await supabase.from('table_cells').insert(cellsWithTableId);
        }
      }
      console.log(`  Saved ${analysis.tables.length} tables to database`);
    }
  } catch (error) {
    console.error('Error saving detected elements:', error);
  }
}

async function saveDetectionComparison(
  slideId: string,
  stats: any,
  timings: any
) {
  try {
    await supabase.from('detection_comparison').insert({
      slide_id: slideId,
      claude_count: stats.claudeCount,
      craft_count: stats.craftCount,
      merged_count: stats.mergedCount,
      overlap_count: stats.overlapCount,
      claude_only_count: stats.claudeOnlyCount,
      craft_only_count: stats.craftOnlyCount,
      merge_duration_ms: timings.mergingMs,
    });
    console.log(`  Saved detection comparison to database`);
  } catch (error) {
    console.error('Error saving detection comparison:', error);
  }
}

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
