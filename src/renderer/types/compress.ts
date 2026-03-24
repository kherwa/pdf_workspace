export interface CompressionSettings {
  mode: 'simple' | 'advanced'
  imageQuality: number    // 0–100, default 85
  imageDPI: number        // max DPI, default 150
  subsetFonts: boolean    // default true
  compressStreams: boolean // default true
  garbageCollect: boolean  // default true
}

export const defaultCompressionSettings: CompressionSettings = {
  mode: 'simple',
  imageQuality: 85,
  imageDPI: 150,
  subsetFonts: true,
  compressStreams: true,
  garbageCollect: true,
}
