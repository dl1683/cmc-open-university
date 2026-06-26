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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a subscription record being assembled. Active fields are not decoration: endpoint, keys, service-worker scope, app-server identity, preference, and health all decide whether a later send is legal and useful. Found fields are durable enough for the server to store and repair.',
        'Read the delivery view as a bounded wakeup path. The server sends to a browser push service, the browser wakes the service worker, and the worker fetches or displays current state. The safe inference is that push starts work; it is not the authoritative business transaction.',
        {type:'callout', text:'Web Push is a durable subscription registry plus a bounded wakeup path, not a hidden socket or permanent user identity.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A web page cannot keep an ordinary socket open after every tab is closed. A user may still need a direct message, calendar change, alert, task assignment, or sync hint. Web Push gives the application server a way to wake the web app through browser-managed infrastructure.',
        'The Push API is not just subscribe once and forget. A useful system stores endpoint URL, encryption keys, service-worker scope, application-server key, user preference, quiet-hour policy, and delivery health. The subscription is a route plus policy, not a permanent identity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is polling. When the page is open, ask the server every few seconds whether anything changed. Polling is simple, debuggable, and good enough for active pages with loose latency needs.',
        'Another approach is a WebSocket. That works while a page is alive and the network allows it. It does not solve the closed-tab problem, and it can waste battery if used only to wait for rare inbound events.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is background delivery. Once every tab is closed, page JavaScript stops running. Polling stops, and an ordinary page-owned connection disappears. Mobile operating systems also protect battery by limiting uncontrolled background work.',
        'A second wall is user trust. A technically delivered notification can still be wrong if the user did not want that topic, if quiet hours apply, or if permission was revoked. Delivery policy belongs in the subscription registry, not in a last-minute send call.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core data structure is a subscription record owned by a service worker registration. The endpoint routes to a browser push service. The p256dh and auth keys support encrypted payload delivery. The service-worker scope tells the browser which worker receives the push event.',
        'Correct use treats push as a hint to fetch fresh state. The payload should be small, private, and safe to delay or drop. The server remains the source of truth for messages, tasks, orders, and account state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page asks for notification permission, registers a service worker, and calls pushManager.subscribe on the service-worker registration. The browser returns a PushSubscription containing an endpoint and keys. The page sends that object to the application server, which upserts it into the subscription registry.',
        'Later, the server selects a subscription, checks policy, encrypts a payload, and posts to the endpoint. The browser push service routes the message to the device. The browser wakes the service worker with a push event, and the worker can show a notification, update a badge, message open clients, or fetch current data.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The mechanism works because the long-lived delivery channel belongs to the browser and push service, not to a page tab. The web app stores a route and keys. The service worker supplies a bounded background execution point.',
        'Correctness depends on separating signal from state. If the push says task 123 changed, the app should fetch task 123 before showing durable UI or mutating local state. That rule makes delayed, duplicated, or expired pushes less dangerous.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Push costs state management. Suppose 1,000,000 users opt in and 8 percent of endpoints expire each month. The server must prune about 80,000 stale routes monthly, handle rotated subscriptions, and avoid retrying gone endpoints forever.',
        'Push also costs trust. A user who receives 6 low-value notifications in a day may revoke permission for all future high-value alerts. Topic preferences, quiet hours, unsubscribe controls, and send-rate limits are part of the delivery algorithm because they preserve the channel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web Push fits rare inbound signals where the page may be closed: chat messages, critical alerts, task assignments, calendar reminders, delivery updates, and sync hints. The access pattern is small server signal, service-worker wakeup, user-visible notification or foreground fetch.',
        'It pairs well with local app shells and IndexedDB state. The notification opens a route, the service worker or foreground page fetches current data, and the UI reconciles local cache with server truth. Push should wake the app, not replace the data model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Push is the wrong tool for large payloads, real-time collaboration streams, durable state transfer, or background computation. Active pages can use WebSocket, Server-Sent Events, polling, or ordinary fetch. Outgoing offline work belongs in Background Sync-style outbox logic.',
        'It also fails when a subscription is treated as identity. Users can revoke permission, browsers can rotate or expire endpoints, and push services can reject stale routes. The registry must age, repair, and delete records.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A task app has 250,000 subscribed users. At 9:00, a teammate assigns task 123 to Alex. The server checks that Alex allows assignment alerts, sees no quiet-hour block, sends a 900 byte encrypted push, and records the send attempt.',
        'The service worker wakes, displays Task assigned, and opens /tasks/123 when clicked. The app then fetches the current task before rendering. If the push service returns 410 Gone, the server deletes that endpoint and waits for the browser to create a fresh subscription during the next foreground session.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Push API at https://www.w3.org/TR/push-api/, MDN Push API at https://developer.mozilla.org/en-US/docs/Web/API/Push_API, MDN PushManager at https://developer.mozilla.org/en-US/docs/Web/API/PushManager, and MDN PushManager.subscribe at https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe.',
        'Study next by role: Service Worker API for the background event model, Background Sync Outbox Queue for outbound offline writes, Browser Message Channels for notifying open tabs, IndexedDB Object Store for local state, and Capability Security for permission design.',
      ],
    },
  ],
};
