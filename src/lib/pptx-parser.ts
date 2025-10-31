import JSZip from 'jszip';
import { LayoutData, LayoutElement } from '../types';

export interface PPTXSlideImage {
  slideNumber: number;
  imageBlob: Blob;
  layout: LayoutData;
}

export async function parsePPTX(file: File): Promise<PPTXSlideImage[]> {
  const zip = await JSZip.loadAsync(file);

  const slideImages: PPTXSlideImage[] = [];
  const presentationXML = await getFileContent(zip, 'ppt/presentation.xml');

  const slideCount = countSlides(presentationXML);
  console.log(`Found ${slideCount} slide references in presentation.xml`);

  const mediaFolder = zip.folder('ppt/media');
  const slideFolder = zip.folder('ppt/slides');

  if (!slideFolder) {
    throw new Error('Invalid PPTX file: no slides found');
  }

  const allMediaFiles = mediaFolder ? mediaFolder.file(/.*/) : [];
  console.log(`Found ${allMediaFiles.length} media files:`, allMediaFiles.map(f => f.name));

  const actualSlideFiles = slideFolder.file(/slide\d+\.xml$/);
  const actualSlideCount = actualSlideFiles.length;
  console.log(`Found ${actualSlideCount} actual slide XML files:`, actualSlideFiles.map(f => f.name));

  const maxSlides = Math.max(slideCount, actualSlideCount);

  for (let i = 1; i <= maxSlides; i++) {
    try {
      const slideFilePath = `ppt/slides/slide${i}.xml`;
      const slideFile = zip.file(slideFilePath);

      if (!slideFile) {
        console.warn(`Slide ${i}: XML file not found at ${slideFilePath}, skipping...`);
        continue;
      }

      const slideXML = await slideFile.async('text');
      const layout = parseSlideLayout(slideXML);

      const imageFile = await findSlideImage(mediaFolder, i, allMediaFiles);

      if (imageFile) {
        console.log(`Slide ${i}: Found image, size: ${imageFile.size} bytes`);
        slideImages.push({
          slideNumber: i,
          imageBlob: imageFile,
          layout
        });
      } else {
        console.warn(`Slide ${i}: No image found, skipping...`);
      }
    } catch (error) {
      console.warn(`Could not process slide ${i}:`, error);
    }
  }

  if (slideImages.length === 0) {
    throw new Error('No slides could be processed from the PPTX file');
  }

  console.log(`Successfully processed ${slideImages.length} out of ${slideCount} slides`);
  return slideImages;
}

async function getFileContent(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  return await file.async('text');
}

function countSlides(presentationXML: string): number {
  const slideIdMatches = presentationXML.match(/<p:sldId/g);
  return slideIdMatches ? slideIdMatches.length : 0;
}

async function findSlideImage(mediaFolder: JSZip | null, slideNumber: number, allFiles: JSZip.JSZipObject[]): Promise<Blob | null> {
  if (!mediaFolder || allFiles.length === 0) return null;

  const imagePatterns = [
    `image${slideNumber}.png`,
    `image${slideNumber}.jpg`,
    `image${slideNumber}.jpeg`,
    `slide${slideNumber}.png`,
    `slide${slideNumber}.jpg`
  ];

  for (const pattern of imagePatterns) {
    const file = mediaFolder.file(pattern);
    if (file) {
      return await file.async('blob');
    }
  }

  if (slideNumber <= allFiles.length) {
    return await allFiles[slideNumber - 1].async('blob');
  }

  if (allFiles.length > 0) {
    console.log(`Using first available image for slide ${slideNumber}`);
    return await allFiles[0].async('blob');
  }

  return null;
}

function parseSlideLayout(slideXML: string): LayoutData {
  const elements: LayoutElement[] = [];

  const widthMatch = slideXML.match(/cx="(\d+)"/);
  const heightMatch = slideXML.match(/cy="(\d+)"/);

  const width = widthMatch ? parseInt(widthMatch[1]) / 9525 : 10;
  const height = heightMatch ? parseInt(heightMatch[1]) / 9525 : 7.5;

  const spRegex = /<p:sp[^>]*>[\s\S]*?<\/p:sp>/g;
  const shapes = slideXML.match(spRegex) || [];

  shapes.forEach(shape => {
    const element = parseShapeElement(shape);
    if (element) {
      elements.push(element);
    }
  });

  return {
    width,
    height,
    elements
  };
}

function parseShapeElement(shapeXML: string): LayoutElement | null {
  try {
    const xMatch = shapeXML.match(/<a:off x="(\d+)"/);
    const yMatch = shapeXML.match(/<a:off y="(\d+)"/);
    const cxMatch = shapeXML.match(/<a:ext cx="(\d+)"/);
    const cyMatch = shapeXML.match(/<a:ext cy="(\d+)"/);

    if (!xMatch || !yMatch || !cxMatch || !cyMatch) {
      return null;
    }

    const x = parseInt(xMatch[1]) / 914400;
    const y = parseInt(yMatch[1]) / 914400;
    const width = parseInt(cxMatch[1]) / 914400;
    const height = parseInt(cyMatch[1]) / 914400;

    const textMatch = shapeXML.match(/<a:t>([^<]*)<\/a:t>/);
    const content = textMatch ? textMatch[1] : undefined;

    return {
      type: 'text',
      x,
      y,
      width,
      height,
      content
    };
  } catch (error) {
    console.warn('Error parsing shape element:', error);
    return null;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
