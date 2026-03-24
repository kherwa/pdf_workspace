export interface TextLine {
  text: string
  bbox: { left: number; top: number; right: number; bottom: number }
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  fontName: string
  source: 'textContent' | 'ocr'
}

export interface SearchMatch {
  page: number
  text: string
  bbox: { x: number; y: number; width: number; height: number }
  index: number
}

export interface PageInfo {
  width: number
  height: number
  rotation: number
}
