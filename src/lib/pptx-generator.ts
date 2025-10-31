import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { AIAnalysisResult, DetectedTextElement } from '../types';
import { clonePPTXWithTextOverlays, checkSlideHasOriginalContent } from './slide-cloner';

export interface SlideElements {
  slideNumber: number;
  analysis: AIAnalysisResult;
  imageWidth: number;
  imageHeight: number;
  imageBlob?: Blob;
}

async function fixPptxBlob(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);

  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!contentTypesFile) {
    return blob;
  }

  let contentTypesXml = await contentTypesFile.async('string');

  console.log('=== DEBUGGING PPTX STRUCTURE ===');
  console.log('Files in PPTX:');
  Object.keys(zip.files).forEach(path => {
    if (!zip.files[path].dir) {
      console.log(`  ${path}`);
    }
  });

  const allFiles = Object.keys(zip.files).filter(path => {
    const file = zip.files[path];
    return file && !file.dir;
  });

  const extensionsUsed = new Set<string>();
  allFiles.forEach(path => {
    const match = path.match(/\.([^.]+)$/);
    if (match) {
      extensionsUsed.add(match[1].toLowerCase());
    }
  });

  console.log('Extensions used:', Array.from(extensionsUsed));

  console.log('\n=== Checking all .rels files ===');
  for (const [path, file] of Object.entries(zip.files)) {
    if (!file.dir && path.endsWith('.rels')) {
      let relsContent = await file.async('string');
      console.log(`\n${path}:`);
      console.log(relsContent.substring(0, 500));

      const hasTheme2Reference = relsContent.includes('theme2.xml');
      const hasTheme2File = zip.file('ppt/theme/theme2.xml') !== null;

      if (hasTheme2Reference && !hasTheme2File) {
        console.log(`  -> Fixing theme2 reference in ${path} -> theme1.xml`);
        relsContent = relsContent.replace(/theme2\.xml/g, 'theme1.xml');
        zip.file(path, relsContent);
      }
    }
  }

  console.log('\nOriginal [Content_Types].xml:');
  console.log(contentTypesXml);

  const overrideMatches = contentTypesXml.match(/<Override[^>]*\/>/g) || [];
  console.log(`\nFound ${overrideMatches.length} Override entries`);

  const filteredOverrides = overrideMatches
    .map(override => override.trim())
    .filter(override => {
      if (override.includes('theme2.xml')) {
        console.log('Removing theme2.xml override');
        return zip.file('ppt/theme/theme2.xml') !== null;
      }
      return true;
    });

  console.log(`After filtering: ${filteredOverrides.length} Override entries`);
  const overrides = filteredOverrides.join('\n    ');

  const defaults: string[] = [
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>'
  ];

  if (extensionsUsed.has('png')) {
    defaults.push('<Default Extension="png" ContentType="image/png"/>');
  }
  if (extensionsUsed.has('jpg') || extensionsUsed.has('jpeg')) {
    defaults.push('<Default Extension="jpeg" ContentType="image/jpeg"/>');
  }
  if (extensionsUsed.has('gif')) {
    defaults.push('<Default Extension="gif" ContentType="image/gif"/>');
  }

  const newContentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    ${defaults.join('\n    ')}
    ${overrides}
</Types>`;

  console.log('\nNew [Content_Types].xml:');
  console.log(newContentTypesXml);

  zip.file('[Content_Types].xml', newContentTypesXml);

  Object.keys(zip.files).forEach(path => {
    const file = zip.files[path];
    if (file && file.dir && path !== '') {
      const hasFiles = Object.keys(zip.files).some(
        filePath => {
          const childFile = zip.files[filePath];
          return childFile && filePath.startsWith(path) && !childFile.dir && filePath !== path;
        }
      );
      if (!hasFiles) {
        zip.remove(path);
      }
    }
  });

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
}

export async function generateEditablePPTX(slides: SlideElements[], filename: string): Promise<Blob> {
  console.log(`Generating PPTX with ${slides.length} slides`);

  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'AI-Powered PPTX Converter';
  pptx.title = filename;

  slides.forEach((slideElements, index) => {
    console.log(`Generating slide ${index + 1}`);
    console.log(`  Input analysis contains:`);
    console.log(`    - ${slideElements.analysis.textElements?.length || 0} text elements`);

    const slide = pptx.addSlide();

    addElementsToSlide(slide, slideElements.analysis);

    const totalElements = slideElements.analysis.textElements?.length || 0;

    if (totalElements === 0) {
      console.warn(`Slide ${index + 1} has no detected elements`);
      slide.addText('No elements detected on this slide', {
        x: 1,
        y: 2.5,
        w: 8,
        h: 0.5,
        fontSize: 24,
        color: 'CCCCCC',
        align: 'center'
      });
    } else {
      console.log(`Slide ${index + 1}: Successfully added ${totalElements} total elements`);
    }
  });

  console.log('Writing PPTX file...');
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  console.log(`PPTX generated: ${blob.size} bytes`);
  console.log('Fixing PPTX content types...');
  const fixedBlob = await fixPptxBlob(blob);
  console.log(`Fixed PPTX: ${fixedBlob.size} bytes`);
  return fixedBlob;
}

function addElementsToSlide(slide: any, analysis: AIAnalysisResult) {
  const textElements = analysis.textElements || [];

  console.log(`  Rendering ${textElements.length} text elements`);

  addTextToSlide(slide, textElements);
}

function addTextToSlide(slide: any, textElements: DetectedTextElement[]) {
  textElements.forEach((element, idx) => {
    console.log(`  Adding text ${idx + 1}: "${element.content.substring(0, 30)}..."`);

    const adjustedFontSize = calculateOptimalFontSize(
      element.content,
      element.width,
      element.height,
      element.font_size || 14
    );

    console.log(`    Original font: ${element.font_size}pt, Adjusted font: ${adjustedFontSize}pt for text length ${element.content.length}`);

    const textOptions: any = {
      x: element.position_x,
      y: element.position_y,
      w: element.width,
      h: element.height,
      fontSize: adjustedFontSize,
      fontFace: element.font_family || 'Arial',
      color: '000000',
      align: element.align || 'left',
      valign: element.vertical_align || 'top',
      bold: element.is_bold || false,
      italic: element.is_italic || false,
      underline: element.is_underline ? { style: 'single' } : undefined,
      wrap: true,
      shrinkText: true,
      autoFit: true,
    };

    try {
      slide.addText(element.content, textOptions);
    } catch (error) {
      console.error(`Error adding text element ${idx + 1}:`, error);
    }
  });
}

function calculateOptimalFontSize(
  text: string,
  boxWidth: number,
  boxHeight: number,
  originalFontSize: number
): number {
  const textLength = text.length;
  const boxArea = boxWidth * boxHeight;

  // Estimate characters per line based on box width and font size
  // Average character width is approximately fontSize/72 * 0.6 inches
  const avgCharWidth = (originalFontSize / 72) * 0.6;
  const charsPerLine = Math.max(1, Math.floor(boxWidth / avgCharWidth));
  const estimatedLines = Math.ceil(textLength / charsPerLine);

  // Calculate required height with proper line spacing (1.2x line height)
  const lineHeightInInches = (originalFontSize * 1.2) / 72;
  const requiredHeight = estimatedLines * lineHeightInInches;

  let adjustedFontSize = originalFontSize;

  // Scale down if text doesn't fit
  if (requiredHeight > boxHeight) {
    const scaleFactor = boxHeight / requiredHeight;
    adjustedFontSize = Math.max(8, originalFontSize * scaleFactor * 0.85);
  }

  // Apply size constraints based on box dimensions
  if (boxArea < 0.3) {
    // Very small boxes
    adjustedFontSize = Math.min(adjustedFontSize, 9);
  } else if (boxArea < 0.5) {
    // Small boxes
    adjustedFontSize = Math.min(adjustedFontSize, 10);
  } else if (boxArea < 1.0) {
    // Medium boxes
    adjustedFontSize = Math.min(adjustedFontSize, 12);
  } else if (boxArea < 2.0) {
    // Large boxes
    adjustedFontSize = Math.min(adjustedFontSize, 14);
  }

  // Additional constraints based on text length
  if (textLength > 200 && adjustedFontSize > 10) {
    adjustedFontSize = 10;
  } else if (textLength > 100 && adjustedFontSize > 11) {
    adjustedFontSize = 11;
  } else if (textLength > 50 && adjustedFontSize > 13) {
    adjustedFontSize = 13;
  }

  // Final bounds check
  return Math.max(8, Math.min(adjustedFontSize, 24));
}



export async function generateAnnotatedPPTX(
  slides: SlideElements[],
  filename: string,
  originalFile?: File
): Promise<Blob> {
  if (originalFile) {
    return generateAnnotatedPPTXWithCloning(slides, filename, originalFile);
  }
  return generateAnnotatedPPTXFallback(slides, filename);
}

async function generateAnnotatedPPTXWithCloning(
  slides: SlideElements[],
  filename: string,
  originalFile: File
): Promise<Blob> {
  console.log(`Generating annotated PPTX with ${slides.length} slides using original slide cloning`);

  try {
    const buffer = await originalFile.arrayBuffer();
    const slideTextOverlays = new Map<number, DetectedTextElement[]>();
    const imageFallbackSlides = new Map<number, Blob>();

    for (const slideElements of slides) {
      console.log(`Processing slide ${slideElements.slideNumber}: Checking for original content...`);

      const hasContent = await checkSlideHasOriginalContent(buffer, slideElements.slideNumber);

      if (hasContent) {
        console.log(`Slide ${slideElements.slideNumber}: Has original content, will preserve and add ${slideElements.analysis.textElements?.length || 0} overlays`);
        slideTextOverlays.set(slideElements.slideNumber, slideElements.analysis.textElements || []);
      } else if (slideElements.imageBlob) {
        console.log(`Slide ${slideElements.slideNumber}: No original content, will use image-based approach`);
        imageFallbackSlides.set(slideElements.slideNumber, slideElements.imageBlob);
        slideTextOverlays.set(slideElements.slideNumber, slideElements.analysis.textElements || []);
      } else {
        console.log(`Slide ${slideElements.slideNumber}: No content found`);
        slideTextOverlays.set(slideElements.slideNumber, []);
      }
    }

    if (imageFallbackSlides.size > 0) {
      console.log(`${imageFallbackSlides.size} slides need image backgrounds, falling back to full image-based approach`);
      return generateAnnotatedPPTXFallback(slides, filename);
    }

    console.log('All slides have original content, cloning with text overlays...');
    const blob = await clonePPTXWithTextOverlays(originalFile, slideTextOverlays);
    console.log(`Annotated PPTX with cloning generated: ${blob.size} bytes`);

    const isValid = await validateAnnotatedPPTX(blob, slides.length);
    if (!isValid) {
      console.warn('Validation failed: annotated PPTX appears empty or invalid, falling back...');
      return generateAnnotatedPPTXFallback(slides, filename);
    }

    return blob;
  } catch (error) {
    console.error('Error generating annotated PPTX with cloning:', error);
    console.log('Falling back to image-based approach...');
    return generateAnnotatedPPTXFallback(slides, filename);
  }
}

async function generateAnnotatedPPTXFallback(slides: SlideElements[], filename: string): Promise<Blob> {
  console.log(`Generating annotated PPTX with ${slides.length} slides using fallback image approach`);

  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'AI-Powered PPTX Converter';
  pptx.title = filename;

  for (const slideElements of slides) {
    const slide = pptx.addSlide();

    if (slideElements.imageBlob) {
      const base64Image = await blobToBase64(slideElements.imageBlob);

      slide.addImage({
        data: base64Image,
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
        sizing: { type: 'cover', w: 10, h: 5.625 }
      });

      console.log(`Slide ${slideElements.slideNumber}: Added background image`);
    }

    addAnnotatedTextToSlide(slide, slideElements.analysis.textElements || []);

    console.log(`Slide ${slideElements.slideNumber}: Added ${slideElements.analysis.textElements?.length || 0} text overlays`);
  }

  console.log('Writing annotated PPTX file...');
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  console.log(`Annotated PPTX generated: ${blob.size} bytes`);
  console.log('Fixing PPTX content types...');
  const fixedBlob = await fixPptxBlob(blob);
  console.log(`Fixed annotated PPTX: ${fixedBlob.size} bytes`);
  return fixedBlob;
}

function addAnnotatedTextToSlide(slide: any, textElements: DetectedTextElement[]) {
  console.log(`\n=== RENDERING ${textElements.length} ANNOTATED TEXT OVERLAYS ===`);

  textElements.forEach((element, idx) => {
    console.log(`\nOverlay ${idx + 1}/${textElements.length}:`);
    console.log(`  Text: "${element.content.substring(0, 40)}..."`);
    console.log(`  Position: (${element.position_x.toFixed(3)}", ${element.position_y.toFixed(3)}")`);
    console.log(`  Size: ${element.width.toFixed(3)}" × ${element.height.toFixed(3)}"`);

    const adjustedFontSize = calculateOptimalFontSize(
      element.content,
      element.width,
      element.height,
      element.font_size || 14
    );

    console.log(`  Font: ${element.font_size}pt → ${adjustedFontSize}pt (adjusted)`);

    // Use left/top alignment for more accurate positioning
    // This ensures the text box boundary matches the detected shape exactly
    const textOptions: any = {
      x: element.position_x,
      y: element.position_y,
      w: element.width,
      h: element.height,
      fontSize: adjustedFontSize,
      fontFace: element.font_family || 'Arial',
      color: '000000',
      align: 'center', // Center text horizontally within the box
      valign: 'middle', // Center text vertically within the box
      bold: element.is_bold || false,
      italic: element.is_italic || false,
      underline: element.is_underline ? { style: 'single' } : undefined,
      wrap: true,
      shrinkText: true,
      autoFit: true,
      fill: { color: 'FFFF00', transparency: 30 }, // Semi-transparent yellow fill
      line: { color: 'FFD700', width: 1 }, // Gold border to make overlay visible
    };

    try {
      slide.addText(element.content, textOptions);
      console.log(`  ✓ Successfully added overlay`);
    } catch (error) {
      console.error(`  ✗ Error adding annotated text element ${idx + 1}:`, error);
    }
  });

  console.log(`=== RENDERING COMPLETE ===\n`);
}


async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function validateAnnotatedPPTX(blob: Blob, expectedSlideCount: number): Promise<boolean> {
  try {
    console.log('=== Validating annotated PPTX ===');
    const zip = await JSZip.loadAsync(blob);

    let validSlideCount = 0;
    for (let i = 1; i <= expectedSlideCount; i++) {
      const slideFile = zip.file(`ppt/slides/slide${i}.xml`);
      if (slideFile) {
        const slideXML = await slideFile.async('text');

        const hasShapes = /<p:sp[\s\S]*?<\/p:sp>/g.test(slideXML);
        const shapeCount = (slideXML.match(/<p:sp[\s\S]*?<\/p:sp>/g) || []).length;

        console.log(`Slide ${i} validation: ${shapeCount} shapes found`);

        if (hasShapes && shapeCount > 0) {
          validSlideCount++;
        }
      }
    }

    console.log(`Validation result: ${validSlideCount}/${expectedSlideCount} slides have content`);
    return validSlideCount > 0;
  } catch (error) {
    console.error('Error validating annotated PPTX:', error);
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
