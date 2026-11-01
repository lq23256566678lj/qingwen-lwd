/** 图片在写入 .lwd 之前统一压缩为 data URL，使文档保持自包含、可随处携带。 */

export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024
export const MAX_EMBEDDED_IMAGE_CHARS = 24 * 1024 * 1024
const MAX_DIMENSION = 1600
const RECOMPRESS_THRESHOLD = 3.2 * 1024 * 1024

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取图片失败'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法解析图片'))
    image.src = src
  })
}

function mimeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)/i.exec(dataUrl)
  return match?.[1]?.toLowerCase() ?? 'image/png'
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  return Math.ceil((dataUrl.length - comma - 1) * 0.75)
}

/**
 * 限制最长边 1600px，并对过大的位图重新编码，避免一张截图把 .lwd 撑到几十 MB。
 * GIF 保持原样，避免把动画压成静帧。
 */
export async function optimizeImageDataUrl(
  dataUrl: string,
  mimeHint?: string,
): Promise<string> {
  const mime = (mimeHint ?? mimeFromDataUrl(dataUrl)).toLowerCase()
  if (mime === 'image/gif') return dataUrl
  if (dataUrl.length > MAX_EMBEDDED_IMAGE_CHARS) {
    throw new Error('图片过大，压缩后仍超过 24 MB，请先使用图片工具压缩')
  }

  let image: HTMLImageElement
  try {
    image = await loadImageElement(dataUrl)
  } catch {
    return dataUrl
  }

  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) return dataUrl

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const shouldResize = scale < 0.999
  const shouldRecompress =
    !shouldResize &&
    dataUrl.length > RECOMPRESS_THRESHOLD &&
    mime !== 'image/png'

  if (!shouldResize && !shouldRecompress) return dataUrl

  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  let outputType = 'image/png'
  if (mime === 'image/jpeg') outputType = 'image/jpeg'
  else if (mime === 'image/webp') outputType = 'image/webp'

  let output: string
  try {
    output = canvas.toDataURL(outputType, 0.86)
  } catch {
    return dataUrl
  }

  if (!shouldResize && output.length >= dataUrl.length) return dataUrl
  if (output.length > MAX_EMBEDDED_IMAGE_CHARS) {
    throw new Error('图片压缩后仍然过大，请换一张更小的图片')
  }
  return output
}

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('剪贴板中的内容不是图片')
  }
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('仅支持 PNG、JPEG、WebP、GIF 图片')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('图片超过 12 MB，请压缩后再插入')
  }
  const raw = await readBlobAsDataUrl(file)
  return optimizeImageDataUrl(raw, file.type)
}

export function isSupportedImageMime(mime: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mime)
}

export function imagePayloadSize(dataUrl: string): number {
  return estimateDataUrlBytes(dataUrl)
}
