import { expose } from 'comlink'
import type { Annotation, RedactionRect } from '../types/annotations'
import type { CompressionSettings } from '../types/compress'
import type { TextLine, SearchMatch, PageInfo } from '../types/pdf'
import { hexToColor, quadsToBbox } from './pdfHelpers'

/* ══════════════════════════════════════════════════════════════════════
   MuPDF Initialization & Document Store
   ══════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mupdf: any = null

async function ensureMupdf() {
  if (!mupdf) mupdf = await import('mupdf')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docs = new Map<string, any>()

/* ══════════════════════════════════════════════════════════════════════
   Core Wrappers — eliminate repeated ensureMupdf / getDoc boilerplate
   ══════════════════════════════════════════════════════════════════════ */

/** Ensure mupdf is loaded, resolve the document for tabId, then run fn. */
async function withDoc<T>(tabId: string, fn: (doc: any) => T | Promise<T>): Promise<T> {
  await ensureMupdf()
  const doc = docs.get(tabId)
  if (!doc) throw new Error(`No document open for tab ${tabId}`)
  return fn(doc)
}

/** Ensure mupdf is loaded, then run fn (no document needed). */
async function withMupdf<T>(fn: () => T | Promise<T>): Promise<T> {
  await ensureMupdf()
  return fn()
}

/** Load a page (0-indexed), run callback, always destroy the page afterward. */
function withPage<T>(doc: any, pageIdx: number, fn: (page: any) => T): T {
  const page = doc.loadPage(pageIdx)
  try {
    return fn(page)
  } finally {
    page.destroy()
  }
}

/** Iterate all pages; each is loaded/destroyed one at a time. Returns collected results. */
function forEachPage<T>(doc: any, fn: (page: any, index: number) => T): T[] {
  const n = doc.countPages()
  const results: T[] = []
  for (let i = 0; i < n; i++) {
    results.push(withPage(doc, i, page => fn(page, i)))
  }
  return results
}

/* ══════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════ */

const META_INFO_KEYS = [
  'info:Title', 'info:Author', 'info:Subject', 'info:Keywords',
  'info:Creator', 'info:Producer', 'info:CreationDate', 'info:ModDate',
] as const

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml',
  txt: 'text/plain', html: 'text/html', htm: 'text/html',
  xps: 'application/xps', epub: 'application/epub+zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/* ══════════════════════════════════════════════════════════════════════
   PDF Helpers
   ══════════════════════════════════════════════════════════════════════ */


function openPdf(buffer: ArrayBuffer) {
  return mupdf.PDFDocument.openDocument(buffer, 'application/pdf')
}

/** Snapshot a live doc into a disposable copy (avoids mutating the open document). */
function snapshotDoc(doc: any) {
  const snapBuf = doc.saveToBuffer('compress')
  const bytes = new Uint8Array(snapBuf.asUint8Array())
  snapBuf.destroy()
  return openPdf(bytes.buffer)
}

/** Save doc to Uint8Array, destroying the MuPDF buffer (and optionally the doc). */
function saveAndDestroy(doc: any, opts = 'compress', destroyDoc = true): Uint8Array {
  const buf = doc.saveToBuffer(opts)
  const bytes = new Uint8Array(buf.asUint8Array())
  buf.destroy()
  if (destroyDoc) doc.destroy()
  return bytes
}

/** Convert a MuPDF pixmap to an ImageBitmap, destroying the pixmap. */
function pixmapToImageBitmap(pixmap: any): Promise<ImageBitmap> {
  const w = pixmap.getWidth()
  const h = pixmap.getHeight()
  const pixels = pixmap.getPixels() as Uint8ClampedArray
  const imageData = new ImageData(new Uint8ClampedArray(pixels), w, h)
  pixmap.destroy()
  return createImageBitmap(imageData)
}

/** Render a loaded page to ImageBitmap at the given scale and optional rotation (degrees). */
function renderPagePixmap(page: any, scale: number, rotation: number = 0): Promise<ImageBitmap> {
  if (!rotation) {
    // Fast path: no rotation
    const matrix = mupdf.Matrix.scale(scale, scale)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, true)
    return pixmapToImageBitmap(pixmap)
  }

  // With rotation: scale first, then rotate, then shift to positive coords
  const scaleM = mupdf.Matrix.scale(scale, scale)
  const rotM = mupdf.Matrix.rotate(rotation)
  let matrix = mupdf.Matrix.concat(scaleM, rotM)

  // Find where the page bounds end up after the transform and shift to (0,0)
  const bounds = page.getBounds() as [number, number, number, number]
  const tb = mupdf.Rect.transform(bounds, matrix)
  const shiftM = mupdf.Matrix.translate(-tb[0], -tb[1])
  matrix = mupdf.Matrix.concat(matrix, shiftM)

  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, true)
  return pixmapToImageBitmap(pixmap)
}

/** Extract plain text from a loaded page via structured text. */
function extractPlainText(page: any): string {
  const st = page.toStructuredText()
  const text = st.asText() as string
  st.destroy()
  return text
}


/** Graft pages from srcDoc into targetDoc by 0-based page indices. */
function graftPagesInto(targetDoc: any, srcDoc: any, pageIndices: number[]) {
  for (const idx of pageIndices) {
    targetDoc.graftPage(targetDoc.countPages(), srcDoc, idx)
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Domain Helpers — Annotations, Images
   ══════════════════════════════════════════════════════════════════════ */

/** Delete all annotations on a loaded page (reverse order for stable indices). */
function deleteAnnotationsOnPage(page: any): number {
  const annots = page.getAnnotations() as any[]
  for (let i = annots.length - 1; i >= 0; i--) {
    page.deleteAnnotation(annots[i])
  }
  return annots.length
}

/** Extract images from a single page's XObject resources. */
function extractImagesFromPage(
  doc: any,
  pageIdx: number,
): Array<{ width: number; height: number; png: Uint8Array }> {
  const pageObj = doc.findPage(pageIdx)
  const resources = pageObj.get('Resources')
  if (!resources) return []
  const xobjects = resources.get('XObject')
  if (!xobjects) return []

  const images: Array<{ width: number; height: number; png: Uint8Array }> = []
  xobjects.forEach((val: any) => {
    try {
      const obj = val.resolve()
      const subtype = obj.get('Subtype')
      if (subtype && subtype.asName() === 'Image') {
        const image = doc.loadImage(obj)
        const pixmap = image.toPixmap()
        const pngBuf = pixmap.asPNG()
        images.push({
          width: image.getWidth(),
          height: image.getHeight(),
          png: new Uint8Array(pngBuf.buffer ?? pngBuf),
        })
        pixmap.destroy()
      }
    } catch {
      console.warn(`Failed to extract image on page ${pageIdx}`)
    }
  })
  return images
}

/** Embed a single annotation onto a loaded page at inverse scale s. */
function embedSingleAnnotation(page: any, ann: Annotation, s: number) {
  switch (ann.type) {
    case 'highlight': {
      const a = page.createAnnotation('Highlight')
      const x = ann.x / s, y = ann.y / s, w = ann.width / s, h = ann.height / s
      const quad: [number, number, number, number, number, number, number, number] =
        [x, y, x + w, y, x, y + h, x + w, y + h]
      a.setQuadPoints([quad])
      a.setColor(hexToColor(ann.color))
      a.setOpacity(ann.opacity ?? 0.4)
      a.update()
      break
    }
    case 'text': {
      const a = page.createAnnotation('FreeText')
      const x = ann.x / s, y = ann.y / s, fs = ann.fontSize / s
      a.setRect([x, y, x + 200, y + fs + 4])
      a.setContents(ann.text)
      a.setDefaultAppearance('Helv', fs, hexToColor(ann.color))
      a.update()
      break
    }
    case 'freehand': {
      const a = page.createAnnotation('Ink')
      const stroke: [number, number][] = []
      for (let i = 0; i < ann.points.length; i += 2) {
        stroke.push([ann.points[i] / s, ann.points[i + 1] / s])
      }
      a.setInkList([stroke])
      a.setColor(hexToColor(ann.color))
      a.setBorderWidth(ann.lineWidth / s)
      a.update()
      break
    }
    case 'rect': {
      const a = page.createAnnotation('Square')
      const x = ann.x / s, y = ann.y / s, w = ann.width / s, h = ann.height / s
      a.setRect([x, y, x + w, y + h])
      a.setColor(hexToColor(ann.color))
      a.setBorderWidth(ann.lineWidth / s)
      a.update()
      break
    }
    case 'ellipse': {
      const a = page.createAnnotation('Circle')
      const cx = ann.x / s, cy = ann.y / s, rx = ann.radiusX / s, ry = ann.radiusY / s
      a.setRect([cx - rx, cy - ry, cx + rx, cy + ry])
      a.setColor(hexToColor(ann.color))
      a.setBorderWidth(ann.lineWidth / s)
      a.update()
      break
    }
    case 'ocrEdit': {
      const x = ann.x / s, y = ann.y / s, w = ann.width / s, h = ann.height / s
      const redact = page.createAnnotation('Redact')
      redact.setRect([x, y, x + w, y + h])
      redact.applyRedaction(true)
      const ft = page.createAnnotation('FreeText')
      ft.setRect([x, y, x + w, y + h])
      ft.setContents(ann.newText)
      ft.setDefaultAppearance('Helv', ann.fontSize / s, [0, 0, 0])
      ft.update()
      break
    }
  }
}

/**
 * Embed React state annotations into a MuPDF document.
 * pageMapping: optional map from annotation page number → actual page index in the doc
 *   (used by saveOrganised where page order differs from original).
 */
function embedAnnotations(
  doc: any,
  annotations: Record<number, Annotation[]>,
  scale: number = 1,
  pageMapping?: Record<number, number>,
) {
  const s = scale || 1

  for (const [pageStr, anns] of Object.entries(annotations)) {
    const origPage = parseInt(pageStr, 10)
    const pageIdx = pageMapping ? pageMapping[origPage] : origPage - 1
    if (pageIdx === undefined || pageIdx < 0) continue

    try {
      withPage(doc, pageIdx, page => {
        for (const ann of anns) {
          try {
            embedSingleAnnotation(page, ann, s)
          } catch (e) {
            console.warn('Failed to embed annotation:', ann.type, e)
          }
        }
      })
    } catch {
      // Page doesn't exist in document — skip silently
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Worker API
   ══════════════════════════════════════════════════════════════════════ */

const api = {
  // ── Document lifecycle ──────────────────────────────────────────────

  async openDocument(tabId: string, buffer: ArrayBuffer): Promise<{ numPages: number }> {
    return withMupdf(() => {
      const doc = openPdf(buffer)
      docs.set(tabId, doc)
      return { numPages: doc.countPages() }
    })
  },

  closeDocument(tabId: string): void {
    const doc = docs.get(tabId)
    if (doc) {
      try { doc.destroy() } catch { /* already destroyed */ }
      docs.delete(tabId)
    }
  },

  // ── Rendering ─────────────────────────────────────────────────────

  renderPage: (tabId: string, pageNum: number, scale: number, rotation: number = 0): Promise<ImageBitmap> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => renderPagePixmap(page, scale, rotation)),
    ),

  getThumbnail: (tabId: string, pageNum: number, dpr = 1): Promise<ImageBitmap> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => {
        const bounds = page.getBounds() as [number, number, number, number]
        const scale = (150 / (bounds[2] - bounds[0])) * dpr
        return renderPagePixmap(page, scale)
      }),
    ),

  getPageInfo: (tabId: string, pageNum: number): Promise<PageInfo> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => {
        // getBounds() already accounts for inherent /Rotate — returns oriented dimensions
        const [x0, y0, x1, y1] = page.getBounds() as [number, number, number, number]
        return { width: x1 - x0, height: y1 - y0, rotation: 0 }
      }),
    ),

  // ── Text extraction ───────────────────────────────────────────────

  getTextLines: (tabId: string, pageNum: number): Promise<TextLine[]> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => {
        const structText = page.toStructuredText('preserve-whitespace,preserve-spans')
        const jsonStr = structText.asJSON() as string
        structText.destroy()

        type SpanJSON = {
          bbox: [number, number, number, number]
          text: string
          font?: { name?: string; size?: number; bold?: boolean; italic?: boolean }
          size?: number
        }
        type LineJSON = { bbox: [number, number, number, number]; spans?: SpanJSON[] }
        type BlockJSON = { lines?: LineJSON[] }
        const parsed = JSON.parse(jsonStr) as { blocks?: BlockJSON[] }

        const lines: TextLine[] = []
        for (const block of parsed.blocks ?? []) {
          for (const line of block.lines ?? []) {
            const spans = line.spans ?? []
            if (!spans.length) continue
            const text = spans.map(s => s.text ?? '').join('').trim()
            if (!text) continue
            const firstSpan = spans[0]
            const font = firstSpan.font ?? {}
            const fontSize = font.size ?? firstSpan.size ?? 12
            const bbox = line.bbox
            const fontName = font.name ?? ''
            const fontFamily = /mono|courier|code/.test(fontName.toLowerCase())
              ? '"Courier New", monospace'
              : /times|roman|georgia/.test(fontName.toLowerCase())
              ? '"Times New Roman", serif'
              : '"Arial", sans-serif'
            lines.push({
              text,
              bbox: { left: bbox[0], top: bbox[1], right: bbox[2], bottom: bbox[3] },
              fontSize,
              fontFamily,
              fontWeight: font.bold ? 'bold' : 'normal',
              fontStyle: font.italic ? 'italic' : 'normal',
              fontName,
              source: 'textContent',
            })
          }
        }
        return lines
      }),
    ),

  getPlainText: (tabId: string, pageNum: number): Promise<string> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => extractPlainText(page)),
    ),

  getAllText: (tabId: string): Promise<string> =>
    withDoc(tabId, doc =>
      forEachPage(doc, page => extractPlainText(page)).join('\n\n'),
    ),

  // ── Text search ───────────────────────────────────────────────────

  searchText: (tabId: string, query: string): Promise<SearchMatch[]> =>
    withDoc(tabId, doc => {
      const matches: SearchMatch[] = []
      forEachPage(doc, (page, i) => {
        const hits = page.search(query, 500) as number[][][]
        for (const hitQuads of hits) {
          matches.push({
            page: i + 1,
            text: query,
            bbox: quadsToBbox(hitQuads),
            index: matches.length,
          })
        }
      })
      return matches
    }),

  // ── Convert to PDF ────────────────────────────────────────────────

  convertToPdf: (buffer: ArrayBuffer, fileName: string): Promise<Uint8Array> =>
    withMupdf(() => {
      // Pass the full filename as magic — MuPDF detects type from extension.
      // Fall back to MIME map only for extensions that need it.
      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
      const magic = MIME_MAP[ext] || fileName
      const srcDoc = mupdf.Document.openDocument(buffer, magic)

      const outBuf = new mupdf.Buffer()
      const writer = new mupdf.DocumentWriter(outBuf, 'pdf', '')

      forEachPage(srcDoc, page => {
        const bounds = page.getBounds()
        const device = writer.beginPage(bounds)
        page.run(device, mupdf.Matrix.identity)
        writer.endPage()
      })
      writer.close()
      srcDoc.destroy()

      const bytes = new Uint8Array(outBuf.asUint8Array())
      outBuf.destroy()
      return bytes
    }),

  // ── Save with annotations ─────────────────────────────────────────

  saveWithAnnotations: (
    tabId: string,
    annotations: Record<number, Annotation[]>,
    scale: number = 1,
  ): Promise<Uint8Array> =>
    withDoc(tabId, doc => {
      const tmpDoc = snapshotDoc(doc)
      embedAnnotations(tmpDoc, annotations, scale)
      return saveAndDestroy(tmpDoc)
    }),

  // ── Page manipulation ─────────────────────────────────────────────

  reorderPages: (tabId: string, newOrder: number[]): Promise<void> =>
    withDoc(tabId, doc => {
      doc.rearrangePages(newOrder.map((p: number) => p - 1))
    }),

  rotatePage: (tabId: string, pageNum: number, rotation: number): Promise<void> =>
    withDoc(tabId, doc => {
      try {
        const pageObj = doc.findPage(pageNum - 1)
        pageObj.put('Rotate', doc.newInteger(rotation))
      } catch (e) {
        console.warn('rotatePage error:', e)
      }
    }),

  saveOrganised: (
    tabId: string,
    pageOrder: number[],
    rotations: Record<number, number>,
    annotations: Record<number, Annotation[]> = {},
    scale: number = 1,
  ): Promise<Uint8Array> =>
    withDoc(tabId, srcDoc => {
      const bakedDoc = snapshotDoc(srcDoc)
      bakedDoc.bake(true, true)

      const newDoc = new mupdf.PDFDocument()
      for (let i = 0; i < pageOrder.length; i++) {
        newDoc.graftPage(i, bakedDoc, pageOrder[i] - 1)
      }
      bakedDoc.destroy()

      // Apply rotations
      for (let i = 0; i < pageOrder.length; i++) {
        const rot = rotations[pageOrder[i]] ?? 0
        if (rot !== 0) {
          const pageObj = newDoc.findPage(i)
          const existing = pageObj.getInheritable('Rotate')
          const base = existing ? existing.asNumber() : 0
          pageObj.put('Rotate', newDoc.newInteger((base + rot) % 360))
        }
      }

      // Embed annotations with page mapping (original page → new index)
      const pageMapping: Record<number, number> = {}
      for (let i = 0; i < pageOrder.length; i++) {
        pageMapping[pageOrder[i]] = i
      }
      embedAnnotations(newDoc, annotations, scale, pageMapping)

      return saveAndDestroy(newDoc)
    }),

  insertBlankPage: (
    tabId: string,
    atIndex: number,
    width: number = 595,
    height: number = 842,
  ): Promise<void> =>
    withDoc(tabId, doc => {
      const page = doc.addPage([0, 0, width, height], 0, null, 'q Q')
      doc.insertPage(atIndex, page)
    }),

  insertPages: (
    tabId: string,
    buffer: ArrayBuffer,
    atIndex: number,
  ): Promise<{ insertedCount: number }> =>
    withDoc(tabId, doc => {
      const srcDoc = openPdf(buffer)
      const srcCount = srcDoc.countPages()
      for (let i = 0; i < srcCount; i++) {
        doc.graftPage(atIndex + i, srcDoc, i)
      }
      srcDoc.destroy()
      return { insertedCount: srcCount }
    }),

  deletePages: (tabId: string, pages: number[]): Promise<void> =>
    withDoc(tabId, doc => {
      const sorted = [...pages].sort((a, b) => b - a)
      for (const p of sorted) {
        doc.deletePage(p - 1)
      }
    }),

  extractPages: (tabId: string, pages: number[]): Promise<Uint8Array> =>
    withDoc(tabId, srcDoc => {
      const newDoc = new mupdf.PDFDocument()
      graftPagesInto(newDoc, srcDoc, pages.map(p => p - 1))
      return saveAndDestroy(newDoc)
    }),

  async mergeDocuments(
    sources: Array<{ tabId: string; pages: number[] }>,
  ): Promise<Uint8Array> {
    await ensureMupdf()
    const newDoc = new mupdf.PDFDocument()
    for (const src of sources) {
      const srcDoc = docs.get(src.tabId)
      if (!srcDoc) throw new Error(`No document open for tab ${src.tabId}`)
      graftPagesInto(newDoc, srcDoc, src.pages.map(p => p - 1))
    }
    return saveAndDestroy(newDoc)
  },

  // ── Compression ───────────────────────────────────────────────────

  compressDocument: (tabId: string, settings: CompressionSettings): Promise<Uint8Array> =>
    withDoc(tabId, doc => {
      const tmpDoc = snapshotDoc(doc)

      if (settings.subsetFonts) {
        tmpDoc.subsetFonts()
      }

      const opts = [
        'compress',
        settings.compressStreams ? 'compress-images' : '',
        settings.garbageCollect ? 'garbage=3' : '',
      ].filter(Boolean).join(',')

      return saveAndDestroy(tmpDoc, opts)
    }),

  // ── Redaction ─────────────────────────────────────────────────────

  applyRedactions: (
    tabId: string,
    redactions: Record<number, RedactionRect[]>,
    scale: number = 1,
  ): Promise<Uint8Array> =>
    withDoc(tabId, doc => {
      const s = scale || 1
      for (const [pageStr, rects] of Object.entries(redactions)) {
        const pageIdx = parseInt(pageStr, 10) - 1
        withPage(doc, pageIdx, page => {
          for (const r of rects) {
            const ann = page.createAnnotation('Redact')
            ann.setRect([r.x / s, r.y / s, (r.x + r.width) / s, (r.y + r.height) / s])
            ann.update()
          }
          page.applyRedactions(true, 2, 1, 0)
        })
      }
      return saveAndDestroy(doc, 'compress', false)
    }),

  // ── Metadata ──────────────────────────────────────────────────────

  getMetadata: (tabId: string): Promise<Record<string, string>> =>
    withDoc(tabId, doc => {
      const meta: Record<string, string> = {}
      for (const key of ['format', 'encryption', ...META_INFO_KEYS]) {
        const val = doc.getMetaData(key)
        if (val) meta[key] = val
      }
      meta['pageCount'] = String(doc.countPages())
      return meta
    }),

  setMetadata: (tabId: string, entries: Record<string, string>): Promise<void> =>
    withDoc(tabId, doc => {
      for (const [key, value] of Object.entries(entries)) {
        doc.setMetaData(key, value)
      }
    }),

  // ── Split document ────────────────────────────────────────────────

  splitDocument: (
    tabId: string,
    ranges: Array<{ start: number; end: number }>,
  ): Promise<Uint8Array[]> =>
    withDoc(tabId, srcDoc => {
      return ranges.map(({ start, end }) => {
        const newDoc = new mupdf.PDFDocument()
        const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)
        graftPagesInto(newDoc, srcDoc, indices)
        return saveAndDestroy(newDoc)
      })
    }),

  splitAllPages: (tabId: string): Promise<Uint8Array[]> =>
    withDoc(tabId, srcDoc => {
      const numPages = srcDoc.countPages()
      return Array.from({ length: numPages }, (_, i) => {
        const newDoc = new mupdf.PDFDocument()
        graftPagesInto(newDoc, srcDoc, [i])
        return saveAndDestroy(newDoc)
      })
    }),

  // ── Extract images ────────────────────────────────────────────────

  extractImages: (
    tabId: string,
    pageNum: number,
  ): Promise<Array<{ width: number; height: number; png: Uint8Array }>> =>
    withDoc(tabId, doc => extractImagesFromPage(doc, pageNum - 1)),

  extractAllImages: (
    tabId: string,
  ): Promise<Array<{ page: number; width: number; height: number; png: Uint8Array }>> =>
    withDoc(tabId, doc => {
      const numPages = doc.countPages()
      const images: Array<{ page: number; width: number; height: number; png: Uint8Array }> = []
      for (let i = 0; i < numPages; i++) {
        for (const img of extractImagesFromPage(doc, i)) {
          images.push({ page: i + 1, ...img })
        }
      }
      return images
    }),

  // ── Scrub / sanitize ──────────────────────────────────────────────

  scrubDocument: (
    tabId: string,
    options: {
      metadata?: boolean
      annotations?: boolean
      embeddedFiles?: boolean
      javascript?: boolean
    },
  ): Promise<Uint8Array> =>
    withDoc(tabId, doc => {
      const tmpDoc = snapshotDoc(doc)

      if (options.metadata !== false) {
        for (const key of META_INFO_KEYS) {
          try { tmpDoc.setMetaData(key, '') } catch { /* skip */ }
        }
      }

      if (options.annotations !== false) {
        tmpDoc.bake(true, true)
      }

      if (options.embeddedFiles !== false) {
        try {
          const files = tmpDoc.getEmbeddedFiles()
          for (const name of Object.keys(files)) {
            tmpDoc.deleteEmbeddedFile(name)
          }
        } catch { /* skip */ }
      }

      if (options.javascript !== false) {
        try { tmpDoc.disableJS() } catch { /* skip */ }
      }

      return saveAndDestroy(tmpDoc, 'compress,garbage=3')
    }),

  // ── Flatten annotations ───────────────────────────────────────────

  flattenAnnotations: (tabId: string): Promise<Uint8Array> =>
    withDoc(tabId, doc => {
      const tmpDoc = snapshotDoc(doc)
      tmpDoc.bake(true, false)
      return saveAndDestroy(tmpDoc)
    }),

  // ── Document outline (table of contents) ──────────────────────────

  getOutline: (tabId: string): Promise<Array<{ title: string; page: number; level: number }>> =>
    withDoc(tabId, doc => {
      type OutlineItem = { title: string; page?: number; down?: OutlineItem[] }
      const outline = doc.loadOutline() as OutlineItem[] | null
      if (!outline) return []

      const flat: Array<{ title: string; page: number; level: number }> = []
      function walk(items: OutlineItem[], level: number) {
        for (const item of items) {
          flat.push({ title: item.title, page: (item.page ?? 0) + 1, level })
          if (item.down) walk(item.down, level + 1)
        }
      }
      walk(outline, 0)
      return flat
    }),

  // ── Page annotations list ─────────────────────────────────────────

  getAnnotationsList: (tabId: string, pageNum: number): Promise<Array<{
    index: number
    type: string
    rect: [number, number, number, number]
    contents: string
    author: string
  }>> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => {
        const annots = page.getAnnotations() as any[]
        return annots.map((a: any, i: number) => ({
          index: i,
          type: a.getType?.() ?? 'Unknown',
          rect: a.getRect?.() ?? [0, 0, 0, 0],
          contents: a.getContents?.() ?? '',
          author: a.getAuthor?.() ?? '',
        }))
      }),
    ),

  deleteAnnotation: (tabId: string, pageNum: number, annotIndex: number): Promise<void> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => {
        const annots = page.getAnnotations() as any[]
        if (annotIndex >= 0 && annotIndex < annots.length) {
          page.deleteAnnotation(annots[annotIndex])
        }
      }),
    ),

  deleteAllAnnotations: (tabId: string, pageNum: number): Promise<number> =>
    withDoc(tabId, doc =>
      withPage(doc, pageNum - 1, page => deleteAnnotationsOnPage(page)),
    ),

  deleteAllDocumentAnnotations: (tabId: string): Promise<number> =>
    withDoc(tabId, doc =>
      forEachPage(doc, page => deleteAnnotationsOnPage(page))
        .reduce((sum, n) => sum + n, 0),
    ),

  // ── Document permissions ──────────────────────────────────────────

  getPermissions: (tabId: string): Promise<Record<string, boolean>> =>
    withDoc(tabId, doc => {
      const perms = ['print', 'edit', 'copy', 'annotate', 'form', 'accessibility', 'assemble', 'print-hq']
      const result: Record<string, boolean> = {}
      for (const p of perms) {
        result[p] = doc.hasPermission(p) as boolean
      }
      return result
    }),

  // ── Password check ────────────────────────────────────────────────

  needsPassword: (tabId: string): Promise<boolean> =>
    withDoc(tabId, doc => doc.needsPassword() as boolean),

  authenticatePassword: (tabId: string, password: string): Promise<number> =>
    withDoc(tabId, doc => doc.authenticatePassword(password) as number),
}

expose(api)

export type MuPdfWorkerApi = typeof api
