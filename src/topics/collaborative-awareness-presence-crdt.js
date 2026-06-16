// Collaborative awareness and presence: ephemeral CRDT state for cursors,
// names, colors, selections, and online/offline status.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'collaborative-awareness-presence-crdt',
  title: 'Collaborative Awareness & Presence CRDT',
  category: 'Systems',
  summary: 'How collaborative apps sync ephemeral user state: client-id maps, clocks, cursor ranges, heartbeats, timeouts, and provider broadcasts.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['awareness map', 'cursor lifecycle'], defaultValue: 'awareness map' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function awarenessGraph(title) {
  return graphState({
    nodes: [
      { id: 'local', label: 'local', x: 0.8, y: 4.1, note: 'client 7' },
      { id: 'state', label: 'state', x: 2.3, y: 4.1, note: 'JSON' },
      { id: 'clock', label: 'clock', x: 3.7, y: 4.9, note: '+1' },
      { id: 'map', label: 'map', x: 5.2, y: 4.1, note: 'client -> state' },
      { id: 'encode', label: 'encode', x: 6.7, y: 4.9, note: 'update' },
      { id: 'provider', label: 'provider', x: 7.8, y: 4.1, note: 'broadcast' },
      { id: 'remote', label: 'peer', x: 9.5, y: 4.1, note: 'apply' },
      { id: 'ttl', label: 'ttl', x: 6.7, y: 3.3, note: 'timeout' },
    ],
    edges: [
      { id: 'e-local-state', from: 'local', to: 'state' },
      { id: 'e-state-clock', from: 'state', to: 'clock' },
      { id: 'e-clock-map', from: 'clock', to: 'map' },
      { id: 'e-map-encode', from: 'map', to: 'encode' },
      { id: 'e-encode-provider', from: 'encode', to: 'provider' },
      { id: 'e-provider-remote', from: 'provider', to: 'remote' },
      { id: 'e-provider-ttl', from: 'provider', to: 'ttl' },
      { id: 'e-ttl-map', from: 'ttl', to: 'map' },
    ],
  }, { title });
}

function cursorGraph(title) {
  return graphState({
    nodes: [
      { id: 'editor', label: 'editor', x: 0.7, y: 4.1, note: 'selection' },
      { id: 'relative', label: 'rel pos', x: 2.3, y: 4.1, note: 'stable anchor' },
      { id: 'awareness', label: 'awareness', x: 4.0, y: 4.1, note: 'ephemeral' },
      { id: 'network', label: 'network', x: 5.6, y: 4.8, note: 'send' },
      { id: 'peer', label: 'peer', x: 7.1, y: 4.1, note: 'receive' },
      { id: 'render', label: 'render', x: 8.6, y: 4.8, note: 'cursor' },
      { id: 'offline', label: 'offline', x: 8.6, y: 3.3, note: 'fade out' },
      { id: 'doc', label: 'doc CRDT', x: 5.6, y: 3.3, note: 'not stored' },
    ],
    edges: [
      { id: 'e-editor-relative', from: 'editor', to: 'relative' },
      { id: 'e-relative-awareness', from: 'relative', to: 'awareness' },
      { id: 'e-awareness-network', from: 'awareness', to: 'network' },
      { id: 'e-network-peer', from: 'network', to: 'peer' },
      { id: 'e-peer-render', from: 'peer', to: 'render' },
      { id: 'e-peer-offline', from: 'peer', to: 'offline' },
      { id: 'e-awareness-doc', from: 'awareness', to: 'doc' },
    ],
  }, { title });
}

function* awarenessMap() {
  yield {
    state: awarenessGraph('Awareness is a per-client state map'),
    highlight: { active: ['local', 'state', 'map', 'e-local-state', 'e-clock-map'], compare: ['remote'] },
    explanation: 'Document content belongs in the CRDT document. Presence belongs in an awareness map keyed by client id. Each client owns its own ephemeral state: name, color, cursor, focus, or selection.',
  };

  yield {
    state: awarenessGraph('Each local change increments a clock'),
    highlight: { active: ['state', 'clock', 'map', 'e-state-clock', 'e-clock-map'], compare: ['ttl'] },
    explanation: 'The clock lets receivers decide whether an awareness update is newer than what they already know for that client. This is a last-writer-wins register per client, not persistent document history.',
    invariant: 'Awareness state should be replaceable; document content should be durable.',
  };

  yield {
    state: awarenessGraph('Providers broadcast encoded awareness updates'),
    highlight: { active: ['map', 'encode', 'provider', 'remote', 'e-map-encode', 'e-encode-provider', 'e-provider-remote'], found: ['ttl'] },
    explanation: 'The provider encodes changed client states and broadcasts them. A new peer can receive the current awareness map; later updates can carry only the changed client ids.',
  };

  yield {
    state: awarenessGraph('Timeouts remove stale presence'),
    highlight: { active: ['provider', 'ttl', 'map', 'e-provider-ttl', 'e-ttl-map'], removed: ['remote'] },
    explanation: 'Presence needs liveness. If a client stops refreshing its awareness state, peers should mark it offline after a timeout. A clean disconnect can send a null state immediately.',
  };

  yield {
    state: labelMatrix(
      'Awareness state fields',
      [
        { id: 'user', label: 'user' },
        { id: 'cursor', label: 'cursor' },
        { id: 'selection', label: 'selection' },
        { id: 'focus', label: 'focus' },
        { id: 'clock', label: 'clock' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['name/color/avatar', 'small public JSON'],
        ['relative position', 'convert at render'],
        ['range anchors', 'do not persist'],
        ['active panel', 'safe to lose'],
        ['monotone number', 'newer wins'],
      ],
    ),
    highlight: { active: ['cursor:stores', 'clock:rule', 'focus:rule'], compare: ['user:rule'] },
    explanation: 'Awareness is intentionally small and lossy. It makes collaboration feel live without polluting the durable document history with every cursor twitch.',
  };
}

function* cursorLifecycle() {
  yield {
    state: cursorGraph('Cursor coordinates must survive document edits'),
    highlight: { active: ['editor', 'relative', 'awareness', 'e-editor-relative', 'e-relative-awareness'], compare: ['doc'] },
    explanation: 'A raw character offset is fragile while everyone types. Collaborative editors usually encode cursor positions relative to stable CRDT positions or document anchors so the cursor can be resolved after remote edits.',
  };

  yield {
    state: cursorGraph('Awareness updates travel beside document updates'),
    highlight: { active: ['awareness', 'network', 'peer', 'e-awareness-network', 'e-network-peer'], compare: ['doc'] },
    explanation: 'Presence is sent through the collaboration provider but is not the same as document sync. It can be dropped, throttled, or expired without damaging the actual document.',
  };

  yield {
    state: cursorGraph('Remote cursors render from current local state'),
    highlight: { active: ['peer', 'render', 'e-peer-render'], found: ['relative'] },
    explanation: 'The receiver resolves the remote relative position against its current document and renders a cursor, selection highlight, name tag, or avatar. Rendering should degrade gracefully when the anchor is gone.',
  };

  yield {
    state: cursorGraph('Disconnects fade out rather than conflict'),
    highlight: { active: ['peer', 'offline', 'e-peer-offline'], removed: ['render'], compare: ['doc'] },
    explanation: 'If a collaborator closes the tab, changes network, or stops heartbeating, the presence record should disappear. That is not a conflict in the document; it is an ephemeral liveness transition.',
  };

  yield {
    state: labelMatrix(
      'Presence versus content',
      [
        { id: 'text', label: 'document text' },
        { id: 'marks', label: 'format marks' },
        { id: 'cursor', label: 'cursor' },
        { id: 'typing', label: 'typing flag' },
      ],
      [
        { id: 'layer', label: 'layer' },
        { id: 'retention', label: 'retention' },
      ],
      [
        ['sequence CRDT', 'durable'],
        ['rich-text CRDT', 'durable'],
        ['awareness map', 'expires'],
        ['awareness map', 'expires fast'],
      ],
    ),
    highlight: { active: ['cursor:layer', 'typing:retention'], compare: ['text:retention', 'marks:retention'] },
    explanation: 'The product distinction is crisp: content is durable, presence is temporary. Mixing the two creates noisy histories and bad privacy defaults.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'awareness map') yield* awarenessMap();
  else if (view === 'cursor lifecycle') yield* cursorLifecycle();
  else throw new InputError('Pick a collaborative awareness view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Collaborative awareness is the ephemeral state that makes a shared editor feel alive: who is online, where their cursor is, what they selected, which color/name/avatar represents them, whether they are typing, and which viewport they are focused on. It is not document content. It should be safe to lose, expire, throttle, and replace.',
        'Yjs documents awareness as an optional feature defined in y-protocols and usually implemented by providers. Its awareness protocol is a network-agnostic CRDT for user status and information such as cursor location, username, or email address: https://docs.yjs.dev/api/about-awareness.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The core data structure is a map from client id to awareness state. Each state is a schemaless JSON object with an increasing clock. When a client updates its local state, it increments the clock and broadcasts the changed state. When another peer receives an update, it overwrites that client entry only if the incoming clock is newer. A null state marks the client offline.',
        'Yjs also specifies timeout behavior: if a peer does not receive updates from a remote client for a period, it marks that client offline, and clients should refresh their own awareness state regularly. The protocol provides encoding and application functions for awareness updates, and providers broadcast those updates similarly to document updates: https://docs.yjs.dev/api/about-awareness.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The awareness layer uses a client-id map, per-client logical clock, JSON state record, heartbeat timer, timeout heap or timer wheel, provider broadcast queue, and rendering cache. Cursor fields should use stable positions when possible, such as relative positions anchored to CRDT elements, because raw offsets drift under concurrent edits.',
        'This separation protects the durable document. A collaborator moving a mouse over a paragraph should not create a permanent CRDT change. Awareness is a last-writer-wins presence map with expiration. Sequence CRDTs and Peritext Rich-Text CRDT Case Study handle durable text and formatting; Collaborative Awareness handles the temporary social layer around them.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A local-first note app has a CRDT text document and an awareness provider. Alice sets her local state to user name, color, and cursor relative position. The provider broadcasts that update to Bob. Bob stores Alice under her client id, resolves the cursor position against his current document, and renders a colored caret. Alice types, the content sync engine sends document updates, and awareness sends cursor moves beside them. If Alice closes her laptop, peers eventually remove her state after timeout.',
        'The important product detail is that presence should degrade gracefully. If a cursor anchor was deleted, render nothing or move to a safe nearby anchor. If the network drops, fade remote users rather than blocking edits. If a user is unauthorized for the document, never send their awareness state to that room.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first mistake is storing awareness in the document log. That creates noisy history, privacy risk, and unnecessary sync load. The second mistake is sending raw cursor offsets that break under concurrent inserts and deletes. The third mistake is treating awareness as authoritative. A green dot means a recent heartbeat, not a guarantee that the user sees the same pixels.',
        'Presence also has abuse and privacy concerns. User names, emails, exact cursor locations, and active panels may reveal sensitive behavior. Scope awareness to authorized rooms, keep payloads small, expire aggressively, and do not retain it longer than the product needs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Yjs Awareness docs at https://docs.yjs.dev/api/about-awareness, Yjs Awareness & Presence guide at https://docs.yjs.dev/getting-started/adding-awareness, and y-protocols repository at https://github.com/yjs/y-protocols. Study Local-First Sync Engine Case Study, Yjs Struct Store & Updates, Sequence CRDTs for Collaborative Text, Peritext Rich-Text CRDT Case Study, Collaborative Undo/Redo Intention Stack, Logical Clocks, and Service Workers next.',
      ],
    },
  ],
};
