# Barcode Sheet Builder

Upload a CSV/XLSX with two columns (label + value), choose **QR code** or **Code 128**, tune the
size and grid, preview, and download a print-ready PDF. 100% client-side — no server, no uploads.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy to Vercel (free)
**Option A – from GitHub (recommended)**
1. Push this folder to a GitHub repo.
2. Go to https://vercel.com/new, import the repo.
3. Vercel auto-detects Vite. Leave defaults (Build: `npm run build`, Output: `dist`). Click **Deploy**.

**Option B – from your machine**
```bash
npm i -g vercel
vercel          # follow prompts; accept the Vite defaults
vercel --prod
```

## Deploy to Azure Static Web Apps (free)
1. Azure Portal → Create resource → **Static Web App** → plan **Free**.
2. Source: GitHub → pick this repo and the `main` branch.
3. Build preset **Vite** (or Custom): app location `/`, api location empty, output location `dist`.
4. Create. Azure commits a GitHub Actions workflow; every push to `main` rebuilds and deploys.

`staticwebapp.config.json` is already included (SPA fallback). For Entra ID login, upgrade to the Standard tier and add `auth` + `routes` rules to that file.

Also works on Netlify, Cloudflare Pages, or GitHub Pages — it's just static files in `dist/`.

## Input format
Any CSV, TSV, or Excel file. The first row can be a header. You pick which column is the
**label** (printed above the code) and which is the **value** (encoded in the barcode and printed below).

## Stack
- Vite + React
- [`qrcode`](https://www.npmjs.com/package/qrcode) – QR generation
- [`jsbarcode`](https://www.npmjs.com/package/jsbarcode) – Code 128
- [`jspdf`](https://www.npmjs.com/package/jspdf) – PDF output
- [`xlsx`](https://www.npmjs.com/package/xlsx) – CSV/XLSX parsing

## Where to change things
- `src/layout.js` – page sizes, defaults, cell geometry (shared by preview and PDF)
- `src/pdf.js` – PDF rendering
- `src/barcodes.js` – barcode image generation (add other symbologies here; JsBarcode supports EAN, UPC, Code 39, ITF, etc.)
- `src/App.jsx` – UI
