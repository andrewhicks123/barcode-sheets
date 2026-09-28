export const PAGE_SIZES = {
  letter: { w: 8.5, h: 11, label: 'Letter (8.5 × 11 in)' },
  a4: { w: 8.27, h: 11.69, label: 'A4 (210 × 297 mm)' },
  legal: { w: 8.5, h: 14, label: 'Legal (8.5 × 14 in)' },
}

export const DEFAULT_SETTINGS = {
  pageSize: 'letter',
  orientation: 'portrait',
  cols: 5,
  rows: 6,
  margin: 0.5,
  codeType: 'qr',       // 'qr' | 'code128'
  qrSize: 0.5,          // inches, square
  ecLevel: 'M',
  c128Width: 1.25,      // inches
  c128Height: 0.5,      // inches
  showLabel: true,
  showValue: true,
  labelFont: 10,        // pt
  valueFont: 7.5,       // pt
  cutGuides: true,
}

/** Page dimensions in inches after orientation. */
export function pageDims(settings) {
  const p = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.letter
  return settings.orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h }
}

/** Geometry for one cell, all in inches, origin top-left of the page. */
export function cellGeometry(settings, index) {
  const { w: W, h: H } = pageDims(settings)
  const cols = Math.max(1, settings.cols | 0)
  const rows = Math.max(1, settings.rows | 0)
  const m = settings.margin
  const cellW = (W - 2 * m) / cols
  const cellH = (H - 2 * m) / rows
  const perPage = cols * rows
  const idx = index % perPage
  const col = idx % cols
  const row = Math.floor(idx / cols)

  const x0 = m + col * cellW
  const y0 = m + row * cellH

  const codeW = settings.codeType === 'qr' ? settings.qrSize : settings.c128Width
  const codeH = settings.codeType === 'qr' ? settings.qrSize : settings.c128Height

  // Vertical stack: label, code, value — centred in the cell.
  const pt = 1 / 72
  const labelH = settings.showLabel ? settings.labelFont * pt * 1.2 : 0
  const valueH = settings.showValue ? settings.valueFont * pt * 1.2 : 0
  const gap = 0.05
  const stackH = labelH + (labelH ? gap : 0) + codeH + (valueH ? gap : 0) + valueH
  let cursor = y0 + (cellH - stackH) / 2

  const labelBaseline = settings.showLabel ? cursor + settings.labelFont * pt : null
  if (settings.showLabel) cursor += labelH + gap
  const codeX = x0 + (cellW - codeW) / 2
  const codeY = cursor
  cursor += codeH + (settings.showValue ? gap : 0)
  const valueBaseline = settings.showValue ? cursor + settings.valueFont * pt : null

  return {
    page: Math.floor(index / perPage),
    perPage,
    x0, y0, cellW, cellH,
    cx: x0 + cellW / 2,
    codeX, codeY, codeW, codeH,
    labelBaseline, valueBaseline,
    overflowX: codeW > cellW - 0.1,
    overflowY: stackH > cellH,
  }
}
