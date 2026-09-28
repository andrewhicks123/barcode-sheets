import { jsPDF } from 'jspdf'
import { cellGeometry, pageDims } from './layout.js'
import { qrDataUrl, code128DataUrl } from './barcodes.js'

/**
 * Build the PDF. `items` is [{label, value}], `settings` from layout.js.
 * Returns a jsPDF instance.
 */
export async function buildPdf(items, settings, onProgress) {
  const { w, h } = pageDims(settings)
  const doc = new jsPDF({ unit: 'in', format: [w, h], orientation: settings.orientation })
  doc.setProperties({ title: 'Barcode Sheet' })

  for (let i = 0; i < items.length; i++) {
    const g = cellGeometry(settings, i)
    if (i > 0 && i % g.perPage === 0) doc.addPage([w, h], settings.orientation)

    const { label, value } = items[i]
    const img = settings.codeType === 'qr'
      ? await qrDataUrl(value, settings.ecLevel)
      : code128DataUrl(value)

    if (img) {
      doc.addImage(img, 'PNG', g.codeX, g.codeY, g.codeW, g.codeH)
    } else {
      doc.setDrawColor(200, 0, 0)
      doc.rect(g.codeX, g.codeY, g.codeW, g.codeH)
    }

    if (settings.showLabel && label) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(settings.labelFont)
      doc.setTextColor(0)
      doc.text(String(label), g.cx, g.labelBaseline, { align: 'center' })
    }
    if (settings.showValue && value) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(settings.valueFont)
      doc.setTextColor(0)
      doc.text(String(value), g.cx, g.valueBaseline, { align: 'center' })
    }

    if (settings.cutGuides) {
      doc.setDrawColor(215)
      doc.setLineWidth(0.005)
      doc.setLineDashPattern([0.03, 0.04], 0)
      doc.rect(g.x0, g.y0, g.cellW, g.cellH)
      doc.setLineDashPattern([], 0)
    }

    if (onProgress && i % 10 === 0) onProgress(i + 1, items.length)
  }
  return doc
}
