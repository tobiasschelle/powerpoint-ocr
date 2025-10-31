import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { DetectedTextElement } from '../types';

export interface ClonedSlideData {
  slideNumber: number;
  hasOriginalContent: boolean;
}

export async function checkSlideHasOriginalContent(
  buffer: ArrayBuffer,
  slideNumber: number
): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFilePath = `ppt/slides/slide${slideNumber}.xml`;
    const slideFile = zip.file(slideFilePath);

    if (!slideFile) {
      return false;
    }

    const slideXML = await slideFile.async('text');

    const hasTextBoxes = /<p:sp[^>]*>/.test(slideXML);
    const hasTables = /<a:tbl[^>]*>/.test(slideXML);
    const hasGraphics = /<p:pic[^>]*>/.test(slideXML);

    return hasTextBoxes || hasTables || hasGraphics;
  } catch (error) {
    console.warn(`Error checking slide ${slideNumber} content:`, error);
    return false;
  }
}

export async function clonePPTXWithTextOverlays(
  originalFile: File,
  slideTextOverlays: Map<number, DetectedTextElement[]>
): Promise<Blob> {
  console.log('=== Starting clonePPTXWithTextOverlays ===' );
  const buffer = await originalFile.arrayBuffer();
  const originalZip = await JSZip.loadAsync(buffer);

  const overlayPptx = new PptxGenJS();
  overlayPptx.layout = 'LAYOUT_16x9';

  const slideCount = slideTextOverlays.size;
  console.log(`Creating ${slideCount} overlay slides`);

  for (let i = 1; i <= slideCount; i++) {
    const textElements = slideTextOverlays.get(i) || [];
    console.log(`\nSlide ${i}: Creating overlay with ${textElements.length} text elements`);
    const slide = overlayPptx.addSlide();

    // Transparent background so original content shows through
    slide.background = { fill: 'FFFFFF', transparency: 100 };

    textElements.forEach((element, idx) => {
      console.log(`  Overlay ${idx + 1}: "${element.content.substring(0, 30)}..."`);
      console.log(`    Position: (${element.position_x.toFixed(3)}", ${element.position_y.toFixed(3)}") Size: ${element.width.toFixed(3)}"×${element.height.toFixed(3)}"`);

      const fontSize = element.font_size || 14;

      try {
        slide.addText(element.content, {
          x: element.position_x,
          y: element.position_y,
          w: element.width,
          h: element.height,
          fontSize: fontSize,
          fontFace: element.font_family || 'Arial',
          color: '000000',
          align: 'center',
          valign: 'middle',
          bold: element.is_bold || false,
          italic: element.is_italic || false,
          underline: element.is_underline ? { style: 'sng' } : undefined,
          fill: { color: 'FFFF00', transparency: 30 }, // Semi-transparent yellow
          line: { color: 'FFD700', width: 1 }, // Gold border for visibility
          wrap: true,
          shrinkText: true,
          autoFit: true,
        });
        console.log(`    ✓ Added successfully`);
      } catch (error) {
        console.error(`    ✗ Error adding overlay:`, error);
      }
    });
    console.log(`Slide ${i}: Overlay slide created with ${textElements.length} elements`);
  }

  const overlayBlob = await overlayPptx.write({ outputType: 'blob' }) as Blob;
  console.log(`Overlay PPTX generated: ${overlayBlob.size} bytes`);
  const overlayZip = await JSZip.loadAsync(overlayBlob);

  const mergedZip = await mergeSlides(originalZip, overlayZip, slideCount);

  const result = await mergedZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
  console.log(`Merged PPTX generated: ${result.size} bytes`);
  console.log('=== clonePPTXWithTextOverlays complete ===');
  return result;
}

async function mergeSlides(
  originalZip: JSZip,
  overlayZip: JSZip,
  slideCount: number
): Promise<JSZip> {
  console.log('=== Starting slide merge ===' );
  const mergedZip = new JSZip();

  originalZip.forEach((relativePath, file) => {
    if (!file.dir) {
      mergedZip.file(relativePath, file.async('arraybuffer'));
    }
  });

  for (let i = 1; i <= slideCount; i++) {
    const overlaySlideFile = overlayZip.file(`ppt/slides/slide${i}.xml`);
    if (!overlaySlideFile) {
      console.log(`Slide ${i}: No overlay slide file found`);
      continue;
    }

    const overlaySlideXML = await overlaySlideFile.async('text');
    const originalSlideFile = mergedZip.file(`ppt/slides/slide${i}.xml`);

    if (originalSlideFile) {
      const originalSlideXML = await originalSlideFile.async('text');
      console.log(`Slide ${i}: Merging overlay with original...`);
      const mergedSlideXML = mergeSlideXML(originalSlideXML, overlaySlideXML, i);
      mergedZip.file(`ppt/slides/slide${i}.xml`, mergedSlideXML);
    } else {
      console.log(`Slide ${i}: No original slide file found`);
    }
  }

  console.log('=== Slide merge complete ===');
  return mergedZip;
}

function mergeSlideXML(originalXML: string, overlayXML: string, slideNumber: number): string {
  const overlayShapes = extractShapes(overlayXML);

  console.log(`Slide ${slideNumber}: Extracted ${overlayShapes.length} overlay shapes`);

  if (overlayShapes.length === 0) {
    console.log(`Slide ${slideNumber}: No overlay shapes to merge`);
    return originalXML;
  }

  if (overlayShapes[0]) {
    const preview = overlayShapes[0].substring(0, 300).replace(/\n/g, ' ');
    console.log(`Slide ${slideNumber}: First shape preview: ${preview}...`);
  }

  const spTreeEndMatch = originalXML.lastIndexOf('</p:spTree>');

  if (spTreeEndMatch === -1) {
    console.log(`Slide ${slideNumber}: Could not find </p:spTree> tag in original XML`);
    return originalXML;
  }

  const before = originalXML.substring(0, spTreeEndMatch);
  const after = originalXML.substring(spTreeEndMatch);
  const modifiedShapes = overlayShapes.map(shape => ensureShapeVisibility(shape));

  console.log(`Slide ${slideNumber}: Adding ${modifiedShapes.length} shapes to original slide`);
  const result = before + '\n' + modifiedShapes.join('\n') + '\n' + after;
  console.log(`Slide ${slideNumber}: Merged XML length: ${result.length} (original: ${originalXML.length}, added: ${result.length - originalXML.length} bytes)`);
  return result;
}

function extractShapes(xml: string): string[] {
  const shapes: string[] = [];

  const spTreeMatch = xml.match(/<p:spTree[\s\S]*<\/p:spTree>/);
  if (!spTreeMatch) {
    console.log('No p:spTree found in overlay XML');
    return shapes;
  }

  const spTreeContent = spTreeMatch[0];

  const spRegex = /<p:sp(?![\w])[\s\S]*?<\/p:sp>/g;
  let match;

  while ((match = spRegex.exec(spTreeContent)) !== null) {
    const shapeXML = match[0];
    if (shapeXML.includes('<a:t>')) {
      shapes.push(shapeXML);
    }
  }

  console.log(`Extracted ${shapes.length} individual shapes from overlay`);
  return shapes;
}

function ensureShapeVisibility(shapeXML: string): string {
  if (!shapeXML.includes('<a:solidFill>')) {
    const solidFillPattern = /<a:solidFill>\s*<a:srgbClr val="FFFF00"\s*\/?>\s*<\/a:solidFill>/;
    if (!solidFillPattern.test(shapeXML)) {
      const spPrMatch = shapeXML.match(/(<p:spPr[\s\S]*?>)/);
      if (spPrMatch && spPrMatch[1]) {
        const insertPosition = shapeXML.indexOf(spPrMatch[1]) + spPrMatch[1].length;
        const fillXML = '<a:solidFill><a:srgbClr val="FFFF00"/></a:solidFill>';
        shapeXML = shapeXML.substring(0, insertPosition) + fillXML + shapeXML.substring(insertPosition);
      }
    }
  }

  return shapeXML;
}
