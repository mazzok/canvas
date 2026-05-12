import { useEffect, useRef, useCallback } from 'react'
import type { WsMessage } from '../types'

export function useWebSocket(
  sessionId: string,
  onMessage: (msg: WsMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const queueRef = useRef<WsMessage[]>([])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const url = `${protocol}://${window.location.host}${base}/ws/${sessionId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] connected, flushing', queueRef.current.length, 'queued msgs')
      queueRef.current.forEach(msg => ws.send(JSON.stringify(msg)))
      queueRef.current = []
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        console.log('[WS] received:', msg.type, msg.payload)
        onMessageRef.current(msg)
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null
    }

    return () => {
      queueRef.current = []   // discard queued msgs from this mount cycle
      wsRef.current = null
      ws.close()
    }
  }, [sessionId])

  const send = useCallback((msg: WsMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    } else {
      // Socket not yet open — buffer until onopen fires
      queueRef.current.push(msg)
    }
  }, [])

  return { send }
}
