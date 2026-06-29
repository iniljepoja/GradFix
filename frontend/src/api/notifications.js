import { api } from './client.js';

export async function getVapidPublicKey() {
  const { data } = await api.get('/notifications/vapid-public');
  return data.data.publicKey;
}

export async function subscribePush(subscription) {
  const { data } = await api.post('/notifications/push', {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  });
  return data.data;
}

export async function unsubscribePush(endpoint) {
  const { data } = await api.delete('/notifications/push', { data: { endpoint } });
  return data.data;
}
