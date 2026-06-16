// Web Push delivery: permission, PushManager subscription records, endpoints,
// application-server keys, push service routing, service worker events, and renewals.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'web-push-subscription-delivery-case-study',
  title: 'Web Push Subscription Delivery',
  category: 'Systems',
  summary: 'How Push API subscriptions connect permission, service worker registrations, endpoint records, application-server keys, push services, push events, and notification UX.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['subscription record', 'message delivery'], defaultValue: 'subscription record' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function pushGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 4.3, note: notes.user ?? 'permission' },
      { id: 'swreg', label: 'SW reg', x: 2.3, y: 4.3, note: notes.swreg ?? 'scope' },
      { id: 'pm', label: 'PushMgr', x: 3.9, y: 4.3, note: notes.pm ?? 'subscribe' },
      { id: 'sub', label: 'sub', x: 5.6, y: 2.8, note: notes.sub ?? 'endpoint+keys' },
      { id: 'server', label: 'server', x: 5.6, y: 5.8, note: notes.server ?? 'stores sub' },
      { id: 'svc', label: 'push svc', x: 7.4, y: 4.3, note: notes.svc ?? 'vendor' },
      { id: 'sw', label: 'SW', x: 9.0, y: 3.0, note: notes.sw ?? 'push event' },
      { id: 'client', label: 'client', x: 9.0, y: 5.7, note: notes.client ?? 'notify/open' },
    ],
    edges: [
      { id: 'e-user-swreg', from: 'user', to: 'swreg', weight: '' },
      { id: 'e-swreg-pm', from: 'swreg', to: 'pm', weight: '' },
      { id: 'e-pm-sub', from: 'pm', to: 'sub', weight: '' },
      { id: 'e-sub-server', from: 'sub', to: 'server', weight: '' },
      { id: 'e-server-svc', from: 'server', to: 'svc', weight: '' },
      { id: 'e-svc-sw', from: 'svc', to: 'sw', weight: '' },
      { id: 'e-sw-client', from: 'sw', to: 'client', weight: '' },
      { id: 'e-client-server', from: 'client', to: 'server', weight: '' },
    ],
  }, { title });
}

function* subscriptionRecord() {
  yield {
    state: pushGraph('Push starts with permission and a service worker registration'),
    highlight: { active: ['user', 'swreg', 'e-user-swreg'], compare: ['server'] },
    explanation: 'A web app cannot treat push as a hidden socket. It needs user permission and a service worker registration because delivery happens while pages may be closed.',
    invariant: 'The subscription belongs to a service worker registration, not to one visible tab.',
  };

  yield {
    state: pushGraph('PushManager creates a subscription endpoint and keys', { pm: 'subscribe()', sub: 'endpoint' }),
    highlight: { active: ['swreg', 'pm', 'sub', 'e-swreg-pm', 'e-pm-sub'], found: ['user'] },
    explanation: 'PushManager.subscribe asks the browser push service for a subscription. The result contains an endpoint URL and cryptographic material the application server must store.',
  };

  yield {
    state: labelMatrix(
      'Sub record',
      [
        { id: 'endpoint', label: 'endpoint' },
        { id: 'p256dh', label: 'p256dh' },
        { id: 'auth', label: 'auth' },
        { id: 'vapid', label: 'VAPID' },
        { id: 'scope', label: 'scope' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['route URL', 'stale'],
        ['encrypt', 'missing'],
        ['secret', 'leak'],
        ['server id', 'rotate'],
        ['SW owner', 'mismatch'],
      ],
    ),
    highlight: { active: ['endpoint:role', 'p256dh:role', 'auth:role'], compare: ['vapid:risk'] },
    explanation: 'The subscription is a database row. The endpoint is the route to the push service. Keys support encrypted payload delivery. Server identity and scope metadata help manage renewals and revocation.',
  };

  yield {
    state: pushGraph('The application server stores the subscription for later sends', { server: 'user->sub', sub: 'JSON' }),
    highlight: { active: ['sub', 'server', 'e-sub-server'], compare: ['svc'] },
    explanation: 'The browser returns the subscription to the page, and the page uploads it to the application server. From then on, sending a push is server-side work using the stored endpoint and keys.',
  };

  yield {
    state: labelMatrix(
      'Sub lifecycle',
      [
        { id: 'grant', label: 'grant' },
        { id: 'rotate', label: 'rotate' },
        { id: 'deny', label: 'deny' },
        { id: 'expire', label: 'expire' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['active', 'send ok'],
        ['changed', 'upsert'],
        ['blocked', 'stop ask'],
        ['gone', 'delete'],
      ],
    ),
    highlight: { active: ['grant:action', 'rotate:action'], removed: ['deny:state'], compare: ['expire:action'] },
    explanation: 'Subscriptions are not permanent identity. Users can revoke permission, browsers can rotate or expire subscriptions, and servers should delete endpoints that start returning gone-like failures.',
  };
}

function* messageDelivery() {
  yield {
    state: pushGraph('The server sends an encrypted push through the push service', { server: 'send', svc: 'queue', sw: 'inactive' }),
    highlight: { active: ['server', 'svc', 'e-server-svc'], compare: ['client'] },
    explanation: 'When the application has a reason to notify, the server posts to the subscription endpoint. The push service handles vendor-specific delivery to the browser.',
    invariant: 'Push is an inbound wakeup, not a guaranteed large-message transport.',
  };

  yield {
    state: pushGraph('The browser wakes the service worker with a push event', { svc: 'deliver', sw: 'event', client: 'maybe closed' }),
    highlight: { active: ['svc', 'sw', 'e-svc-sw'], compare: ['client'] },
    explanation: 'The browser can start the service worker to handle the push event even when no page is open. The handler should do bounded work and keep promises inside waitUntil.',
  };

  yield {
    state: labelMatrix(
      'Push payload',
      [
        { id: 'badge', label: 'badge' },
        { id: 'title', label: 'title' },
        { id: 'url', label: 'URL' },
        { id: 'sync', label: 'sync id' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'avoid', label: 'avoid' },
      ],
      [
        ['small', 'secret'],
        ['small', 'PII'],
        ['open app', 'token'],
        ['fetch more', 'bulk data'],
      ],
    ),
    highlight: { found: ['sync:fit', 'url:fit'], removed: ['title:avoid', 'badge:avoid'] },
    explanation: 'Push payloads should be small and privacy-aware. Often the push contains just enough information to wake the app, show a notification, and fetch fresh state through authenticated APIs.',
  };

  yield {
    state: pushGraph('The service worker shows a notification or wakes clients', { sw: 'show notif', client: 'focus/open', server: 'fresh data' }),
    highlight: { active: ['sw', 'client', 'server', 'e-sw-client', 'e-client-server'], found: ['svc'] },
    explanation: 'The push event can call showNotification, update badges, or message open clients. A notification click can focus an existing client or open a route that fetches the authoritative record.',
  };

  yield {
    state: labelMatrix(
      'Delivery cases',
      [
        { id: 'chat', label: 'chat' },
        { id: 'alert', label: 'alert' },
        { id: 'news', label: 'news' },
        { id: 'sync', label: 'sync' },
      ],
      [
        { id: 'message', label: 'message' },
        { id: 'control', label: 'control' },
      ],
      [
        ['new msg', 'thread url'],
        ['critical', 'quiet hrs'],
        ['headline', 'user prefs'],
        ['wake app', 'fetch diff'],
      ],
    ),
    highlight: { active: ['chat:control', 'alert:control'], compare: ['news:control'], found: ['sync:message'] },
    explanation: 'A complete push design stores user preferences, quiet hours, endpoint health, topic routing, and notification-click behavior. The data structure is subscription records plus delivery policy, not just one call to subscribe.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'subscription record') yield* subscriptionRecord();
  else if (view === 'message delivery') yield* messageDelivery();
  else throw new InputError('Pick a Web Push view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Push API lets an application server send a message to a web application through a browser push service, even when the web app is inactive. In practice, the data structure is a subscription registry: endpoint URL, encryption keys, application-server identity, service-worker scope, user preference, and endpoint health.',
        'The W3C Push API says push enables sending a push message to a web application via a push service: https://www.w3.org/TR/push-api/. MDN Push API documents the service-worker additions and PushManager entry point: https://developer.mozilla.org/en-US/docs/Web/API/Push_API.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser asks the user for notification permission, the service worker registration exposes pushManager, and PushManager.subscribe creates a PushSubscription. The subscription includes an endpoint and keys. The page sends that subscription object to the application server. Later, the server posts to the endpoint and the browser wakes the service worker with a push event.',
        'MDN PushManager.subscribe documents that subscribe returns a PushSubscription and creates a new push subscription if the current service worker does not already have one: https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe. MDN PushManager explains that PushManager is accessed from ServiceWorkerRegistration.pushManager: https://developer.mozilla.org/en-US/docs/Web/API/PushManager.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a collaborative task app. The user opts into notifications. The app registers its service worker, subscribes with PushManager, and uploads the endpoint plus keys to the server. When a teammate assigns a task, the server looks up the user subscription, sends a push, the browser wakes the service worker, and the worker displays a notification with a task route. On click, the app opens /tasks/123 and fetches authoritative state.',
        'If the endpoint expires, the server deletes it after failed sends. If permission is denied, the app stops prompting. If the subscription rotates, the app upserts the new endpoint. This is the inbound counterpart to Background Sync Outbox Queue: sync sends pending local work out; push wakes the app when remote work arrives.',
      ],
    },
    {
      heading: 'Costs and pitfalls',
      paragraphs: [
        'Push is not a replacement for durable state, real-time collaboration, or large payload transport. Payloads should be small and privacy-aware; the app can fetch fresh data after wakeup. Notification fatigue is a product failure mode, so topic preferences, quiet hours, permission respect, and unsubscribe flows are part of the data model.',
        'The common engineering mistake is storing only the endpoint string. Production systems also need user id, scope, keys, app-server key version, created/updated timestamps, last success, failure count, topic preferences, and permission or unsubscribe state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Push API at https://www.w3.org/TR/push-api/, MDN Push API at https://developer.mozilla.org/en-US/docs/Web/API/Push_API, MDN PushManager at https://developer.mozilla.org/en-US/docs/Web/API/PushManager, MDN PushManager.subscribe at https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe, MDN Service Worker API at https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API, and web.dev Push subscription guide at https://web.dev/articles/push-notifications-subscribing-a-user.',
        'Study next: Service Workers & Offline-First, Background Sync Outbox Queue, Browser Message Channels & Broadcast Coordination, IndexedDB Object Store Case Study, Cache Storage Versioned Precache, Web Locks API Lock Manager, Model Context Protocol Case Study, Capability Security & Attenuation, and OAuth PKCE Token Lifecycle Case Study.',
      ],
    },
  ],
};
