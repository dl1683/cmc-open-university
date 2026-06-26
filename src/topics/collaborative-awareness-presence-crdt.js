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
        'The animation shows two views of the awareness system. The awareness-map view demonstrates ownership and freshness: a client creates a presence record, increments its clock, stores the record in a shared map keyed by client ID, and broadcasts the update. Watch how a receiving peer compares clocks and keeps only the newer value. The timeout step shows what happens when heartbeats stop: stale entries are removed.',
        'The cursor-lifecycle view traces a single cursor from editor selection to rendered remote caret. Notice the deliberate boundary between presence state and document state. The cursor becomes a relative position, then awareness data, then a network message, then a rendered element on the peer\'s screen. It never becomes a document edit. Use the slider to step through each transition.',
        {type: 'image', src: './assets/gifs/collaborative-awareness-presence-crdt.gif', alt: 'Animated walkthrough of the collaborative awareness presence crdt visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'When multiple people edit a document at the same time, the text itself is only half the experience. Users also need to know who else is here, where their cursors are, what they have selected, and whether they appear to be actively typing. Without this information, collaboration feels like shouting into the dark. With it, the document feels like a shared room.',
        {type: 'callout', text: 'Awareness works because live human signals are mergeable freshness records, not durable edits.'},
        'But this "who is where" state is fundamentally different from document content. A character insertion must be preserved forever, survive conflicts, and produce the same result on every peer. A cursor position is only useful right now. If it arrives 500 milliseconds late, it is stale. If it is lost entirely, nothing is corrupted. Awareness exists as a protocol because these two kinds of data -- durable content and ephemeral presence -- need different engineering: different conflict rules, different storage lifetimes, different privacy guarantees.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest approach is to put presence data into the same log or CRDT that handles document edits. Every cursor move generates an operation. Every typing-indicator toggle becomes part of the edit history. This works in a prototype because the same sync channel delivers everything, and every peer sees every update.',
        'A slightly different obvious approach is to send raw character offsets over the network. Alice\'s client says "my cursor is at position 120" and broadcasts that number to all peers. Each peer renders a colored caret at position 120 in their local document. This is easy to implement and requires no special data structures.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Storing presence in the document log creates three problems. First, the log grows with every cursor twitch. A user who moves their cursor 10 times per second generates 600 operations per minute, none of which anyone needs after a few seconds. Second, undo becomes strange: undoing a text edit should not also undo a cursor move. Third, privacy suffers because the permanent log now records exactly which paragraph a user looked at and when.',
        'Raw offsets break under concurrency. If Alice reports her cursor at offset 120 and Bob simultaneously inserts 5 characters at offset 50, Alice\'s cursor should now be at offset 125 in Bob\'s view. But Bob received the number 120, so he renders the cursor 5 characters too early. With three or four concurrent editors making frequent insertions and deletions, raw offsets drift continuously. The cursors jump, flicker, and point at the wrong words.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model awareness as a map from client ID to a small record, where each client owns exactly one entry and uses a monotonically increasing clock to mark freshness. The data structure is a per-client last-writer-wins register. When Alice moves her cursor, her client increments its clock from, say, 41 to 42, writes a new record {cursor: relPos, color: "#e06c75", name: "Alice", clock: 42} under her client ID, and broadcasts it.',
        {type: 'image', src: 'https://docs.yjs.dev/~gitbook/image?dpr=3&quality=100&sign=549bcf20&sv=2&url=https%3A%2F%2F3672631625-files.gitbook.io%2F~%2Ffiles%2Fv0%2Fb%2Fgitbook-legacy-files%2Fo%2Fassets%252F-MAkuXEU862fGj2p9idv%252F-MLmo5nKNvSBLCGhJOHd%252F-MLmyFupwLK0HAlEAz7U%252FAwareness%2520cursors-small.png%3Falt%3Dmedia%26token%3Db290ecd9-6bed-4b07-9f19-d28bd54542b1&width=768', alt: 'Collaborative editor with colored remote cursors', caption: 'Remote cursors make the retention boundary visible: peers see current attention, not permanent edit history. Source: Yjs Docs, https://docs.yjs.dev/getting-started/adding-awareness.'},
        'When Bob receives this message, he compares clock 42 against the clock he last stored for Alice. If his stored clock is 40, he accepts the update. If it is already 43 (from a message that arrived out of order), he discards the older one. This is coordination-free: no locks, no central server deciding who wins. The rule is purely local -- higher clock wins for the same client ID, and different client IDs never conflict because each client writes only its own entry.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each client maintains a local awareness state object containing fields like name, color, cursor position, selection range, typing flag, and active panel. When any field changes, the client increments its awareness clock (a simple integer counter), writes the new state into a map keyed by its own client ID, and hands the update to the network provider. The provider encodes the changed entries and broadcasts them.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Awareness propagation is a small directed dataflow: local state changes, provider broadcasts, peers merge by clock, and the UI renders freshness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Cursor positions use relative anchors rather than raw offsets. In a CRDT-backed editor, a cursor position is stored as a reference to a specific item in the CRDT structure (for example, "after item ID abc123") rather than "character offset 120." When the receiver renders the remote cursor, it resolves this anchor against its own local document state. Because the anchor refers to a structural identity that survives concurrent edits, the cursor stays attached to the right word even if text is inserted or deleted nearby.',
        'Heartbeats and timeouts handle disappearance. A client that is still connected sends periodic heartbeat updates (typically every 30 seconds) even if nothing else changed. If a peer has not received any update from a client for longer than the timeout window (often 60-90 seconds), it removes that client\'s entry from the map. This means a browser tab that crashes or a network that drops silently will be cleaned up automatically.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it eliminates the hardest class of conflict: no peer ever writes to another peer\'s entry. Alice\'s client is the only writer for client ID 7. Bob\'s client is the only writer for client ID 12. The merge function never faces a situation where two peers disagree about the same entry because they never compete for the same key. Across different keys, entries simply coexist.',
        'For the same key, the monotonic clock provides a total order. If Alice\'s clock is 42 and a peer holds clock 40, the update is accepted. If the peer holds 43 (from a faster network path), the update is rejected. Peers can receive messages out of order and still converge, because the rule depends only on the clock value, not on arrival sequence. This is the same principle as a last-writer-wins register in CRDT theory, applied to a narrow and disposable data type.',
        'It also works because the data matches its lifecycle. Presence is only valuable while it is fresh. If a cursor update is delayed by 2 seconds, the next update replaces it anyway. If an update is lost entirely, the document is unaffected. The protocol trades durability (which presence does not need) for simplicity and low overhead (which it does).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Bandwidth is the main operational cost. A user moving their cursor steadily generates about 10-30 position updates per second. At roughly 200 bytes per encoded awareness message, that is 2-6 KB/s per active user. In a room with 10 active users, each client receives 20-60 KB/s of awareness traffic. Throttling to 50 ms intervals (20 updates/second max) and coalescing rapid changes into a single broadcast keeps this manageable. Most implementations also skip broadcasting if the state has not actually changed since the last send.',
        'Memory cost is minimal. Each client\'s awareness record is a small JSON object, typically under 500 bytes. A room with 100 connected clients stores about 50 KB of awareness state. Compare this to the document CRDT, which may be megabytes. The awareness map is negligible.',
        'Implementation complexity is low compared to the document CRDT. The merge function is a single clock comparison per client ID. There is no need for tombstones, garbage collection, or operational transformation. The hardest part is correctly implementing relative cursor positions, which depends on the specific CRDT used for the document rather than on the awareness protocol itself.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google Docs, Figma, Notion, VS Code Live Share, and most collaborative editors display colored cursors, selection highlights, and user avatars. These are all awareness features. The underlying implementation varies, but the pattern is the same: each client publishes its own ephemeral state, peers merge by freshness, and the UI renders the result as colored indicators.',
        'Consider a local-first notes app built on Yjs. Alice opens a note and her client generates a random client ID (say, 7). Her awareness state is {name: "Alice", color: "#e06c75", cursor: {type: "relative", item: "abc123", assoc: 1}}. She broadcasts this with clock 1. Bob\'s client receives it, stores it under client ID 7, resolves the relative position against his local document, and renders a red caret at the corresponding location. When Alice closes the tab, her heartbeat stops. After 60 seconds of silence, Bob\'s client removes client ID 7 from the map and the red caret disappears. The note itself is unchanged.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The first failure is mixing awareness with document state. If cursor movements are stored in the document\'s operation log, undo becomes broken (undoing a text edit also undoes a cursor move), the log grows without bound from ephemeral noise, and privacy is compromised because the permanent history records browsing behavior. This is the most common architectural mistake in collaborative editor implementations.',
        'The second failure is using raw character offsets instead of structural anchors. In any system with concurrent editing, offsets drift. The cursor appears to jump to wrong locations, sometimes landing in the middle of a word or on a completely different line. The fix is always the same: express positions relative to the document\'s internal structure (CRDT item IDs, OT character identities) rather than raw integers.',
        'The third failure is treating presence as trustworthy. A green "online" dot means the client sent a heartbeat recently. It does not mean the person is paying attention, that their screen shows the same content, or that the client authenticated honestly. Presence should never be used for access control, audit trails, or compliance evidence. It is a UI hint, not a security primitive.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three clients connect to a shared document. Client A (clock 0) sets state {name: "Alice", cursor: pos_1, color: "red"}. It increments clock to 1 and broadcasts. Client B (clock 0) sets state {name: "Bob", cursor: pos_2, color: "blue"}, increments to 1, broadcasts. The awareness map on every peer now has two entries: {A: {clock:1, state:{...}}, B: {clock:1, state:{...}}}.',
        'Alice moves her cursor. Client A increments clock to 2, sets cursor to pos_3, broadcasts. Bob receives it: stored clock for A is 1, incoming is 2, so he accepts. The map updates. Now Client C connects late and receives both A\'s update (clock 2) and B\'s update (clock 1). C has no stored clocks, so both are accepted. All three peers converge on the same map.',
        'Alice\'s laptop loses Wi-Fi. Her heartbeats stop. After 60 seconds, Bob and Carol\'s clients remove A\'s entry from the map. Alice\'s red cursor disappears from their screens. The document is unaffected. When Alice reconnects, her client broadcasts a new state with clock 3, and the cursor reappears. No data was lost because no data needed to be durable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Yjs awareness protocol (docs.yjs.dev) is the most widely used open-source implementation and the reference for this topic. The concept of last-writer-wins registers comes from Shapiro et al., "A Comprehensive Study of Convergent and Commutative Replicated Data Types" (INRIA 2011). For cursor anchoring in CRDTs, see the Yjs relative position API and the Peritext paper (Litt et al., 2022) for rich-text marks.',
        'To build understanding from here, study last-writer-wins registers and logical clocks to understand the merge rule. Study sequence CRDTs (Yjs, Automerge) to understand the durable layer that awareness deliberately avoids touching. Study relative positions to understand how cursor anchors survive concurrent edits. Study WebSocket fanout and provider protocols to understand how awareness messages are delivered. The key mental model: document CRDTs protect durable shared meaning; awareness protocols project temporary human attention. Good collaborative software needs both but must never confuse them.',
      ],
    },
  ],
};
