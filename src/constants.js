// ─── CONFIG ──────────────────────────────────────────────────────────────────
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const DRIVE_FOLDER_ID  = '1feHsA0gYygv6gTSn_EB1reWNCQUWlw9h'
export const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file'
export const CSV_DATA_MARKER  = '##PRESUP_DATA##'

// ─── PALETTE ─────────────────────────────────────────────────────────────────
export const C = {
  bg:'#07090f', surface:'#0f1623', surfaceHover:'#151e2e', card:'#131b2a',
  border:'#1c2a3e', borderLight:'#243650',
  text:'#dce8f5', textMuted:'#5a7a9a', textDim:'#8ca5be',
  amber:'#e8a020', amberDim:'#b47a14', amberLight:'#f5c060', amberGlow:'#e8a02033',
  green:'#22c55e', greenDim:'#16a34a', greenBg:'#0a2015',
  red:'#ef4444', redDim:'#b91c1c', redBg:'#200a0a',
  blue:'#3b82f6', purple:'#a78bfa', teal:'#2dd4bf',
  tag:'#1a2d45',
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
export const btnPrimary = {background:`linear-gradient(135deg,${C.amber},${C.amberDim})`,color:'#07090f',border:'none',borderRadius:'8px',padding:'11px 20px',fontSize:'14px',fontFamily:'monospace',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',boxShadow:`0 0 18px ${C.amberGlow}`,touchAction:'manipulation'}
export const btnAdd     = {background:`${C.amber}18`,color:C.amberLight,border:`1.5px solid ${C.amber}`,borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontFamily:'monospace',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',boxShadow:`0 0 14px ${C.amberGlow}`,touchAction:'manipulation'}
export const btnSec     = {background:'transparent',color:C.textDim,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontFamily:'monospace',letterSpacing:'1px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',touchAction:'manipulation'}
export const btnDanger  = {background:'transparent',color:C.red,border:`1px solid ${C.redDim}44`,borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer',fontFamily:'monospace',touchAction:'manipulation'}
export const inp        = {background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',WebkitAppearance:'none'}
export const sel        = {background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',cursor:'pointer',WebkitAppearance:'none'}
export const navBtn     = active => ({background:active?C.amber:'transparent',color:active?'#07090f':C.textDim,border:`1px solid ${active?C.amber:C.border}`,borderRadius:'6px',padding:'8px 12px',fontSize:'12px',cursor:'pointer',fontFamily:'monospace',fontWeight:active?700:400,letterSpacing:'0.5px',touchAction:'manipulation',flex:1})

export const STEPS = [
  {l:'INGRESOS', i:'↑'},
  {l:'TARJETAS', i:'▣'},
  {l:'ALQUILER', i:'⌂'},
  {l:'GASTOS',   i:'≡'},
  {l:'REPORTE',  i:'◈'},
]
