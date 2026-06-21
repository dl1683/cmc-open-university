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
  const awarenessNodes = 8;
  const awarenessEdges = 8;
  const stateFields = 5;

  yield {
    state: awarenessGraph('Awareness is a per-client state map'),
    highlight: { active: ['local', 'state', 'map', 'e-local-state', 'e-clock-map'], compare: ['remote'] },
    explanation: `The first split is content versus presence. Across ${awarenessNodes} stages in the awareness pipeline, durable document data belongs in the CRDT document; live user state belongs in an awareness map keyed by client id. Each client owns only its own ephemeral record.`,
  };

  yield {
    state: awarenessGraph('Each local change increments a clock'),
    highlight: { active: ['state', 'clock', 'map', 'e-state-clock', 'e-clock-map'], compare: ['ttl'] },
    explanation: `The clock is only per-client freshness. Receivers keep the newer awareness record for that client and discard older ones across ${awarenessEdges} edges. This is a lossy last-writer-wins register, not a history of every cursor move.`,
    invariant: `Awareness state should be replaceable across all ${stateFields} fields; document content should be durable.`,
  };

  yield {
    state: awarenessGraph('Providers broadcast encoded awareness updates'),
    highlight: { active: ['map', 'encode', 'provider', 'remote', 'e-map-encode', 'e-encode-provider', 'e-provider-remote'], found: ['ttl'] },
    explanation: `Providers broadcast changed client records through ${awarenessNodes} pipeline nodes, not durable edits. A joining peer can receive the current map; later messages can carry only changed client ids. Dropping one cursor update should not damage document state.`,
  };

  yield {
    state: awarenessGraph('Timeouts remove stale presence'),
    highlight: { active: ['provider', 'ttl', 'map', 'e-provider-ttl', 'e-ttl-map'], removed: ['remote'] },
    explanation: `Presence needs expiry because tabs crash and networks vanish. If heartbeats stop across the ${awarenessEdges}-edge flow, peers mark the record offline after a timeout. A clean disconnect can speed that up by sending null state.`,
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
    explanation: `Awareness should stay small across ${stateFields} fields, public to the room, and safe to lose. It makes collaboration feel live without filling the durable document log with cursor twitches and typing flags.`,
  };
}

function* cursorLifecycle() {
  const cursorNodes = 8;
  const cursorEdges = 7;
  const contentTypes = 4;

  yield {
    state: cursorGraph('Cursor coordinates must survive document edits'),
    highlight: { active: ['editor', 'relative', 'awareness', 'e-editor-relative', 'e-relative-awareness'], compare: ['doc'] },
    explanation: `Raw offsets drift while everyone types. Across ${cursorNodes} lifecycle stages, cursor state should use relative positions or anchors tied to stable CRDT structure, then resolve against the receiver's current document at render time.`,
  };

  yield {
    state: cursorGraph('Awareness updates travel beside document updates'),
    highlight: { active: ['awareness', 'network', 'peer', 'e-awareness-network', 'e-network-peer'], compare: ['doc'] },
    explanation: `Awareness travels beside document sync through ${cursorEdges} edges, not inside it. The provider may throttle, drop, or expire presence updates because the document truth is stored in the CRDT update path.`,
  };

  yield {
    state: cursorGraph('Remote cursors render from current local state'),
    highlight: { active: ['peer', 'render', 'e-peer-render'], found: ['relative'] },
    explanation: `The receiver resolves the remote relative position against its current document across ${cursorNodes} pipeline stages and renders a cursor, selection highlight, name tag, or avatar. Rendering should degrade gracefully when the anchor is gone.`,
  };

  yield {
    state: cursorGraph('Disconnects fade out rather than conflict'),
    highlight: { active: ['peer', 'offline', 'e-peer-offline'], removed: ['render'], compare: ['doc'] },
    explanation: `If a collaborator closes the tab, changes network, or stops heartbeating, the presence record should disappear across the ${cursorEdges}-edge lifecycle. That is not a conflict in the document; it is an ephemeral liveness transition.`,
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
    explanation: `The table draws the retention boundary across ${contentTypes} content types. Text and marks are durable collaboration data. Cursors and typing flags expire quickly. Mixing them creates noisy history, larger sync, and worse privacy defaults.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/collaborative-awareness-presence-crdt.gif', alt: 'Animated walkthrough of the collaborative awareness presence crdt visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Collaborative awareness exists because users need to understand where other people are without turning every sign of life into permanent document history. In a shared editor, the text is only part of the experience. Users also care who is online, where their cursors are, what ranges they selected, which panel has focus, and whether somebody appears to be typing. That state makes the room feel live.',
        {type: 'callout', text: 'Awareness works because live human signals are mergeable freshness records, not durable edits.'},
        'Presence is different from content. Document text, rich-text marks, shapes, comments, and spreadsheet cells need durable conflict resolution. Cursor motion, typing flags, names, colors, and active panels need freshness, expiry, and privacy. They should be safe to drop, throttle, replace, and forget. A presence CRDT or awareness protocol gives the app a small mergeable state layer beside the durable document CRDT.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is to store presence in the same document log as edits. Every cursor move becomes an update. Every typing flag becomes history. Every focus change becomes part of the durable collaboration stream. This works for a quick demo because everyone receives the data, but it fails as soon as the room is active. The log fills with noisy state that nobody needs later, sync gets heavier, and private behavior is retained longer than the product requires.',
        'A second naive approach sends raw coordinates or character offsets over the network and treats the latest message as truth. That breaks under concurrent editing. If Alice says her cursor is at offset 120 while Bob inserts text near the start of the document, offset 120 may point to a different semantic location on Bob\'s screen. Presence should feel live, but it should not pretend that every peer has the same pixels at the same time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to model awareness as a per-client last-writer-wins record with expiry. The shared state is a map from client id to a small JSON object and a monotonically increasing clock. Each client owns only its own entry. When the local user moves a cursor, changes selection, or updates profile color, the client increments its own clock and broadcasts the replacement state. Peers keep the newest clock for that client and ignore older duplicates.',
        {type: 'image', src: 'https://docs.yjs.dev/~gitbook/image?dpr=3&quality=100&sign=549bcf20&sv=2&url=https%3A%2F%2F3672631625-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-legacy-files%2Fo%2Fassets%252F-MAkuXEU862fGj2p9idv%252F-MLmo5nKNvSBLCGhJOHd%252F-MLmyFupwLK0HAlEAz7U%252FAwareness%2520cursors-small.png%3Falt%3Dmedia%26token%3Db290ecd9-6bed-4b07-9f19-d28bd54542b1&width=768', alt: 'Collaborative editor with colored remote cursors', caption: 'Remote cursors make the retention boundary visible: peers see current attention, not permanent edit history. Source: Yjs Docs, https://docs.yjs.dev/getting-started/adding-awareness.'},
        'This is CRDT-like in the narrow sense that peers can merge updates without coordination and eventually agree on the newest visible state for each client, assuming messages continue to arrive. It is not the same as the durable document CRDT. It does not need to preserve every operation. It needs to preserve freshness. A null state or heartbeat timeout removes the entry. Losing one cursor update should make animation less smooth, not corrupt the document.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A client maintains local awareness state such as user name, color, avatar, cursor anchor, selection range, focused panel, and typing flag. When that state changes, the client increments its awareness clock and updates its local map entry. The provider encodes the changed client ids and broadcasts them to peers. A peer receives the update, compares the incoming clock with the stored clock for that client, and applies the state only if it is newer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Awareness propagation is a small directed dataflow: local state changes, provider broadcasts, peers merge by clock, and the UI renders freshness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Cursors and selections should use stable anchors when possible. In CRDT-backed text editors, that often means relative positions tied to document structure rather than raw offsets. The sender publishes the anchor as awareness state. The receiver resolves that anchor against its own current document only when rendering. If the anchor no longer resolves cleanly because the referenced content was deleted or the peer is far behind, the UI can hide, fade, or approximate the cursor without changing document truth.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The awareness-map view proves the ownership and freshness rules. One local client creates a small state object, increments its own clock, stores the result in a client-id map, and broadcasts an encoded update. Receivers do not run a complex conflict resolver for cursor motion. They keep the newest record for that client. The timeout edge proves that disappearance is also part of the protocol: stale presence should be removed when heartbeats stop.',
        'The cursor-lifecycle view proves the retention boundary. The editor selection becomes a relative position, then awareness state, then a network update, then a rendered remote cursor. The edge toward the document CRDT is deliberately marked as a separation, not a write. The presence-versus-content table is the lesson: text and formatting are durable collaboration data; cursors and typing flags are ephemeral signals. The app should not confuse those layers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because each client is the only writer for its own presence record. That removes the hardest conflict: no peer should edit another peer\'s cursor. The merge rule is simple and deterministic. For a given client id, the higher clock wins. Across different client ids, records coexist in the map. Peers can receive updates in different orders and still converge on the newest known state per client.',
        'It also works because it matches the value of the data. Presence is useful only while it is fresh. If a cursor update is delayed, the next one replaces it. If a tab crashes, timeout removes it. If a network drops messages, the document CRDT still carries durable truth and later awareness updates can refresh the UI. The protocol intentionally sacrifices history in exchange for low overhead, privacy, and responsiveness.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost is that awareness is only a hint. A green dot means a recent heartbeat, not proof that the person is looking at the same pixels. A remote cursor means the receiver resolved the last known anchor against its local document, not that the sender sees that exact layout. The UI must degrade gracefully when anchors disappear, clients fall behind, or provider broadcasts are delayed.',
        'There is also network and privacy cost. Cursor motion can be high frequency, so clients usually throttle or coalesce updates. Payloads should stay small and room-scoped. Names, emails, avatars, exact selections, viewport data, and active-panel names can reveal sensitive behavior. Presence should be sent only to authorized peers, expire aggressively, and avoid long retention unless the product has a clear reason and user expectation.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'Awareness appears in documents, code editors, whiteboards, design tools, spreadsheets, shared terminals, multiplayer dashboards, support consoles, and local-first notes apps. The visible features are familiar: colored carets, selection highlights, user avatars, follow mode, active cell outlines, typing indicators, and online lists. The underlying data is usually small JSON state plus a clock, not a permanent edit.',
        'Consider a local-first notes app. Alice publishes her name, color, and cursor relative position under client id 7. Bob receives the update, stores it in his awareness map, resolves the relative position against his current copy of the note, and renders Alice\'s caret. Document edits travel through the durable CRDT update path. Cursor moves travel beside it. If Alice closes the tab, a null state or timeout removes her presence while the note itself remains unchanged.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The first failure mode is putting awareness in the document log. That creates noisy history, larger sync payloads, worse privacy defaults, and strange undo behavior. The second is using raw offsets that drift under concurrent edits. The third is allowing arbitrary clients to overwrite other users presence records. The client-id ownership rule and clock check exist to prevent that class of confusion.',
        'Presence can also become a product risk. It can leak whether somebody opened a file, which paragraph they selected, which customer they inspected, or whether they are active after hours. It can be spoofed if the provider does not authenticate clients. It can become expensive if every mouse move broadcasts to a large room. Treat awareness as scoped, authenticated, lossy UI state. Do not use it as durable audit evidence or a source of permission decisions.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study last-writer-wins registers, logical clocks, and map CRDTs first, because awareness is easiest to understand as a map of per-client freshness records. Then study sequence CRDTs for collaborative text, Yjs struct stores and updates, relative positions, and rich-text CRDTs such as Peritext. Those topics explain the durable layer that awareness deliberately stays out of.',
        'After that, study provider protocols, local-first sync engines, service workers, WebSocket fanout, authorization for collaborative rooms, and collaborative undo. The useful mental model is simple: document CRDTs protect durable shared meaning; awareness protocols project temporary human attention. Good collaborative software needs both, but it should never make them the same data structure.',
      ],
    },
  ],
};
