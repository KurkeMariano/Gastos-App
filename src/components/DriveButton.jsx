import { C } from '../constants'

export default function DriveButton({ drive }) {
  const { status, syncStatus, syncCount, connect, disconnect, isConfigured } = drive
  const syncing = syncStatus === 'syncing'

  if (!isConfigured) return (
    <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'5px 10px',background:`${C.amber}11`,border:`1px dashed ${C.amber}55`,borderRadius:'8px',fontSize:'11px',fontFamily:'monospace',color:C.amberLight}}>
      ⚠ Falta VITE_GOOGLE_CLIENT_ID
    </div>
  )

  if (status === 'connected') return (
    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
      {syncing && (
        <div style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',fontFamily:'monospace',color:C.textMuted}}>
          <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal,animation:'pulse 1s infinite'}}/>
          Sincronizando…
        </div>
      )}
      {syncStatus === 'done' && syncCount > 0 && (
        <div style={{fontSize:'11px',fontFamily:'monospace',color:C.teal}}>
          ✓ {syncCount} mes{syncCount !== 1 ? 'es' : ''} de Drive
        </div>
      )}
      <button onClick={disconnect} style={{background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}55`,borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer'}}>
        ✓ Drive
      </button>
    </div>
  )

  if (status === 'loading') return (
    <div style={{padding:'5px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:C.textMuted}}>
      Conectando…
    </div>
  )

  return (
    <button onClick={connect} style={{background:`${C.blue}18`,color:'#93c5fd',border:`1px solid ${C.blue}55`,borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px'}}>
      ↑ Conectar Drive
    </button>
  )
}
