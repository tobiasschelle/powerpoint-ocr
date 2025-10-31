export type ConversionStatus = 'uploading' | 'parsing' | 'analyzing' | 'generating' | 'completed' | 'failed';

export type SlideStatus = 'pending' | 'extracting' | 'analyzing' | 'completed' | 'failed';

export type ElementType = 'text' | 'table';

export type TextAlign = 'left' | 'center' | 'right';

export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface Conversion {
  id: string;
  status: ConversionStatus;
  original_filename: string;
  total_slides: number;
  processed_slides: number;
  progress_percentage: number;
  error_message?: string;
  output_file_url?: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Slide {
  id: string;
  conversion_id: string;
  slide_number: number;
  status: SlideStatus;
  image_data?: string;
  ocr_text?: string;
  layout_data?: LayoutData;
  image_width?: number;
  image_height?: number;
  ai_analysis_completed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DetectedTable {
  id?: string;
  slide_id?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  row_count: number;
  column_count: number;
  has_header?: boolean;
  border_style?: 'all' | 'outer' | 'none';
  confidence_score?: number;
  cells: TableCell[];
}

export interface TableCell {
  id?: string;
  table_id?: string;
  row_index: number;
  column_index: number;
  content: string;
  font_size?: number;
  font_color?: string;
  background_color?: string;
  is_bold?: boolean;
  is_italic?: boolean;
  align?: TextAlign;
  vertical_align?: VerticalAlign;
}

export interface DetectedTextElement {
  id?: string;
  slide_id?: string;
  content: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  font_family?: string;
  font_size?: number;
  font_color?: string;
  is_bold?: boolean;
  is_italic?: boolean;
  is_underline?: boolean;
  align?: TextAlign;
  vertical_align?: VerticalAlign;
  confidence_score?: number;
  parent_shape_id?: string;
  detection_source?: 'claude' | 'craft' | 'hybrid';
  craft_detection_id?: string;
}

export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'diamond' | 'triangle' | 'roundRect';

export type ArrowHeadType = 'none' | 'triangle' | 'arrow' | 'diamond' | 'oval';

export type LineStyle = 'solid' | 'dash' | 'dashDot' | 'lgDash' | 'dot';

export interface DetectedShape {
  id?: string;
  slide_id?: string;
  shape_type: ShapeType;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  fill_color?: string;
  border_color?: string;
  border_width?: number;
  rotation?: number;
  opacity?: number;
  confidence_score?: number;
  line_style?: LineStyle;
  is_arrow?: boolean;
  arrow_head_start?: ArrowHeadType;
  arrow_head_end?: ArrowHeadType;
  rounded_corners?: number;
}

export interface DetectedConnector {
  id?: string;
  slide_id?: string;
  connector_type: 'straight' | 'elbow' | 'curved';
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  control_points?: Array<{ x: number; y: number }>;
  line_style?: LineStyle;
  line_color?: string;
  line_width?: number;
  arrow_head_start?: ArrowHeadType;
  arrow_head_end?: ArrowHeadType;
  connected_from_shape_id?: string;
  connected_to_shape_id?: string;
  text_label?: string;
  confidence_score?: number;
}

export interface DetectedCurvedLine {
  id?: string;
  slide_id?: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  control_points: Array<{ x: number; y: number }>;
  line_style?: LineStyle;
  line_color?: string;
  line_width?: number;
  confidence_score?: number;
}

export interface AIAnalysisResult {
  tables: DetectedTable[];
  textElements: DetectedTextElement[];
}

export interface VerificationResult {
  id?: string;
  slide_id?: string;
  original_image_data?: string;
  generated_image_data?: string;
  overall_similarity_score: number;
  missing_elements: MissingElement[];
  positioning_errors: PositioningError[];
  styling_differences: StylingDifference[];
  verification_passed: boolean;
  suggestions: string[];
  created_at?: string;
}

export interface MissingElement {
  element_type: 'text' | 'table';
  description: string;
  approximate_position?: { x: number; y: number };
  confidence: number;
}

export interface PositioningError {
  element_id?: string;
  element_type: string;
  expected_position: { x: number; y: number };
  actual_position: { x: number; y: number };
  error_distance: number;
}

export interface StylingDifference {
  element_id?: string;
  element_type: string;
  property: string;
  expected_value: string;
  actual_value: string;
  severity: 'low' | 'medium' | 'high';
}

export interface LayoutData {
  width: number;
  height: number;
  background?: string;
  elements: LayoutElement[];
}

export interface LayoutElement {
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
}

export interface StyleData {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
}

export interface ProcessingProgress {
  stage: ConversionStatus;
  currentSlide: number;
  totalSlides: number;
  percentage: number;
  message: string;
}

export interface CraftDetection {
  id?: string;
  slide_id: string;
  detection_method: 'craft' | 'claude' | 'hybrid';
  raw_craft_boxes: CraftBox[];
  merged_with_claude: boolean;
  confidence_score: number;
  processing_time_ms: number;
  created_at?: string;
}

export interface CraftBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  text?: string;
}

export interface DetectionComparison {
  id?: string;
  slide_id: string;
  claude_count: number;
  craft_count: number;
  merged_count: number;
  overlap_count: number;
  claude_only_count: number;
  craft_only_count: number;
  merge_duration_ms: number;
  created_at?: string;
}
