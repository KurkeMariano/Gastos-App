import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const DRIVE_FOLDER_ID  = '1feHsA0gYygv6gTSn_EB1reWNCQUWlw9h'
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file'
const CSV_DATA_MARKER  = '##PRESUP_DATA##'   // sentinel inside every CSV

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:'#07090f', surface:'#0f1623', surfaceHover:'#151e2e', card:'#131b2a',
  border:'#1c2a3e', borderLight:'#243650',
  text:'#dce8f5', textMuted:'#5a7a9a', textDim:'#8ca5be',
  amber:'#e8a020', amberDim:'#b47a14', amberLight:'#f5c060', amberGlow:'#e8a02033',
  green:'#22c55e', greenDim:'#16a34a', greenBg:'#0a2015',
  red:'#ef4444', redDim:'#b91c1c', redBg:'#200a0a',
  blue:'#3b82f6', purple:'#a78bfa', teal:'#2dd4bf',
  tag:'#1a2d45',
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt  = (n,sym='$') => `${sym} ${Math.abs(parseFloat(n)||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const fmtP = n => fmt(n,'$')
const fmtD = n => fmt(n,'USD')
const fmtK = n => { const v=Math.abs(parseFloat(n)||0); return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v.toFixed(0)}` }
const pct  = (a,b) => b===0?null:((a-b)/b*100)
const sign = n => n>0?'+':''
const clamp= (v,mn,mx) => Math.min(mx,Math.max(mn,v))

function getCurrentMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(m){if(!m)return '';const[y,mo]=m.split('-');const ms=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];return `${ms[parseInt(mo)-1]} ${y}`}
function monthShort(m){if(!m)return '';const[y,mo]=m.split('-');const ms=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];return `${ms[parseInt(mo)-1]} ${y.slice(2)}`}

// ─── LOCAL STORAGE ───────────────────────────────────────────────────────────
const LS={
  get: k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch{return null}},
  set: (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.warn('LS',e)}},
}

// ─── CSV — WRITE ─────────────────────────────────────────────────────────────
// The CSV has two sections:
//   1. Human-readable table (for anyone opening it in Excel/Sheets)
//   2. A single-line JSON block after CSV_DATA_MARKER (used by the app to reload)
//
// The app ONLY reads from section 2, so the human-readable layout can be
// anything — changes there never break parsing.

function buildCSV(report, analytics) {
  const q  = v => `"${String(v??'').replace(/"/g,'""')}"`
  const row = (...cols) => cols.map(q).join(',')
  const L   = []
  const t   = report.totals || {}

  // ── Human-readable header ─────────────────────────────────────────────────
  L.push(row('PRESUP — Reporte mensual'))
  L.push(row('Mes', monthLabel(report.month)))
  L.push(row('Generado', new Date().toLocaleString('es-AR')))
  report.dollarRate && L.push(row('Cotización USD', `$ ${parseFloat(report.dollarRate).toLocaleString('es-AR')}`))
  L.push('')

  L.push(row('=== INGRESOS ==='))
  L.push(row('Pesos',   `$ ${(report.income?.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})}`))
  L.push(row('Dólares', `USD ${(report.income?.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})}`))
  L.push('')

  L.push(row('=== TARJETAS ==='))
  L.push(row('Banco','Red','Gastos $','Gastos USD'))
  report.cards?.forEach(c=>L.push(row(c.bank||'Sin nombre',c.type?.toUpperCase?.(),
    (c.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2}),
    (c.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2}))))
  L.push('')

  if ((report.rent||0)>0) {
    L.push(row('=== ALQUILER ==='))
    L.push(row('Monto $', (report.rent||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
    L.push('')
  }

  if (report.otherExpenses?.some(e=>e.description||e.amount)) {
    L.push(row('=== OTROS GASTOS ==='))
    L.push(row('Descripción','Moneda','Monto'))
    report.otherExpenses.filter(e=>e.description||e.amount).forEach(e=>
      L.push(row(e.description||'Sin descripción',e.currency==='pesos'?'Pesos':'Dólares',
        (e.amount||0).toLocaleString('es-AR',{minimumFractionDigits:2}))))
    L.push('')
  }

  L.push(row('=== RESUMEN ==='))
  L.push(row('Total ingresos $',  (report.income?.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total ingresos USD',(report.income?.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total gastos $',    (t.expensesPesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total gastos USD',  (t.expensesDollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Balance $',         (t.balancePesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Balance USD',       (t.balanceDollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Estado',            (t.balancePesos||0)>=0?'POSITIVO':'NEGATIVO'))
  if (report.dollarRate && t.totalInPesos!=null)
    L.push(row(`Balance combinado (@$${parseFloat(report.dollarRate).toLocaleString('es-AR')})`,
      (t.totalInPesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))

  if (analytics) {
    L.push('')
    L.push(row('=== ANALÍTICA ==='))
    L.push(row('Mes','Ingresos $','Gastos $','Balance $'))
    analytics.trendData?.forEach(d=>L.push(row(monthLabel(d.month),d.income,d.expenses,d.balance)))
    L.push('')
    L.push(row('Promedio ingresos $', analytics.avgIncome?.toFixed(2)))
    L.push(row('Promedio gastos $',   analytics.avgExpenses?.toFixed(2)))
    L.push(row('Promedio balance $',  analytics.avgBalance?.toFixed(2)))
    L.push(row('Meses positivos',     analytics.posMonths))
    L.push(row('Meses negativos',     analytics.negMonths))
    analytics.savingsRate!=null && L.push(row('Tasa de ahorro', `${analytics.savingsRate.toFixed(1)}%`))
    analytics.expGrowth!=null  && L.push(row('Var. gastos vs mes anterior',   `${sign(analytics.expGrowth)}${analytics.expGrowth.toFixed(1)}%`))
    analytics.incGrowth!=null  && L.push(row('Var. ingresos vs mes anterior', `${sign(analytics.incGrowth)}${analytics.incGrowth.toFixed(1)}%`))
    if (analytics.topItems?.length) {
      L.push('')
      L.push(row('Top categorías de gasto'))
      analytics.topItems.forEach(([k,v])=>L.push(row(k,v.toFixed(2))))
    }
  }

  // ── Machine-readable block (the app reads ONLY this) ──────────────────────
  // One line, clearly delimited — impossible to accidentally collide with
  // any human-readable row above.
  L.push('')
  L.push(CSV_DATA_MARKER)
  L.push(JSON.stringify(report))   // single line, no commas at top level to confuse CSV parsers
  L.push(CSV_DATA_MARKER)

  return L.join('\n')
}

// ─── CSV — PARSE ─────────────────────────────────────────────────────────────
// Looks for the ##PRESUP_DATA## sentinel and parses the JSON line between them.
// Returns null if the file is not a valid PRESUP report.
function parseReportFromCSV(text) {
  try {
    const lines = text.split(/\r?\n/)
    const start = lines.findIndex(l => l.trim() === CSV_DATA_MARKER)
    if (start === -1) return null
    const jsonLine = lines[start + 1]?.trim()
    if (!jsonLine) return null
    const report = JSON.parse(jsonLine)
    // Minimal validation — must have month and totals
    if (!report.month || !report.totals) return null
    return report
  } catch {
    return null
  }
}

// ─── GOOGLE DRIVE HOOK ───────────────────────────────────────────────────────
function useDrive(onHistoryLoaded) {
  const [token,      setToken]      = useState(null)
  const [status,     setStatus]     = useState('idle')   // idle|loading|connected|error
  const [syncStatus, setSyncStatus] = useState('idle')   // idle|syncing|done|error
  const [syncCount,  setSyncCount]  = useState(0)
  const tokenClientRef = useRef(null)

  // ── helpers ──────────────────────────────────────────────────────────────
  const driveGet = useCallback(async (url, tk) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } })
    if (!res.ok) {
      const err = await res.json().catch(()=>({}))
      if (err?.error?.code===401) { setToken(null); setStatus('idle') }
      throw new Error(err?.error?.message || `HTTP ${res.status}`)
    }
    return res
  }, [])

  // ── list all presupuesto_*.csv files in the folder ───────────────────────
  const listReportFiles = useCallback(async (tk) => {
    const q = encodeURIComponent(
      `'${DRIVE_FOLDER_ID}' in parents and name contains 'presupuesto_' and mimeType = 'text/csv' and trashed = false`
    )
    const res = await driveGet(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=name&pageSize=100`,
      tk
    )
    const data = await res.json()
    return data.files || []
  }, [driveGet])

  // ── download one file's text content ─────────────────────────────────────
  const downloadFile = useCallback(async (fileId, tk) => {
    const res = await driveGet(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      tk
    )
    return res.text()
  }, [driveGet])

  // ── background sync: load all past reports from Drive ────────────────────
  const syncHistory = useCallback(async (tk) => {
    setSyncStatus('syncing')
    try {
      const files = await listReportFiles(tk)
      if (!files.length) { setSyncStatus('done'); setSyncCount(0); return }

      const reports = []
      // Download all in parallel (they're small CSV files)
      await Promise.all(files.map(async f => {
        try {
          const text = await downloadFile(f.id, tk)
          const report = parseReportFromCSV(text)
          if (report) reports.push({ ...report, _driveFileId: f.id })
        } catch (e) {
          console.warn(`Could not parse ${f.name}:`, e)
        }
      }))

      if (reports.length > 0) {
        onHistoryLoaded(reports)
        setSyncCount(reports.length)
      }
      setSyncStatus('done')
    } catch (e) {
      console.error('Drive sync error:', e)
      setSyncStatus('error')
    }
  }, [listReportFiles, downloadFile, onHistoryLoaded])

  // ── init token client ─────────────────────────────────────────────────────
  const initTokenClient = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) return
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) { setStatus('error'); return }
        setToken(resp.access_token)
        setStatus('connected')
        // Kick off background sync immediately after auth
        syncHistory(resp.access_token)
      },
    })
  }, [syncHistory])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const iv = setInterval(() => {
      if (window.google?.accounts?.oauth2) { initTokenClient(); clearInterval(iv) }
    }, 300)
    return () => clearInterval(iv)
  }, [initTokenClient])

  const connect    = () => { if (!tokenClientRef.current) return; setStatus('loading'); tokenClientRef.current.requestAccessToken({ prompt: 'consent' }) }
  const disconnect = () => { if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token,()=>{}); setToken(null); setStatus('idle'); setSyncStatus('idle') }

  // ── upload one CSV to Drive ───────────────────────────────────────────────
  // If a file for the same month already exists, update it; otherwise create.
  const uploadCSV = useCallback(async (filename, content, existingFileId) => {
    if (!token) throw new Error('not_connected')
    const blob = new Blob(['\ufeff'+content], { type: 'text/csv' })

    if (existingFileId) {
      // PATCH — update existing file content
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' }, body: blob }
      )
      if (!res.ok) throw new Error(`Update failed: ${res.status}`)
      return { id: existingFileId }
    } else {
      // POST — create new file
      const metadata = { name: filename, parents: [DRIVE_FOLDER_ID], mimeType: 'text/csv' }
      const body = new FormData()
      body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      body.append('file', blob)
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }
      )
      if (!res.ok) { const e=await res.json().catch(()=>({})); if(e?.error?.code===401){setToken(null);setStatus('idle')} throw new Error(e?.error?.message||'upload_failed') }
      return res.json()
    }
  }, [token])

  return { token, status, syncStatus, syncCount, connect, disconnect, uploadCSV, isConfigured: !!GOOGLE_CLIENT_ID }
}

// ─── ANALYTICS ENGINE ────────────────────────────────────────────────────────
function computeAnalytics(history) {
  if (!history.length) return null
  const sorted = [...history].sort((a,b)=>a.month.localeCompare(b.month))
  const last=sorted[sorted.length-1], prev=sorted.length>1?sorted[sorted.length-2]:null
  const allItems={}
  sorted.forEach(h=>{
    h.cards?.forEach(c=>{ const k=`${c.bank||'Sin nombre'} (${c.type?.toUpperCase?.()})`; allItems[k]=(allItems[k]||0)+(c.pesos||0) })
    if(h.rent>0) allItems['Alquiler']=(allItems['Alquiler']||0)+h.rent
    h.otherExpenses?.forEach(e=>{ if(!e.description&&!e.amount)return; const k=e.description||'Sin descripción'; allItems[k]=(allItems[k]||0)+(e.currency==='pesos'?(e.amount||0):0) })
  })
  const topItems=Object.entries(allItems).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).slice(0,6)
  const trendData=sorted.slice(-6).map(h=>({month:h.month,expenses:h.totals?.expensesPesos||0,income:h.income?.pesos||0,balance:h.totals?.balancePesos||0}))
  const avgExpenses=sorted.reduce((a,h)=>a+(h.totals?.expensesPesos||0),0)/sorted.length
  const avgIncome  =sorted.reduce((a,h)=>a+(h.income?.pesos||0),0)/sorted.length
  const avgBalance =sorted.reduce((a,h)=>a+(h.totals?.balancePesos||0),0)/sorted.length
  const posMonths  =sorted.filter(h=>(h.totals?.balancePesos||0)>=0).length
  const lastInc=last.income?.pesos||0, lastExp=last.totals?.expensesPesos||0
  const savingsRate=lastInc>0?((lastInc-lastExp)/lastInc*100):null
  const peakMonth  =sorted.reduce((b,h)=>(h.totals?.expensesPesos||0)>(b.totals?.expensesPesos||0)?h:b,sorted[0])
  const cardTotals={}
  sorted.forEach(h=>h.cards?.forEach(c=>{ const k=`${c.bank||'Sin nombre'} (${c.type?.toUpperCase?.()})`; cardTotals[k]=(cardTotals[k]||0)+(c.pesos||0) }))
  const topCards=Object.entries(cardTotals).sort(([,a],[,b])=>b-a).slice(0,4)
  return { sorted,last,prev,topItems,trendData,
    expGrowth:prev?pct(lastExp,prev.totals?.expensesPesos||0):null,
    incGrowth:prev?pct(lastInc,prev.income?.pesos||0):null,
    avgExpenses,avgIncome,avgBalance,posMonths,negMonths:sorted.length-posMonths,
    savingsRate,peakMonth,topCards }
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────
function BarChart({data}){
  if(!data?.length) return null
  const maxVal=Math.max(...data.map(d=>Math.max(d.expenses,d.income)),1)
  const barH=80
  return(
    <div style={{display:'flex',alignItems:'flex-end',gap:'clamp(3px,1.5vw,8px)',height:barH+54,overflowX:'auto',paddingBottom:'2px'}}>
      {data.map((d,i)=>{
        const eH=Math.round((d.expenses/maxVal)*barH)
        const iH=Math.round((d.income/maxVal)*barH)
        const pos=d.balance>=0
        return(
          <div key={i} style={{flex:'0 0 auto',minWidth:'34px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
            <div style={{display:'flex',gap:'2px',alignItems:'flex-end',height:barH}}>
              <div style={{width:'9px',height:iH||2,background:C.green,borderRadius:'2px 2px 0 0',opacity:0.75}}/>
              <div style={{width:'9px',height:eH||2,background:C.red,borderRadius:'2px 2px 0 0',opacity:0.75}}/>
            </div>
            <div style={{fontSize:'9px',color:pos?C.green:C.red,fontFamily:'monospace',textAlign:'center',lineHeight:1.2}}>{sign(d.balance)}{fmtK(d.balance)}</div>
            <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace',textAlign:'center',whiteSpace:'nowrap'}}>{monthShort(d.month)}</div>
          </div>
        )
      })}
      <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:'4px',marginLeft:'8px',paddingBottom:'30px',flex:'0 0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><div style={{width:'8px',height:'8px',background:C.green,borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>Ingreso</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><div style={{width:'8px',height:'8px',background:C.red,borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>Gasto</span></div>
      </div>
    </div>
  )
}

function DonutChart({items,size=110}){
  if(!items?.length) return null
  const total=items.reduce((a,[,v])=>a+v,0)
  const COLORS=[C.amber,C.blue,C.purple,C.teal,'#f472b6','#fb923c']
  let cum=-90
  const cx=size/2,cy=size/2,r=size/2-8,ri=r-16
  const slices=items.map(([,v],i)=>{
    const angle=(v/total)*360
    const s1=cum*(Math.PI/180),e1=(cum+angle)*(Math.PI/180);cum+=angle
    const x1=cx+r*Math.cos(s1),y1=cy+r*Math.sin(s1),x2=cx+r*Math.cos(e1),y2=cy+r*Math.sin(e1)
    const xi1=cx+ri*Math.cos(s1),yi1=cy+ri*Math.sin(s1),xi2=cx+ri*Math.cos(e1),yi2=cy+ri*Math.sin(e1)
    const large=angle>180?1:0
    return{d:`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large},0 ${xi1},${yi1} Z`,color:COLORS[i%COLORS.length]}
  })
  return(<svg width={size} height={size} style={{flexShrink:0}}>{slices.map((s,i)=><path key={i} d={s.d} fill={s.color} opacity="0.85"/>)}</svg>)
}

// ─── DRIVE STATUS BUTTON ──────────────────────────────────────────────────────
function DriveButton({drive}){
  const {status,syncStatus,syncCount,connect,disconnect,isConfigured}=drive
  const syncing = syncStatus==='syncing'

  if(!isConfigured) return(
    <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'5px 10px',background:`${C.amber}11`,border:`1px dashed ${C.amber}55`,borderRadius:'8px',fontSize:'11px',fontFamily:'monospace',color:C.amberLight}}>
      ⚠ Falta VITE_GOOGLE_CLIENT_ID
    </div>
  )
  if(status==='connected') return(
    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
      {syncing&&(
        <div style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',fontFamily:'monospace',color:C.textMuted}}>
          <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal,animation:'pulse 1s infinite'}}/>
          Sincronizando…
        </div>
      )}
      {syncStatus==='done'&&syncCount>0&&(
        <div style={{fontSize:'11px',fontFamily:'monospace',color:C.teal}}>
          ✓ {syncCount} mes{syncCount!==1?'es':''} de Drive
        </div>
      )}
      <button onClick={disconnect} style={{background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}55`,borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer'}}>
        ✓ Drive
      </button>
    </div>
  )
  if(status==='loading') return(
    <div style={{padding:'5px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:C.textMuted}}>
      Conectando…
    </div>
  )
  return(
    <button onClick={connect} style={{background:`${C.blue}18`,color:'#93c5fd',border:`1px solid ${C.blue}55`,borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px'}}>
      ↑ Conectar Drive
    </button>
  )
}

// ─── ANALYTICS VIEW ──────────────────────────────────────────────────────────
function AnalyticsView({history,syncStatus}){
  const a=computeAnalytics(history)
  const COLORS=[C.amber,C.blue,C.purple,C.teal,'#f472b6','#fb923c']
  const loading = syncStatus==='syncing'

  if(loading&&!history.length) return(
    <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
      <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.4}}>◈</div>
      <div>Cargando historial desde Drive…</div>
    </div>
  )
  if(!a||!history.length) return(
    <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
      <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.3}}>◈</div>
      <div>Sin datos suficientes</div>
      <div style={{fontSize:'12px',marginTop:'8px'}}>Cargá al menos un mes para ver métricas</div>
    </div>
  )
  const maxTopVal=a.topItems[0]?.[1]||1
  return(
    <>
      {loading&&(
        <div style={{marginBottom:'1rem',padding:'8px 12px',background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:C.teal,display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal}}/>
          Actualizando datos desde Drive…
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {label:'PROM. GASTOS',  val:fmtP(a.avgExpenses), color:C.red},
          {label:'PROM. INGRESO', val:fmtP(a.avgIncome),   color:C.green},
          {label:'MESES +',       val:`${a.posMonths} / ${history.length}`, color:a.posMonths>=a.negMonths?C.green:C.red},
          {label:'AHORRO',        val:a.savingsRate!=null?`${a.savingsRate.toFixed(1)}%`:'—', color:a.savingsRate>0?C.green:C.red},
        ].map((k,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${k.color}33`,borderRadius:'10px',padding:'1rem'}}>
            <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1.5px',marginBottom:'6px'}}>{k.label}</div>
            <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      {a.expGrowth!=null&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// VS MES ANTERIOR</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            {[
              {label:'GASTOS',   val:a.expGrowth, isGastos:true},
              {label:'INGRESOS', val:a.incGrowth, isGastos:false},
            ].filter(x=>x.val!=null).map((item,i)=>{
              const good=item.isGastos?item.val<=0:item.val>=0
              const color=item.val===0?C.textMuted:good?C.green:C.red
              const arrow=item.val>0?'↑':item.val<0?'↓':'→'
              return(
                <div key={i}>
                  <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>{item.label}</div>
                  <div style={{fontSize:'22px',fontWeight:700,fontFamily:'monospace',color,marginBottom:'6px'}}>{arrow} {sign(item.val)}{item.val.toFixed(1)}%</div>
                  <div style={{background:C.surface,borderRadius:'3px',height:'4px'}}>
                    <div style={{height:'4px',width:`${clamp(Math.abs(item.val),0,100)}%`,background:color,borderRadius:'3px',minWidth:'3px'}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {a.trendData.length>1&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// ÚLTIMOS {a.trendData.length} MESES</div>
          <BarChart data={a.trendData}/>
        </div>
      )}

      {a.topItems.length>0&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// TOP GASTOS ACUMULADOS</div>
          <div style={{display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:'1',minWidth:'180px'}}>
              {a.topItems.map(([k,v],i)=>(
                <div key={i} style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'12px',color:C.textDim,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'65%'}}>{k}</span>
                    <span style={{fontSize:'12px',color:COLORS[i%COLORS.length],fontFamily:'monospace',fontWeight:600}}>{fmtP(v)}</span>
                  </div>
                  <div style={{background:C.surface,borderRadius:'3px',height:'4px'}}>
                    <div style={{height:'4px',width:`${(v/maxTopVal)*100}%`,background:COLORS[i%COLORS.length],borderRadius:'3px',opacity:0.8}}/>
                  </div>
                </div>
              ))}
            </div>
            <DonutChart items={a.topItems}/>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.75rem'}}>// BALANCE</div>
          {[
            ['Balance promedio',fmtP(a.avgBalance),a.avgBalance>=0?C.green:C.red],
            ['Mes pico gasto',monthLabel(a.peakMonth?.month),C.amber],
            ['Gasto pico',fmtP(a.peakMonth?.totals?.expensesPesos),C.red],
          ].map(([k,v,c],i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'4px',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace'}}>{k}</span>
              <span style={{fontSize:'12px',color:c,fontFamily:'monospace',fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        {a.topCards.length>0&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem'}}>
            <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.75rem'}}>// TOP TARJETAS</div>
            {a.topCards.map(([k,v],i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'4px',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'55%'}}>{k}</span>
                <span style={{fontSize:'12px',color:C.red,fontFamily:'monospace'}}>{fmtP(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── REPORT VIEW ─────────────────────────────────────────────────────────────
function ReportView({report}){
  const t=report.totals||{}
  const incP=report.income?.pesos||0,incD=report.income?.dollars||0
  const balP=t.balancePesos||0,balD=t.balanceDollars||0
  const cS={background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1rem'}
  const rRow={display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}
  const badge=type=>({display:'inline-block',background:type==='visa'?'#1a2a4e':type==='mastercard'?'#2a1a3e':'#1a2e2a',color:type==='visa'?'#60a5fa':type==='mastercard'?'#c084fc':'#2dd4bf',border:`1px solid ${type==='visa'?'#2a3a6e':type==='mastercard'?'#4a2a6e':'#1f4a40'}`,borderRadius:'4px',padding:'2px 7px',fontSize:'10px',fontFamily:'monospace',letterSpacing:'1px'})
  return(
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {l:'INGRESOS $', v:fmtP(incP), c:C.green, s:incD>0?`+ ${fmtD(incD)}`:''},
          {l:'GASTOS $',   v:fmtP(t.expensesPesos||0), c:C.red, s:(t.expensesDollars||0)>0?`+ ${fmtD(t.expensesDollars)}`:''},
          {l:'BALANCE $',  v:(balP<0?'-':'')+fmtP(Math.abs(balP)), c:balP>=0?C.green:C.red, s:incD>0?(balD<0?'-':'+')+fmtD(Math.abs(balD)):'', bd:balP>=0?C.greenDim:C.redDim},
        ].map((m,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${m.bd?m.bd+'44':C.border}`,borderRadius:'10px',padding:'0.9rem'}}>
            <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>{m.l}</div>
            <div style={{fontSize:'clamp(13px,3vw,20px)',fontWeight:700,fontFamily:'monospace',color:m.c,wordBreak:'break-all'}}>{m.v}</div>
            {m.s&&<div style={{fontSize:'10px',color:m.c,fontFamily:'monospace',marginTop:'3px',opacity:0.8}}>{m.s}</div>}
          </div>
        ))}
      </div>
      {t.totalInPesos!=null&&(
        <div style={{background:t.totalInPesos>=0?C.greenBg:C.redBg,border:`1px solid ${t.totalInPesos>=0?C.greenDim:C.redDim}`,borderRadius:'10px',padding:'1rem',marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
          <div style={{fontSize:'11px',fontFamily:'monospace',color:t.totalInPesos>=0?C.green:C.red}}>COMBINADO @ ${parseFloat(report.dollarRate||0).toLocaleString('es-AR')}/USD</div>
          <div style={{fontSize:'clamp(18px,4vw,26px)',fontWeight:700,fontFamily:'monospace',color:t.totalInPesos>=0?C.green:C.red}}>{t.totalInPesos<0?'-':''}{fmtP(Math.abs(t.totalInPesos))}</div>
        </div>
      )}
      <div style={cS}>
        <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  INGRESOS</div>
        <div style={rRow}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Pesos</span><span style={{fontFamily:'monospace',color:C.green}}>{fmtP(incP)}</span></div>
        <div style={{...rRow,borderBottom:'none'}}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Dólares</span><span style={{fontFamily:'monospace',color:C.green}}>{fmtD(incD)}</span></div>
      </div>
      <div style={cS}>
        <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  TARJETAS</div>
        {report.cards?.map((c,i)=>(
          <div key={i} style={rRow}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={badge(c.type)}>{c.type?.toUpperCase?.()}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim}}>{c.bank||'Sin nombre'}</span></div>
            <div style={{textAlign:'right'}}>
              {c.pesos>0&&<div style={{fontFamily:'monospace',color:C.red,fontSize:'13px'}}>{fmtP(c.pesos)}</div>}
              {c.dollars>0&&<div style={{fontFamily:'monospace',color:'#f87171',fontSize:'12px'}}>{fmtD(c.dollars)}</div>}
              {!c.pesos&&!c.dollars&&<span style={{fontFamily:'monospace',fontSize:'12px',color:C.textMuted}}>$ 0.00</span>}
            </div>
          </div>
        ))}
        <div style={{...rRow,borderBottom:'none',paddingTop:'10px'}}>
          <span style={{fontFamily:'monospace',fontSize:'11px',color:C.textMuted}}>SUBTOTAL</span>
          <span style={{fontFamily:'monospace',color:C.red}}>{fmtP(report.cards?.reduce((a,c)=>a+(c.pesos||0),0)||0)}</span>
        </div>
      </div>
      {(report.rent||0)>0&&(
        <div style={cS}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  ALQUILER</div>
          <div style={{...rRow,borderBottom:'none'}}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Alquiler</span><span style={{fontFamily:'monospace',color:C.red}}>{fmtP(report.rent)}</span></div>
        </div>
      )}
      {report.otherExpenses?.some(e=>e.description||e.amount)&&(
        <div style={cS}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  OTROS GASTOS</div>
          {report.otherExpenses.filter(e=>e.description||e.amount).map((e,i,arr)=>(
            <div key={i} style={i===arr.length-1?{...rRow,borderBottom:'none'}:rRow}>
              <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim,overflow:'hidden',textOverflow:'ellipsis',maxWidth:'60%'}}>{e.description||'Sin descripción'}</span>
              <span style={{fontFamily:'monospace',color:C.red,fontSize:'13px'}}>{e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{background:balP>=0?C.greenBg:C.redBg,border:`2px solid ${balP>=0?C.greenDim:C.redDim}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:balD!==0?'0.75rem':0}}>
          <span style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:balP>=0?C.green:C.red}}>//  BALANCE FINAL $</span>
          <span style={{fontSize:'clamp(20px,5vw,32px)',fontWeight:700,fontFamily:'monospace',color:balP>=0?C.green:C.red}}>{balP<0?'-':''}{fmtP(Math.abs(balP))}</span>
        </div>
        {balD!==0&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',paddingTop:'0.75rem',borderTop:`1px solid ${C.border}`}}>
            <span style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:balD>=0?C.green:C.red}}>//  BALANCE FINAL USD</span>
            <span style={{fontSize:'clamp(16px,4vw,24px)',fontWeight:700,fontFamily:'monospace',color:balD>=0?C.green:C.red}}>{balD<0?'-':''}{fmtD(Math.abs(balD))}</span>
          </div>
        )}
      </div>
    </>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const btnPrimary={background:`linear-gradient(135deg,${C.amber},${C.amberDim})`,color:'#07090f',border:'none',borderRadius:'8px',padding:'11px 20px',fontSize:'14px',fontFamily:'monospace',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',boxShadow:`0 0 18px ${C.amberGlow}`,touchAction:'manipulation'}
const btnAdd    ={background:`${C.amber}18`,color:C.amberLight,border:`1.5px solid ${C.amber}`,borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontFamily:'monospace',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',boxShadow:`0 0 14px ${C.amberGlow}`,touchAction:'manipulation'}
const btnSec    ={background:'transparent',color:C.textDim,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontFamily:'monospace',letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',touchAction:'manipulation'}
const btnDanger ={background:'transparent',color:C.red,border:`1px solid ${C.redDim}44`,borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer',fontFamily:'monospace',touchAction:'manipulation'}
const inp       ={background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',WebkitAppearance:'none'}
const sel       ={background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',cursor:'pointer',WebkitAppearance:'none'}
const navBtn    =active=>({background:active?C.amber:'transparent',color:active?'#07090f':C.textDim,border:`1px solid ${active?C.amber:C.border}`,borderRadius:'6px',padding:'8px 12px',fontSize:'12px',cursor:'pointer',fontFamily:'monospace',fontWeight:active?700:400,letterSpacing:'0.5px',touchAction:'manipulation',flex:1})
const STEPS=[{l:'INGRESOS',i:'↑'},{l:'TARJETAS',i:'▣'},{l:'ALQUILER',i:'⌂'},{l:'GASTOS',i:'≡'},{l:'REPORTE',i:'◈'}]

// ─── MERGE HISTORY ────────────────────────────────────────────────────────────
// Drive reports win over local if same month (Drive is source of truth).
// Keeps _driveFileId so we can PATCH instead of POST on next save.
function mergeHistory(local, fromDrive) {
  const map = {}
  local.forEach(r    => { map[r.month] = r })
  fromDrive.forEach(r => { map[r.month] = r })   // Drive overwrites local
  return Object.values(map).sort((a,b)=>b.month.localeCompare(a.month))
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [history,    setHistory]    = useState(()=>LS.get('presup:history')||[])
  const [view,       setView]       = useState('form')
  const [step,       setStep]       = useState(0)
  const [selMonth,   setSelMonth]   = useState(getCurrentMonth)
  const [dollarRate, setDollarRate] = useState('')
  const [income,     setIncome]     = useState({pesos:'',dollars:''})
  const [cards,      setCards]      = useState([
    {id:1,bank:'',type:'visa',pesos:'',dollars:''},
    {id:2,bank:'',type:'visa',pesos:'',dollars:''},
    {id:3,bank:'',type:'mastercard',pesos:'',dollars:''},
    {id:4,bank:'',type:'mastercard',pesos:'',dollars:''},
  ])
  const [rent,      setRent]      = useState('')
  const [others,    setOthers]    = useState([{id:1,description:'',amount:'',currency:'pesos'}])
  const [finalized, setFinalized] = useState(false)
  const [errors,    setErrors]    = useState({})
  const [saveMsg,   setSaveMsg]   = useState(null)
  const [histDetail,setHistDetail]= useState(null)
  const cardId=useRef(5), othId=useRef(2)

  // Persist history to LS and state together
  const persist = useCallback(h => { setHistory(h); LS.set('presup:history',h) }, [])

  // Called by Drive hook when background sync completes
  const onHistoryLoaded = useCallback(driveReports => {
    setHistory(prev => {
      const merged = mergeHistory(prev, driveReports)
      LS.set('presup:history', merged)
      return merged
    })
  }, [])

  const drive = useDrive(onHistoryLoaded)

  // ── form helpers ────────────────────────────────────────────────────────
  const addCard =()=>setCards(p=>[...p,{id:cardId.current++,bank:'',type:'visa',pesos:'',dollars:''}])
  const rmCard  =id=>cards.length>1&&setCards(p=>p.filter(c=>c.id!==id))
  const updCard =(id,f,v)=>{if((f==='pesos'||f==='dollars')&&v!==''&&parseFloat(v)<0)return;setCards(p=>p.map(c=>c.id===id?{...c,[f]:v}:c))}
  const addOther=()=>setOthers(p=>[...p,{id:othId.current++,description:'',amount:'',currency:'pesos'}])
  const rmOther =id=>setOthers(p=>p.filter(e=>e.id!==id))
  const updOther=(id,f,v)=>{if(f==='amount'&&v!==''&&parseFloat(v)<0)return;setOthers(p=>p.map(e=>e.id===id?{...e,[f]:v}:e))}

  const validate=()=>{
    const e={}
    if(step===0){if(!income.pesos&&!income.dollars)e.income='Ingresá al menos un ingreso';if(income.pesos&&parseFloat(income.pesos)<0)e.incP='No puede ser negativo';if(income.dollars&&parseFloat(income.dollars)<0)e.incD='No puede ser negativo'}
    if(step===1) cards.forEach(c=>{if(!c.bank.trim())e[`b${c.id}`]='Nombre requerido'})
    if(step===2&&rent!==''&&parseFloat(rent)<0) e.rent='No puede ser negativo'
    setErrors(e);return!Object.keys(e).length
  }

  const computeTotals=()=>{
    const cardP=cards.reduce((a,c)=>a+(parseFloat(c.pesos)||0),0)
    const cardD=cards.reduce((a,c)=>a+(parseFloat(c.dollars)||0),0)
    const rentV=parseFloat(rent)||0
    const othP =others.filter(e=>e.currency==='pesos').reduce((a,e)=>a+(parseFloat(e.amount)||0),0)
    const othD =others.filter(e=>e.currency==='dollars').reduce((a,e)=>a+(parseFloat(e.amount)||0),0)
    const expP=cardP+rentV+othP, expD=cardD+othD
    const incP=parseFloat(income.pesos)||0, incD=parseFloat(income.dollars)||0
    const balP=incP-expP, balD=incD-expD
    const total=dollarRate?(incP+incD*parseFloat(dollarRate)-expP-expD*parseFloat(dollarRate)):null
    return{expensesPesos:expP,expensesDollars:expD,balancePesos:balP,balanceDollars:balD,totalInPesos:total}
  }

  const buildReport=()=>({
    month:selMonth, dollarRate:dollarRate||null,
    income:{pesos:parseFloat(income.pesos)||0, dollars:parseFloat(income.dollars)||0},
    cards:cards.map(c=>({...c,pesos:parseFloat(c.pesos)||0,dollars:parseFloat(c.dollars)||0})),
    rent:parseFloat(rent)||0,
    otherExpenses:others.map(e=>({...e,amount:parseFloat(e.amount)||0})),
    totals:computeTotals(), savedAt:new Date().toISOString(),
  })

  const doSave=async(report)=>{
    const nh=[report,...history.filter(h=>h.month!==report.month)]
    const analytics=computeAnalytics(nh)
    const csv=buildCSV(report,analytics)
    const filename=`presupuesto_${report.month}.csv`
    setSaveMsg(null)
    if(drive.status==='connected'){
      try{
        // Reuse existing Drive file ID if we loaded this month from Drive before
        const existing=history.find(h=>h.month===report.month)
        const fileId=existing?._driveFileId||null
        const result=await drive.uploadCSV(filename,csv,fileId)
        // Tag the saved report with its Drive file ID for future updates
        const taggedReport={...report,_driveFileId:result.id}
        const taggedHistory=[taggedReport,...history.filter(h=>h.month!==report.month)]
        persist(taggedHistory)
        setSaveMsg({type:'ok',text:`Guardado en Google Drive: ${filename}`})
      }catch(err){
        setSaveMsg({type:'err',text:`Error al subir a Drive: ${err.message}`})
      }
    } else {
      persist(nh)
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)
      setSaveMsg({type:'warn',text:'Descargado localmente. Conectá Drive para guardar en la nube.'})
    }
  }

  const goNext=async()=>{
    if(!validate())return
    if(step===3&&!finalized){setFinalized(true);return}
    if(step===4){const r=buildReport();await doSave(r)}
    else setStep(s=>s+1)
  }

  const resetForm=()=>{
    setStep(0);setIncome({pesos:'',dollars:''});setDollarRate('')
    setCards([{id:1,bank:'',type:'visa',pesos:'',dollars:''},{id:2,bank:'',type:'visa',pesos:'',dollars:''},{id:3,bank:'',type:'mastercard',pesos:'',dollars:''},{id:4,bank:'',type:'mastercard',pesos:'',dollars:''}])
    setRent('');setOthers([{id:1,description:'',amount:'',currency:'pesos'}]);setFinalized(false);setErrors({});setSelMonth(getCurrentMonth());setSaveMsg(null)
    cardId.current=5;othId.current=2
  }

  const analytics=computeAnalytics(history)
  const currentReport=step===4?buildReport():null

  return(
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Segoe UI',system-ui,sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus{border-color:${C.amber}!important;box-shadow:0 0 0 2px ${C.amberGlow};}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
        input[type=month]{color-scheme:dark;}
        .hist-card:hover{border-color:${C.borderLight}!important;background:${C.surfaceHover}!important;}
        .add-btn:hover{background:${C.amber}30!important;box-shadow:0 0 22px ${C.amberGlow}!important;}
        .del-btn:hover{background:${C.redDim}22!important;border-color:${C.redDim}!important;}
        button:active{transform:scale(0.97);}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${C.surface};}
        ::-webkit-scrollbar-thumb{background:${C.borderLight};border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @media(max-width:480px){
          .step-label{display:none!important;}
          .grid-cards{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 1rem',display:'flex',alignItems:'center',justifyContent:'space-between',height:'56px',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:'16px',fontWeight:700,color:C.amber,letterSpacing:'2px'}}>◈ PRESUP</div>
        <DriveButton drive={drive}/>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0.5rem 1rem',display:'flex',gap:'6px'}}>
        {[{id:'form',l:'Nuevo mes'},{id:'history',l:'Historial'},{id:'analytics',l:'Analítica'}].map(n=>(
          <button key={n.id} style={navBtn(view===n.id)} onClick={()=>{setView(n.id);setHistDetail(null)}}>{n.l}</button>
        ))}
      </div>

      <div style={{maxWidth:'680px',margin:'0 auto',padding:'1.25rem 1rem 5rem'}}>

        {/* ══ FORM ═════════════════════════════════════════════════════ */}
        {view==='form'&&(
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',gap:'0.75rem',flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{monthLabel(selMonth)}</div>
                <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'2px'}}>REGISTRO MENSUAL</div>
              </div>
              <input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{...inp,width:'160px',fontSize:'14px',padding:'8px 10px'}}/>
            </div>

            {/* Steps */}
            <div style={{display:'flex',marginBottom:'1.5rem',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
              {STEPS.map((st,i)=>(
                <div key={i} style={{flex:1,padding:'10px 4px',textAlign:'center',fontSize:'10px',fontFamily:'monospace',letterSpacing:'0.5px',color:step>i?C.amber:step===i?C.text:C.textMuted,background:step===i?C.card:'transparent',borderRight:i<STEPS.length-1?`1px solid ${C.border}`:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'default'}}>
                  <span style={{fontSize:'14px',opacity:step===i?1:0.5}}>{st.i}</span>
                  <span className="step-label">{st.l}</span>
                  {step>i&&<span style={{fontSize:'8px',color:C.amber}}>✓</span>}
                </div>
              ))}
            </div>

            {/* ── Step 0 Ingresos ─────────────────────────────────── */}
            {step===0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// INGRESOS DEL MES</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
                  <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>PESOS ($)</label><input type="number" min="0" inputMode="decimal" placeholder="0.00" value={income.pesos} onChange={e=>setIncome(p=>({...p,pesos:e.target.value}))} style={inp}/>{errors.incP&&<div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors.incP}</div>}</div>
                  <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>DÓLARES (USD)</label><input type="number" min="0" inputMode="decimal" placeholder="0.00" value={income.dollars} onChange={e=>setIncome(p=>({...p,dollars:e.target.value}))} style={inp}/>{errors.incD&&<div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors.incD}</div>}</div>
                </div>
                {errors.income&&<div style={{color:C.red,fontSize:'12px',fontFamily:'monospace',marginBottom:'0.5rem'}}>{errors.income}</div>}
                <div style={{borderTop:`1px solid ${C.border}`,margin:'1rem 0'}}/>
                <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>COTIZACIÓN USD → $ (opcional)</label>
                <input type="number" min="0" inputMode="decimal" placeholder="Ej: 1350" value={dollarRate} onChange={e=>setDollarRate(e.target.value)} style={{...inp,maxWidth:'200px'}}/>
              </div>
            )}

            {/* ── Step 1 Tarjetas ─────────────────────────────────── */}
            {step===1&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                  <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber}}>// TARJETAS</div>
                  <button className="add-btn" style={btnAdd} onClick={addCard}>＋ Agregar</button>
                </div>
                {cards.map((c,idx)=>(
                  <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'0.9rem',marginBottom:'0.6rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace'}}>#{idx+1}</span>
                        <span style={{display:'inline-block',background:c.type==='visa'?'#1a2a4e':'#2a1a3e',color:c.type==='visa'?'#60a5fa':'#c084fc',border:`1px solid ${c.type==='visa'?'#2a3a6e':'#4a2a6e'}`,borderRadius:'4px',padding:'2px 7px',fontSize:'10px',fontFamily:'monospace'}}>{c.type?.toUpperCase?.()}</span>
                      </div>
                      {cards.length>1&&<button className="del-btn" style={btnDanger} onClick={()=>rmCard(c.id)}>✕</button>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginBottom:'0.6rem'}}>
                      <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>BANCO</label><input type="text" placeholder="Ej: Santander" value={c.bank} onChange={e=>updCard(c.id,'bank',e.target.value)} style={inp}/>{errors[`b${c.id}`]&&<div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors[`b${c.id}`]}</div>}</div>
                      <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>RED</label><select value={c.type} onChange={e=>updCard(c.id,'type',e.target.value)} style={sel}><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="amex">Amex</option><option value="naranja">Naranja</option></select></div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}}>
                      <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>GASTOS $</label><input type="number" min="0" inputMode="decimal" placeholder="0.00" value={c.pesos} onChange={e=>updCard(c.id,'pesos',e.target.value)} style={inp}/></div>
                      <div><label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>GASTOS USD</label><input type="number" min="0" inputMode="decimal" placeholder="0.00" value={c.dollars} onChange={e=>updCard(c.id,'dollars',e.target.value)} style={inp}/></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 2 Alquiler ─────────────────────────────────── */}
            {step===2&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// ALQUILER</div>
                <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>MONTO EN PESOS ($)</label>
                <input type="number" min="0" inputMode="decimal" placeholder="0.00 (dejá vacío si no aplica)" value={rent} onChange={e=>{if(e.target.value===''||parseFloat(e.target.value)>=0)setRent(e.target.value)}} style={{...inp,maxWidth:'280px'}}/>
                {errors.rent&&<div style={{color:C.red,fontSize:'11px',marginTop:'4px'}}>{errors.rent}</div>}
              </div>
            )}

            {/* ── Step 3 Otros gastos ─────────────────────────────── */}
            {step===3&&!finalized&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                  <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber}}>// OTROS GASTOS</div>
                  <button className="add-btn" style={btnAdd} onClick={addOther}>＋ Agregar</button>
                </div>
                {others.map((e,idx)=>(
                  <div key={e.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:'6px',marginBottom:'0.5rem',alignItems:'end'}}>
                    <div>{idx===0&&<label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>DESCRIPCIÓN</label>}<input type="text" placeholder="Ej: Super" value={e.description} onChange={ev=>updOther(e.id,'description',ev.target.value)} style={inp}/></div>
                    <div>{idx===0&&<label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONTO</label>}<input type="number" min="0" inputMode="decimal" placeholder="0" value={e.amount} onChange={ev=>updOther(e.id,'amount',ev.target.value)} style={inp}/></div>
                    <div>{idx===0&&<label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONEDA</label>}<select value={e.currency} onChange={ev=>updOther(e.id,'currency',ev.target.value)} style={sel}><option value="pesos">$</option><option value="dollars">USD</option></select></div>
                    <button className="del-btn" style={{...btnDanger,paddingTop:'12px',paddingBottom:'12px'}} onClick={()=>rmOther(e.id)}>✕</button>
                  </div>
                ))}
                <div style={{marginTop:'1.25rem',padding:'0.9rem',background:`${C.amber}08`,border:`1px dashed ${C.amber}44`,borderRadius:'8px'}}>
                  <span style={{fontSize:'12px',color:C.textDim,fontFamily:'monospace'}}>Cuando termines, presioná "Finalizar carga".</span>
                </div>
              </div>
            )}

            {step===3&&finalized&&(
              <div style={{background:C.card,border:`1px solid ${C.amber}55`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.9rem'}}>// CARGA FINALIZADA</div>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0.75rem'}}>
                  <span style={{fontSize:'24px',color:C.green}}>✓</span>
                  <div style={{fontFamily:'monospace',color:C.text,fontSize:'14px'}}>{others.filter(e=>e.description||e.amount).length} otros gastos cargados</div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                  {others.filter(e=>e.description||e.amount).map(e=><span key={e.id} style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'6px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>{e.description||'Sin nombre'}: {e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>)}
                </div>
              </div>
            )}

            {/* ── Step 4 Reporte ──────────────────────────────────── */}
            {step===4&&currentReport&&(
              <>
                <ReportView report={currentReport}/>
                {saveMsg&&(
                  <div style={{marginBottom:'1rem',padding:'0.75rem 1rem',background:saveMsg.type==='ok'?`${C.greenDim}22`:saveMsg.type==='err'?`${C.redDim}22`:`${C.amberDim}22`,border:`1px solid ${saveMsg.type==='ok'?C.greenDim:saveMsg.type==='err'?C.redDim:C.amber}`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:saveMsg.type==='ok'?C.green:saveMsg.type==='err'?C.red:C.amberLight}}>
                    {saveMsg.type==='ok'?'✓ ':saveMsg.type==='err'?'✕ ':'⚠ '}{saveMsg.text}
                  </div>
                )}
              </>
            )}

            {/* Nav */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'1.5rem',paddingTop:'1.25rem',borderTop:`1px solid ${C.border}`}}>
              <div style={{display:'flex',gap:'8px'}}>
                {step>0&&<button style={btnSec} onClick={()=>{if(step===3&&finalized)setFinalized(false);else setStep(s=>s-1)}}>← Atrás</button>}
                {step===4&&<button style={btnSec} onClick={resetForm}>+ Nuevo</button>}
              </div>
              {step<4&&<button style={btnPrimary} onClick={goNext}>{step===3&&!finalized?'✓ Finalizar':step===3&&finalized?'Ver reporte →':'Continuar →'}</button>}
              {step===4&&<button style={btnPrimary} onClick={goNext}>↓ Guardar CSV</button>}
            </div>
          </>
        )}

        {/* ══ HISTORY ══════════════════════════════════════════════════ */}
        {view==='history'&&(
          !histDetail?(
            <>
              <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'8px'}}>
                <div>
                  <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>Historial</div>
                  <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'4px'}}>{history.length} registros</div>
                </div>
                {drive.syncStatus==='syncing'&&(
                  <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',fontFamily:'monospace',color:C.teal}}>
                    <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal,animation:'pulse 1s infinite'}}/>
                    Sincronizando con Drive…
                  </div>
                )}
              </div>
              {!history.length&&(
                <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
                  <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.3}}>◈</div>
                  <div>{drive.syncStatus==='syncing'?'Cargando desde Drive…':'Sin registros guardados'}</div>
                </div>
              )}
              {history.map((h,i)=>{
                const bal=h.totals?.balancePesos??0
                return(
                  <div key={i} className="hist-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'1.1rem',marginBottom:'0.75rem',cursor:'pointer',transition:'border-color 0.15s,background 0.15s'}} onClick={()=>setHistDetail(h)}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                          <span style={{fontFamily:'monospace',fontSize:'15px',fontWeight:600}}>{monthLabel(h.month)}</span>
                          {h._driveFileId&&<span style={{fontSize:'9px',fontFamily:'monospace',color:C.teal,background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'4px',padding:'1px 6px'}}>DRIVE</span>}
                        </div>
                        <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                          <span style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'5px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>↑ {fmtP(h.income?.pesos)}</span>
                          <span style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'5px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>↓ {fmtP(h.totals?.expensesPesos)}</span>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'9px',fontFamily:'monospace',color:C.textMuted,letterSpacing:'1px',marginBottom:'3px'}}>BALANCE</div>
                        <div style={{fontFamily:'monospace',fontSize:'18px',fontWeight:700,color:bal>=0?C.green:C.red}}>{bal<0?'-':''}{fmtP(Math.abs(bal))}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          ):(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
                <button style={btnSec} onClick={()=>setHistDetail(null)}>← Volver</button>
                <button style={btnPrimary} onClick={()=>doSave(histDetail)}>↓ Guardar CSV</button>
              </div>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",marginBottom:'1.25rem'}}>{monthLabel(histDetail.month)}</div>
              <ReportView report={histDetail}/>
              {saveMsg&&<div style={{marginBottom:'1rem',padding:'0.75rem 1rem',background:saveMsg.type==='ok'?`${C.greenDim}22`:`${C.amberDim}22`,border:`1px solid ${saveMsg.type==='ok'?C.greenDim:C.amber}`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:saveMsg.type==='ok'?C.green:C.amberLight}}>{saveMsg.type==='ok'?'✓ ':'⚠ '}{saveMsg.text}</div>}
            </>
          )
        )}

        {/* ══ ANALYTICS ════════════════════════════════════════════════ */}
        {view==='analytics'&&(
          <>
            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>Analítica</div>
              <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'4px'}}>{history.length} mes{history.length!==1?'es':''} registrado{history.length!==1?'s':''}</div>
            </div>
            <AnalyticsView history={history} syncStatus={drive.syncStatus}/>
          </>
        )}

      </div>
    </div>
  )
}
