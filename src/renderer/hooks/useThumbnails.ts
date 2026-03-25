import { useState, useCallback, useRef, useEffect } from 'react'
import { useMupdf } from './useMupdf'

type CacheKey = `${string}:${number}`
type ThumbnailCache = Map<CacheKey, ImageBitmap>

export function useThumbnails() {
  const mupdf = useMupdf()
  const cache = useRef<ThumbnailCache>(new Map())
  const [, setRevision] = useState(0)

  // Close all cached bitmaps on unmount to free GPU resources
  useEffect(() => {
    const cacheRef = cache.current
    return () => {
      for (const bitmap of cacheRef.values()) {
        bitmap.close()
      }
      cacheRef.clear()
    }
  }, [])

  const getThumbnail = useCallback(
    async (tabId: string, pageNum: number): Promise<ImageBitmap | null> => {
      const key: CacheKey = `${tabId}:${pageNum}`
      if (cache.current.has(key)) return cache.current.get(key)!
      try {
        const bitmap = await mupdf.getThumbnail(tabId, pageNum, window.devicePixelRatio || 1)
        cache.current.set(key, bitmap)
        setRevision(r => r + 1)
        return bitmap
      } catch {
        return null
      }
    },
    [mupdf]
  )

  const invalidate = useCallback((tabId: string) => {
    for (const [key, bitmap] of cache.current.entries()) {
      if (key.startsWith(`${tabId}:`)) {
        bitmap.close()
        cache.current.delete(key)
      }
    }
    setRevision(r => r + 1)
  }, [])

  const getCached = useCallback(
    (tabId: string, pageNum: number): ImageBitmap | null => {
      return cache.current.get(`${tabId}:${pageNum}`) ?? null
    },
    []
  )

  return { getThumbnail, getCached, invalidate }
}
