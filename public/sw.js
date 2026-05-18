// Tilim — Service Worker para Push Notifications

self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Tilim', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tilim', {
      body: data.body || '',
      icon: '/tilim-icon.png',
      badge: '/tilim-badge.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'tilim',
      renotify: true,
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(targetUrl)
    })
  )
})
