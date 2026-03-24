export type ToolName = 'highlight' | 'text' | 'freehand' | 'rect' | 'ellipse'

export interface BaseAnnotation {
  id: string
  page: number
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight'
  x: number; y: number; width: number; height: number
  color: string   // hex
  opacity: number
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number; y: number
  text: string
  fontSize: number
  color: string
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand'
  points: number[]  // flat [x1,y1,x2,y2,...] in canvas px
  color: string
  lineWidth: number
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect'
  x: number; y: number; width: number; height: number
  color: string
  lineWidth: number
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse'
  x: number; y: number   // center
  radiusX: number; radiusY: number
  color: string
  lineWidth: number
}

export interface OcrEditAnnotation extends BaseAnnotation {
  type: 'ocrEdit'
  x: number; y: number; width: number; height: number
  newText: string
  originalText: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
}

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction'
  x: number; y: number; width: number; height: number
}

export type Annotation =
  | HighlightAnnotation
  | TextAnnotation
  | FreehandAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | OcrEditAnnotation

export type RedactionRect = RedactionAnnotation
