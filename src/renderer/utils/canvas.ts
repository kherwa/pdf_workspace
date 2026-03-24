/** Render an ImageBitmap onto a canvas with a white background.
 *  The bitmap is assumed to already include the DPR scaling factor,
 *  so CSS dimensions are set to bitmap size / DPR for crisp HiDPI rendering. */
export function renderBitmapToCanvas(canvas: HTMLCanvasElement, bitmap: ImageBitmap) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.style.width = `${bitmap.width / dpr}px`
  canvas.style.height = `${bitmap.height / dpr}px`
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0)
}
