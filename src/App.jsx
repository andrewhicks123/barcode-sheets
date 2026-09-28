import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { DEFAULT_SETTINGS, PAGE_SIZES, cellGeometry, pageDims } from './layout.js'
import { qrDataUrl, code128DataUrl } from './barcodes.js'
import { buildPdf } from './pdf.js'

const SAMPLE = `Asset Tag,Serial
SC01,AATC007466
SC02,AATC011809
SC03,AATC011538
SC04,AATC011418
SC05,AATC011722
SC06,AATC011533
RD01,RADIO1
RD02,RADIO2
RD03,RADIO3
RD04,RADIO4`

function parseTable(input, type) {
  const wb = XLSX.read(input, { type, raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  return rows.map(r => r.map(c => String(c ?? '').trim()))
}

export default function App() {
  const [raw, setRaw] = useState([])          // array of string arrays
  const [fileName, setFileName] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [labelCol, setLabelCol] = useState(0)
  const [valueCol, setValueCol] = useState(1)
  const [pasteText, setPasteText] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))
  const num = (k, min, max) => e => {
    const v = parseFloat(e.target.value)
    if (!Number.isNaN(v)) set(k, Math.min(max, Math.max(min, v)))
  }

  // ---- data loading ----
  const loadRows = (rows, name) => {
    setRaw(rows)
    setFileName(name)
    const width = Math.max(0, ...rows.map(r => r.length))
    setLabelCol(0)
    setValueCol(width > 1 ? 1 : 0)
    setPage(0)
  }

  const onFile = async file => {
    if (!file) return
    const buf = await file.arrayBuffer()
    try {
      loadRows(parseTable(buf, 'array'), file.name)
    } catch (e) {
      alert('Could not read that file: ' + e.message)
    }
  }

  const onPaste = text => {
    setPasteText(text)
    if (!text.trim()) return
    try {
      loadRows(parseTable(text, 'string'), 'pasted data')
    } catch { /* ignore mid-typing errors */ }
  }

  const header = hasHeader && raw.length ? raw[0] : null
  const body = hasHeader ? raw.slice(1) : raw
  const colCount = Math.max(0, ...raw.map(r => r.length))
  const colName = i => (header && header[i]) || `Column ${String.fromCharCode(65 + i)}`

  const items = useMemo(
    () => body
      .map(r => ({ label: r[labelCol] ?? '', value: r[valueCol] ?? '' }))
      .filter(it => it.value !== ''),
    [body, labelCol, valueCol],
  )

  // ---- preview ----
  const perPage = Math.max(1, settings.cols | 0) * Math.max(1, settings.rows | 0)
  const pageCount = Math.max(1, Math.ceil(items.length / perPage))
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1) }, [pageCount, page])

  const pageItems = items.slice(page * perPage, (page + 1) * perPage)
  const [imgs, setImgs] = useState({})
  useEffect(() => {
    let alive = true
    ;(async () => {
      const next = {}
      for (const it of pageItems) {
        next[it.value] = settings.codeType === 'qr'
          ? await qrDataUrl(it.value, settings.ecLevel)
          : code128DataUrl(it.value)
      }
      if (alive) setImgs(next)
    })()
    return () => { alive = false }
  }, [pageItems.map(i => i.value).join('\u0000'), settings.codeType, settings.ecLevel])

  const previewRef = useRef(null)
  const [previewW, setPreviewW] = useState(600)
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPreviewW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { w: PW, h: PH } = pageDims(settings)
  const scale = previewW / PW   // px per inch
  const px = v => `${v * scale}px`
  const ptPx = pt => `${(pt / 72) * scale}px`

  const anyOverflow = pageItems.some((_, i) => {
    const g = cellGeometry(settings, i)
    return g.overflowX || g.overflowY
  })
  const bad128 = settings.codeType === 'code128'
    ? pageItems.filter(it => imgs[it.value] === null).length : 0

  // ---- download ----
  const download = async () => {
    if (!items.length) return
    setBusy(true)
    try {
      const doc = await buildPdf(items, settings, (n, t) => setProgress(`${n} / ${t}`))
      const base = (fileName || 'barcodes').replace(/\.[^.]+$/, '')
      const name = `${base}-${settings.codeType}.pdf`
      // Inside a Claude artifact, browser downloads are blocked; use the host's save dialog instead.
      const dl = window.claude?.use ? await window.claude.use('downloads') : null
      if (dl) {
        try { await dl.save({ filename: name, data: doc.output('blob') }) }
        catch (e) { if (e?.code !== 'declined') alert('Could not save: ' + (e?.message || e)) }
      } else {
        doc.save(name)
      }
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const isQR = settings.codeType === 'qr'

  return (
    <div className="app">
      <header className="topbar">
        <h1>Barcode Sheet Builder</h1>
        <p>Upload a two-column list → pick QR or Code 128 → print-ready PDF. Everything runs in your browser; nothing is uploaded.</p>
      </header>

      <div className="main">
        <aside className="panel">
          {/* ---------- DATA ---------- */}
          <section>
            <h2>1. Data</h2>
            <div
              className={'drop' + (dragOver ? ' over' : '')}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById('file').click()}
            >
              <input id="file" type="file" hidden accept=".csv,.tsv,.txt,.xlsx,.xls"
                onChange={e => onFile(e.target.files[0])} />
              <strong>Drop a CSV / XLSX here</strong> or click to browse
              {fileName && <div className="file">Loaded: {fileName} ({body.length} rows)</div>}
            </div>
            <details>
              <summary>…or paste rows</summary>
              <textarea rows={6} placeholder={'Label,Value\nSC01,AATC007466'}
                value={pasteText} onChange={e => onPaste(e.target.value)} />
            </details>
            <button className="link" onClick={() => onPaste(SAMPLE)}>Load sample data</button>

            {raw.length > 0 && (
              <div className="grid2">
                <label className="check full">
                  <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />
                  First row is a header
                </label>
                <label>Label (printed above)
                  <select value={labelCol} onChange={e => setLabelCol(+e.target.value)}>
                    {Array.from({ length: colCount }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
                  </select>
                </label>
                <label>Value (encoded in code)
                  <select value={valueCol} onChange={e => setValueCol(+e.target.value)}>
                    {Array.from({ length: colCount }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
                  </select>
                </label>
              </div>
            )}
          </section>

          {/* ---------- CODE ---------- */}
          <section>
            <h2>2. Barcode</h2>
            <div className="seg">
              <button className={isQR ? 'on' : ''} onClick={() => set('codeType', 'qr')}>QR code</button>
              <button className={!isQR ? 'on' : ''} onClick={() => set('codeType', 'code128')}>Code 128</button>
            </div>
            {isQR ? (
              <div className="grid2">
                <label>Size (in)
                  <input type="number" step="0.05" min="0.25" max="6" value={settings.qrSize} onChange={num('qrSize', 0.25, 6)} />
                </label>
                <label>Error correction
                  <select value={settings.ecLevel} onChange={e => set('ecLevel', e.target.value)}>
                    <option value="L">L – 7%</option>
                    <option value="M">M – 15%</option>
                    <option value="Q">Q – 25%</option>
                    <option value="H">H – 30%</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid2">
                <label>Width (in)
                  <input type="number" step="0.05" min="0.5" max="8" value={settings.c128Width} onChange={num('c128Width', 0.5, 8)} />
                </label>
                <label>Height (in)
                  <input type="number" step="0.05" min="0.15" max="4" value={settings.c128Height} onChange={num('c128Height', 0.15, 4)} />
                </label>
              </div>
            )}
          </section>

          {/* ---------- LAYOUT ---------- */}
          <section>
            <h2>3. Sheet layout</h2>
            <div className="grid2">
              <label>Paper
                <select value={settings.pageSize} onChange={e => set('pageSize', e.target.value)}>
                  {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label>Orientation
                <select value={settings.orientation} onChange={e => set('orientation', e.target.value)}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label>Across (columns)
                <input type="number" min="1" max="12" value={settings.cols} onChange={num('cols', 1, 12)} />
              </label>
              <label>Down (rows)
                <input type="number" min="1" max="20" value={settings.rows} onChange={num('rows', 1, 20)} />
              </label>
              <label>Page margin (in)
                <input type="number" step="0.05" min="0" max="2" value={settings.margin} onChange={num('margin', 0, 2)} />
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.cutGuides} onChange={e => set('cutGuides', e.target.checked)} />
                Dashed cut guides
              </label>
            </div>
          </section>

          {/* ---------- TEXT ---------- */}
          <section>
            <h2>4. Labels</h2>
            <div className="grid2">
              <label className="check">
                <input type="checkbox" checked={settings.showLabel} onChange={e => set('showLabel', e.target.checked)} />
                Show label above
              </label>
              <label>Label size (pt)
                <input type="number" min="4" max="36" value={settings.labelFont} onChange={num('labelFont', 4, 36)} disabled={!settings.showLabel} />
              </label>
              <label className="check">
                <input type="checkbox" checked={settings.showValue} onChange={e => set('showValue', e.target.checked)} />
                Show value below
              </label>
              <label>Value size (pt)
                <input type="number" min="4" max="36" value={settings.valueFont} onChange={num('valueFont', 4, 36)} disabled={!settings.showValue} />
              </label>
            </div>
          </section>

          <button className="primary" onClick={download} disabled={busy || !items.length}>
            {busy ? `Building… ${progress}` : `Download PDF (${items.length} codes, ${pageCount} page${pageCount > 1 ? 's' : ''})`}
          </button>
          {anyOverflow && <p className="warn">⚠ Code or text is larger than the cell — reduce size or use fewer columns/rows.</p>}
          {bad128 > 0 && <p className="warn">⚠ {bad128} value(s) contain characters Code 128 can't encode (shown as red boxes).</p>}
        </aside>

        {/* ---------- PREVIEW ---------- */}
        <main className="preview-wrap">
          <div className="preview-bar">
            <span>Preview</span>
            <span className="pager">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
              page {page + 1} of {pageCount}
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</button>
            </span>
          </div>
          <div className="page" ref={previewRef} style={{ height: px(PH) }}>
            {items.length === 0 && <div className="empty">Load data to see a preview</div>}
            {pageItems.map((it, i) => {
              const g = cellGeometry(settings, i)
              const img = imgs[it.value]
              return (
                <div key={i}>
                  {settings.cutGuides && (
                    <div className="cut" style={{ left: px(g.x0), top: px(g.y0), width: px(g.cellW), height: px(g.cellH) }} />
                  )}
                  {settings.showLabel && it.label && (
                    <div className="txt bold" style={{ left: px(g.x0), width: px(g.cellW), top: px(g.labelBaseline - settings.labelFont / 72), fontSize: ptPx(settings.labelFont) }}>{it.label}</div>
                  )}
                  {img
                    ? <img src={img} alt="" style={{ left: px(g.codeX), top: px(g.codeY), width: px(g.codeW), height: px(g.codeH) }} />
                    : <div className="bad" style={{ left: px(g.codeX), top: px(g.codeY), width: px(g.codeW), height: px(g.codeH) }} />}
                  {settings.showValue && it.value && (
                    <div className="txt" style={{ left: px(g.x0), width: px(g.cellW), top: px(g.valueBaseline - settings.valueFont / 72), fontSize: ptPx(settings.valueFont) }}>{it.value}</div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
