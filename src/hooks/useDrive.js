import { useState, useRef, useCallback, useEffect } from 'react'
import { GOOGLE_CLIENT_ID, DRIVE_FOLDER_ID, DRIVE_SCOPE } from '../constants'
import { parseReportFromCSV } from '../utils'

export function useDrive(onHistoryLoaded) {
  const [token,      setToken]      = useState(null)
  const [status,     setStatus]     = useState('idle')    // idle|loading|connected|error
  const [syncStatus, setSyncStatus] = useState('idle')    // idle|syncing|done|error
  const [syncCount,  setSyncCount]  = useState(0)
  const tokenClientRef = useRef(null)

  const driveGet = useCallback(async (url, tk) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err?.error?.code === 401) { setToken(null); setStatus('idle') }
      throw new Error(err?.error?.message || `HTTP ${res.status}`)
    }
    return res
  }, [])

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

  const downloadFile = useCallback(async (fileId, tk) => {
    const res = await driveGet(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      tk
    )
    return res.text()
  }, [driveGet])

  const syncHistory = useCallback(async (tk) => {
    setSyncStatus('syncing')
    try {
      const files = await listReportFiles(tk)
      if (!files.length) { setSyncStatus('done'); setSyncCount(0); return }

      const reports = []
      await Promise.all(files.map(async f => {
        try {
          const text   = await downloadFile(f.id, tk)
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

  const initTokenClient = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) return
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) { setStatus('error'); return }
        setToken(resp.access_token)
        setStatus('connected')
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

  const connect = () => {
    if (!tokenClientRef.current) return
    setStatus('loading')
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
  }

  const disconnect = () => {
    if (token && window.google?.accounts?.oauth2)
      window.google.accounts.oauth2.revoke(token, () => {})
    setToken(null)
    setStatus('idle')
    setSyncStatus('idle')
  }

  const uploadCSV = useCallback(async (filename, content, existingFileId) => {
    if (!token) throw new Error('not_connected')
    const blob = new Blob(['\ufeff'+content], { type: 'text/csv' })

    if (existingFileId) {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/csv' }, body: blob }
      )
      if (!res.ok) throw new Error(`Update failed: ${res.status}`)
      return { id: existingFileId }
    } else {
      const metadata = { name: filename, parents: [DRIVE_FOLDER_ID], mimeType: 'text/csv' }
      const body = new FormData()
      body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      body.append('file', blob)
      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body }
      )
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        if (e?.error?.code === 401) { setToken(null); setStatus('idle') }
        throw new Error(e?.error?.message || 'upload_failed')
      }
      return res.json()
    }
  }, [token])

  const deleteFile = async (fileId) => {
    if (!token) throw new Error('not_connected')
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.status !== 204 && res.status !== 404 && !res.ok) {
      const err = await res.json().catch(() => ({}))
      if (err?.error?.code === 401) { setToken(null); setStatus('idle') }
      throw new Error(err?.error?.message || `HTTP ${res.status}`)
    }
  }

  return { token, status, syncStatus, syncCount, connect, disconnect, uploadCSV, deleteFile, isConfigured: !!GOOGLE_CLIENT_ID }
}
