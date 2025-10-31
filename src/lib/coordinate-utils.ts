export function pixelsToInches(pixels: number, imageSize: number, slideSize: number): number {
  if (imageSize === 0) {
    console.warn('Image size is 0, cannot convert pixels to inches');
    return 0;
  }

  const ratio = pixels / imageSize;
  const inches = ratio * slideSize;

  return inches;
}

export function inchesToPixels(inches: number, slideSize: number, imageSize: number): number {
  if (slideSize === 0) {
    console.warn('Slide size is 0, cannot convert inches to pixels');
    return 0;
  }

  const ratio = inches / slideSize;
  const pixels = ratio * imageSize;

  return pixels;
}

export function clampCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  maxWidth: number = 10,
  maxHeight: number = 5.625
): { x: number; y: number; width: number; height: number } {
  const clampedX = Math.max(0, Math.min(x, maxWidth));
  const clampedY = Math.max(0, Math.min(y, maxHeight));
  const clampedWidth = Math.max(0.1, Math.min(width, maxWidth - clampedX));
  const clampedHeight = Math.max(0.1, Math.min(height, maxHeight - clampedY));

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  };
}
