import { useCallback, useEffect, useState } from 'react';
import * as notificationsApi from '../api/notifications.js';

// Manages a Web Push subscription for the logged-in user. Returns the current permission
// state plus a toggle that asks permission, subscribes via the service worker, and persists
// the subscription to the backend. Best-effort: failures surface in `error`.
export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');
  const [activeSubscription, setActiveSubscription] = useState(null);

  const subscribe = useCallback(async () => {
    setError('');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not supported in this browser.');
      return;
    }
    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const publicKey = await notificationsApi.getVapidPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await notificationsApi.subscribePush(sub);
      setActiveSubscription(sub);
    } catch (err) {
      setError(err.message || 'Could not enable push notifications.');
    } finally {
      setSubscribing(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError('');
    setSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await notificationsApi.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setActiveSubscription(null);
    } catch (err) {
      setError(err.message || 'Could not disable push notifications.');
    } finally {
      setSubscribing(false);
    }
  }, []);

  // On mount, check if a subscription already exists (e.g. user enabled push in a previous session).
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let active = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (active && sub) setActiveSubscription(sub);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, []);

  // Keep the displayed permission in sync if it changes elsewhere.
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const update = () => setPermission(Notification.permission);
    update();
  }, []);

  return { permission, subscribing, error, subscribe, unsubscribe, activeSubscription };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}
