import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const regRef = useRef(null)

  // Register SW and check existing subscription
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.register('/sw.js').then(async reg => {
      regRef.current = reg
      const sub = await reg.pushManager.getSubscription()
      if (sub) setSubscribed(true)
    }).catch(console.error)
  }, [userId])

  async function enable() {
    if (!userId || !VAPID_PUBLIC_KEY || !('Notification' in window)) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') { setLoading(false); return }

      const reg = regRef.current || await navigator.serviceWorker.register('/sw.js')
      regRef.current = reg

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: 'endpoint' })

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscription error:', err)
    }
    setLoading(false)
  }

  async function disable() {
    if (!regRef.current) return
    setLoading(true)
    try {
      const sub = await regRef.current.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Unsubscribe error:', err)
    }
    setLoading(false)
  }

  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window

  return { supported, permission, subscribed, loading, enable, disable }
}
