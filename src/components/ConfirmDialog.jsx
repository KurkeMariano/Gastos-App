import { monthLabel } from '../utils'

export default function ConfirmDialog({ report, deleting, onConfirm, onCancel }) {
  if (!report) return null
  const hasDrive = !!report._driveFileId
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(7,9,15,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:'1rem'}}>
      <div style={{background:'#131b2a',border:'1px solid #b91c1c',borderRadius:'14px',padding:'1.75rem',maxWidth:'360px',width:'100%',boxShadow:'0 0 40px rgba(239,68,68,0.15)'}}>
        <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:'#ef4444',marginBottom:'1rem'}}>// CONFIRMAR ELIMINACIÓN</div>
        <div style={{fontFamily:'monospace',fontSize:'16px',fontWeight:600,color:'#dce8f5',marginBottom:'0.5rem'}}>
          {monthLabel(report.month)}
        </div>
        <div style={{fontSize:'13px',color:'#8ca5be',fontFamily:'monospace',lineHeight:1.6,marginBottom:'1.5rem'}}>
          {hasDrive
            ? 'Esto eliminará el registro del historial local y del archivo en Google Drive. No se puede deshacer.'
            : 'Esto eliminará el registro del historial local. No se puede deshacer.'}
        </div>
        {hasDrive && (
          <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',marginBottom:'1.25rem',fontSize:'12px',fontFamily:'monospace',color:'#f87171'}}>
            <span>✕</span> También se eliminará el archivo de Drive
          </div>
        )}
        <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{background:'transparent',color:'#8ca5be',border:'1px solid #1c2a3e',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontFamily:'monospace',cursor:'pointer',opacity:deleting?0.5:1}}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{background:'#b91c1c',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontFamily:'monospace',fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',opacity:deleting?0.7:1}}
          >
            {deleting ? 'Eliminando…' : '✕ Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
