import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

const cache = new Map()

/** Render a QR code to a PNG data URL (square, high-res for print). */
export async function qrDataUrl(value, ecLevel = 'M') {
  const key = `qr|${ecLevel}|${value}`
  if (cache.has(key)) return cache.get(key)
  const url = await QRCode.toDataURL(String(value), {
    errorCorrectionLevel: ecLevel,
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#ffffff' },
  })
  cache.set(key, url)
  return url
}

/** Render a Code 128 barcode to a PNG data URL. Returns null if the value can't be encoded. */
export function code128DataUrl(value) {
  const key = `c128|${value}`
  if (cache.has(key)) return cache.get(key)
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, String(value), {
      format: 'CODE128',
      displayValue: false,
      margin: 8,
      width: 4,       // px per module — high-res source, scaled down at print
      height: 160,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    cache.set(key, null)
    return null
  }
  const url = canvas.toDataURL('image/png')
  cache.set(key, url)
  return url
}

export function clearBarcodeCache() {
  cache.clear()
}
