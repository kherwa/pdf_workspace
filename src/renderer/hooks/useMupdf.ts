import { useMemo } from 'react'
import { wrap } from 'comlink'
import type { MuPdfWorkerApi } from '../workers/mupdf.worker'

let workerInstance: Worker | null = null
let bridgeInstance: ReturnType<typeof wrap<MuPdfWorkerApi>> | null = null

// Singleton — one worker for the lifetime of the app
function getWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/mupdf.worker.ts', import.meta.url),
      { type: 'module' }
    )
    bridgeInstance = wrap<MuPdfWorkerApi>(workerInstance)
  }
  return bridgeInstance!
}

export function useMupdf() {
  return useMemo(() => getWorker(), [])
}
