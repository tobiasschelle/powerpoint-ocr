export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridElement {
  type: 'text' | 'table';
  content: string;
  fontSize: number;
  index: number;
}

const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;
const MARGIN = 0.5;
const MIN_SPACING = 0.2;

export function calculateGridLayout(totalElements: number): {
  columns: number;
  rows: number;
  columnWidth: number;
  rowHeight: number;
} {
  const columns = Math.ceil(Math.sqrt(totalElements));
  const rows = Math.ceil(totalElements / columns);

  const availableWidth = SLIDE_WIDTH - (2 * MARGIN);
  const availableHeight = SLIDE_HEIGHT - (2 * MARGIN);

  const columnWidth = availableWidth / columns;
  const rowHeight = availableHeight / rows;

  return { columns, rows, columnWidth, rowHeight };
}

export function calculateGridPosition(
  elementIndex: number,
  totalElements: number,
  element: GridElement
): GridPosition {
  const layout = calculateGridLayout(totalElements);

  const row = Math.floor(elementIndex / layout.columns);
  const col = elementIndex % layout.columns;

  const baseX = MARGIN + (col * layout.columnWidth);
  const baseY = MARGIN + (row * layout.rowHeight);

  const width = calculateElementWidth(element, layout.columnWidth);
  const height = calculateElementHeight(element, layout.rowHeight, width);

  const centeredX = baseX + (layout.columnWidth - width) / 2;
  const centeredY = baseY + (layout.rowHeight - height) / 2;

  const x = Math.max(MARGIN, Math.min(centeredX, SLIDE_WIDTH - MARGIN - width));
  const y = Math.max(MARGIN, Math.min(centeredY, SLIDE_HEIGHT - MARGIN - height));

  return { x, y, width, height };
}

function calculateElementWidth(element: GridElement, maxWidth: number): number {
  if (element.type === 'table') {
    return Math.min(maxWidth - MIN_SPACING, 4);
  }

  const charCount = element.content.length;
  const fontSize = element.fontSize;

  const avgCharWidthInPoints = fontSize * 0.55;
  const pointsPerInch = 72;
  const estimatedWidth = (charCount * avgCharWidthInPoints) / pointsPerInch;

  const width = Math.min(estimatedWidth * 1.15, maxWidth - MIN_SPACING * 1.5);

  return Math.max(0.4, Math.min(width, SLIDE_WIDTH - (2 * MARGIN)));
}

function calculateElementHeight(element: GridElement, maxHeight: number, width: number): number {
  if (element.type === 'table') {
    return Math.min(maxHeight - MIN_SPACING, 2);
  }

  const fontSize = element.fontSize;
  const pointsPerInch = 72;

  const charsPerLine = calculateCharsPerLine(width, fontSize);
  const totalLines = Math.ceil(element.content.length / charsPerLine);

  const lineHeightInInches = (fontSize * 1.35) / pointsPerInch;
  const padding = 0.1;

  const calculatedHeight = (totalLines * lineHeightInInches) + padding;

  return Math.max(0.25, Math.min(calculatedHeight, maxHeight - MIN_SPACING * 1.5));
}

function calculateCharsPerLine(widthInInches: number, fontSize: number): number {
  const pointsPerInch = 72;
  const avgCharWidthInPoints = fontSize * 0.53;
  const widthInPoints = widthInInches * pointsPerInch;
  const charsPerLine = Math.floor(widthInPoints / avgCharWidthInPoints);

  return Math.max(1, charsPerLine);
}
