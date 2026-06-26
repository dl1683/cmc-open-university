// Yjs internals: struct store, client clocks, state vectors, delete sets,
// compressed updates, and provider-agnostic sync.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'yjs-struct-store-update-case-study',
  title: 'Yjs Struct Store & Updates',
  category: 'Systems',
  summary: 'A Yjs implementation case study: Item structs, client clocks, shared types, delete sets, state vectors, binary updates, and provider-agnostic sync.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['struct store', 'update sync'], defaultValue: 'struct store' },
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

function yjsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'type', label: 'Y.Text', x: 0.7, y: 4.0, note: notes.type ?? 'shared' },
      { id: 'itemA', label: 'A:0', x: 2.2, y: 2.5, note: notes.itemA ?? 'item' },
      { id: 'itemB', label: 'B:0', x: 2.2, y: 5.5, note: notes.itemB ?? 'item' },
      { id: 'store', label: 'store', x: 4.0, y: 4.0, note: notes.store ?? 'by client' },
      { id: 'sv', label: 'sv', x: 5.8, y: 2.4, note: notes.sv ?? 'next clk' },
      { id: 'del', label: 'del set', x: 5.8, y: 5.6, note: notes.del ?? 'deleted' },
      { id: 'update', label: 'update', x: 7.6, y: 4.0, note: notes.update ?? 'Uint8' },
      { id: 'peer', label: 'peer', x: 9.2, y: 4.0, note: notes.peer ?? 'apply' },
    ],
    edges: [
      { id: 'e-type-a', from: 'type', to: 'itemA', weight: '' },
      { id: 'e-type-b', from: 'type', to: 'itemB', weight: '' },
      { id: 'e-a-store', from: 'itemA', to: 'store', weight: '' },
      { id: 'e-b-store', from: 'itemB', to: 'store', weight: '' },
      { id: 'e-store-sv', from: 'store', to: 'sv', weight: '' },
      { id: 'e-store-del', from: 'store', to: 'del', weight: '' },
      { id: 'e-sv-update', from: 'sv', to: 'update', weight: '' },
      { id: 'e-del-update', from: 'del', to: 'update', weight: '' },
      { id: 'e-update-peer', from: 'update', to: 'peer', weight: '' },
    ],
  }, { title });
}

function* structStore() {
  yield {
    state: yjsGraph('Yjs represents shared types through list items'),
    highlight: { active: ['type', 'itemA', 'itemB', 'e-type-a', 'e-type-b'], found: ['store'] },
    explanation: 'The public API is friendly, but the merge machinery works on structs. Y.Text, Y.Array, and Y.Map changes become Item-like records with stable client-clock identities that can be ordered and synced.',
    invariant: 'The public type is convenient; the merge algorithm works on stable structs.',
  };

  yield {
    state: labelMatrix(
      'Struct identity',
      [
        { id: 'actor', label: 'client id' },
        { id: 'clock', label: 'clock' },
        { id: 'origin', label: 'origin' },
        { id: 'right', label: 'originR' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why' },
      ],
      [
        ['replica id', 'unique owner'],
        ['local seq', 'stable id'],
        ['left anchor', 'order merge'],
        ['right anchor', 'tie help'],
      ],
    ),
    highlight: { found: ['actor:why', 'clock:why'], active: ['origin:meaning', 'right:meaning'] },
    explanation: 'Client id plus clock is the stable address. Origins tie an item to nearby sequence context, while originRight helps disambiguate dense concurrent inserts at the same place. The fields exist so order can be recovered later.',
  };

  yield {
    state: yjsGraph('The struct store groups structs by client clock ranges', { store: 'ranges', sv: 'next clock', update: 'diff' }),
    highlight: { active: ['itemA', 'itemB', 'store', 'sv', 'e-a-store', 'e-b-store', 'e-store-sv'], found: ['update'] },
    explanation: 'The state vector is the missing-work summary. If a peer has client A through clock 12, the sender can encode only structs after that range instead of replaying the whole document.',
  };

  yield {
    state: labelMatrix(
      'Deletes remain structured',
      [
        { id: 'insert', label: 'insert' },
        { id: 'delete', label: 'delete' },
        { id: 'render', label: 'render' },
        { id: 'gc', label: 'gc' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['Item', 'visible'],
        ['range', 'hidden'],
        ['skip del', 'text view'],
        ['safe only', 'less state'],
      ],
    ),
    highlight: { active: ['delete:record', 'render:effect'], compare: ['gc:record'] },
    explanation: 'Deletes hide content, but they also create sync metadata. The delete set records clock ranges so peers can converge on what is invisible while still retaining anchors needed by remote updates.',
  };

  yield {
    state: labelMatrix(
      'Yjs layer map',
      [
        { id: 'api', label: 'shared type' },
        { id: 'structs', label: 'structs' },
        { id: 'updates', label: 'updates' },
        { id: 'provider', label: 'provider' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'next', label: 'study link' },
      ],
      [
        ['editor API', 'text buffer'],
        ['merge state', 'seq CRDT'],
        ['wire/storage', 'sync engine'],
        ['network', 'awareness'],
      ],
    ),
    highlight: { found: ['structs:job', 'updates:job'], compare: ['provider:job'] },
    explanation: 'This map keeps the Yjs layers separate. Shared types are the API, structs are the CRDT state, updates are the storage/wire unit, and providers are transport. Mixing those responsibilities makes debugging much harder.',
  };
}

function* updateSync() {
  yield {
    state: yjsGraph('Document updates are binary CRDT deltas', { update: 'binary', peer: 'merge' }),
    highlight: { active: ['store', 'sv', 'del', 'update', 'e-sv-update', 'e-del-update'], found: ['peer'] },
    explanation: 'A Yjs update is a compact binary CRDT packet. The important contract is commutative, associative, and idempotent application: once all needed updates arrive, replicas converge even if delivery was reordered or duplicated.',
    invariant: 'The update is a mergeable data packet, not a command that must run once in a single global order.',
  };

  yield {
    state: labelMatrix(
      'Update API mental model',
      [
        { id: 'apply', label: 'apply' },
        { id: 'encode', label: 'encode' },
        { id: 'statev', label: 'state vec' },
        { id: 'diff', label: 'diff' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['doc+update', 'merged doc'],
        ['doc+sv', 'missing update'],
        ['doc/update', 'client clocks'],
        ['update+sv', 'missing bytes'],
      ],
    ),
    highlight: { active: ['encode:output', 'diff:output'], found: ['statev:output'] },
    explanation: 'The state vector is the summary that lets a peer ask for just the missing clock ranges. Yjs can compute differences from a live document or directly from binary updates.',
  };

  yield {
    state: yjsGraph('Updates can be merged without loading a Y.Doc', { store: 'encoded', sv: 'from update', update: 'merge', peer: 'later' }),
    highlight: { active: ['store', 'sv', 'update', 'e-store-sv', 'e-sv-update'], compare: ['type'] },
    explanation: 'These update-level APIs let storage infrastructure do useful work without loading a Y.Doc. A server can merge update blobs, compute a state vector from them, and produce missing bytes for a peer.',
  };

  yield {
    state: labelMatrix(
      'Provider obligations',
      [
        { id: 'ws', label: 'websocket' },
        { id: 'webrtc', label: 'webrtc' },
        { id: 'idb', label: 'indexeddb' },
        { id: 'server', label: 'server' },
      ],
      [
        { id: 'moves', label: 'moves' },
        { id: 'mustNot', label: 'must not' },
      ],
      [
        ['updates', 'own truth'],
        ['updates', 'trust order'],
        ['updates', 'drop needed'],
        ['updates', 'invent ops'],
      ],
    ),
    highlight: { found: ['ws:moves', 'idb:moves'], compare: ['server:mustNot'] },
    explanation: 'Yjs is network agnostic. A provider can persist, relay, batch, or rebroadcast updates, but the convergence contract lives in the update format and struct store.',
  };

  yield {
    state: labelMatrix(
      'Operational pitfalls',
      [
        { id: 'history', label: 'history' },
        { id: 'delete', label: 'delete' },
        { id: 'auth', label: 'auth' },
        { id: 'version', label: 'version' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control', label: 'control' },
      ],
      [
        ['unbounded', 'compact'],
        ['not purge', 'safe gc'],
        ['merge bad', 'gate room'],
        ['format drift', 'V1/V2 plan'],
      ],
    ),
    highlight: { active: ['history:control', 'auth:control'], compare: ['delete:risk'] },
    explanation: 'The pitfall table is the production boundary. A valid update can still be unauthorized, retained too long, compacted too early, or encoded in a format your clients do not all support.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'struct store') yield* structStore();
  else if (view === 'update sync') yield* updateSync();
  else throw new InputError('Pick a Yjs view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the struct-store view as the path from a user edit to durable merge state. Active nodes are stages currently handling the edit, found nodes are structs already committed to the document, and compare nodes are peers or summaries waiting for sync. A safe inference is this: if an Item has a client-clock id, later network order cannot change that id.',
        'Read the update-sync view as the wire path. A state vector is a compact summary of what a peer has already seen, and a delete set is a compact summary of which id ranges are deleted. The animation shows why Yjs can send only missing updates instead of sending the whole document every time.',
        {type: 'callout', text: 'Yjs makes collaboration converge by replacing unstable positions with permanent client-clock identities and mergeable binary updates.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Collaborative editing means many users can edit the same document while messages arrive late, out of order, or not at all for a while. A CRDT, or conflict-free replicated data type, is a data structure designed so replicas can merge changes without a central serializer. Yjs is a CRDT library for text and structured shared data.',
        'The hard case is offline editing. Alice can type while disconnected, Bob can type at the same cursor, and both clients should converge after reconnection. Yjs exists to make that merge local, deterministic, and compact enough for real editors.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send operations that mention positions, such as insert A at index 5. That works while one server receives every operation and rewrites indexes into one global order. It becomes fragile when peers can edit without asking the server first.',
        'Another simple approach is last-write-wins, where the newest timestamp replaces older state. That converges, but it destroys user intent. A later timestamp should not erase a paragraph someone wrote offline just because the clocks made it look older.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that positions are not stable facts. If Alice inserts H at position 0 and Bob inserts Y at position 0 while offline, position 0 refers to different local histories. The merge needs an address that survives both histories.',
        'The invariant is strong eventual consistency: replicas that have received the same set of updates must produce the same document. Delivery order cannot matter. Position-based operations do not give that invariant unless a central authority orders every edit before peers apply it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to identify content by a permanent id, not by its current position. In Yjs, an inserted Item gets an id shaped like client id plus clock. The client id names the writer, and the clock counts that writer\'s inserted content.',
        'Each Item also stores structural anchors: the item that was on its left and the item that was on its right when it was created. When a remote Item arrives, Yjs uses those anchors plus deterministic tie-breaking to place it. The document order is derived from ids and anchors, not from arrival time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A local insert creates an Item, links it into the shared type, appends it to that client\'s array in the struct store, and advances the local clock. The struct store is a map from client id to arrays ordered by clock. That layout makes lookup by id a binary search inside one client\'s array.',
        'Sync uses state vectors. If Alice has seen client 1 through clock 7 and client 2 through clock 3, her state vector is roughly {1: 8, 2: 4}, meaning the next expected clock for each client. Bob can compare that summary with his struct store and send only structs Alice lacks, plus delete-set ranges.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on stable identity and deterministic integration. An Item id never changes, and the anchors refer to other stable ids. If two replicas have the same Items, the same comparison rule places conflicting Items in the same relative order.',
        'Deletes converge because deletion is a one-way mark over id ranges. Applying the same delete set twice changes nothing, and receiving it before or after another update still marks the same permanent ids. That makes updates idempotent, which means replaying an update does not duplicate the edit.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A local insert is cheap because it appends to one client array and updates nearby links. A remote insert can cost more when many concurrent Items target the same gap, because the algorithm must walk the conflict window. If 40 users insert at the same cursor at once, that local conflict window can be about 40 Items.',
        'Memory grows with editing history, not only visible text. If a document ends at 100,000 visible characters after 250,000 inserted characters, the store may still need deleted ranges and historical ids. Garbage collection can remove content from deleted Items, but collecting too early can hurt peers that still need old anchors.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Yjs fits collaborative editors, local-first apps, whiteboards, shared forms, and developer tools where users expect offline edits to merge later. The shared type API hides the CRDT mechanics from application code. Providers such as WebSocket, WebRTC, and IndexedDB move or persist the same binary updates.',
        'The pattern also fits sync layers for structured app state. A Y.Map can hold records, a Y.Array can hold ordered blocks, and Y.Text can hold rich text. The important boundary is that Yjs merges data; authorization and malicious-update filtering must happen outside the CRDT core.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Yjs fails as a security boundary. A valid binary update can still be unauthorized or harmful, and the CRDT layer will merge it if the provider lets it in. Authentication, room membership, rate limits, and schema validation must sit at the transport or application layer.',
        'It also fails when teams store large blobs as collaborative text. A 5 MB image should not become millions of text characters with CRDT metadata. Store the blob elsewhere and put a hash, URL, or object id in the shared document.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty text. Alice has client id 1 and inserts H then i, creating Items (1,0) and (1,1). Bob has client id 2 and offline inserts Y then o, creating Items (2,0) and (2,1).',
        'When the peers sync, (1,0) and (2,0) both have no left origin because both started at the empty document. The deterministic tie-break puts client 1 before client 2, so the visible text becomes HiYo. If Bob receives Alice first or Alice receives Bob first, the same ids and rule produce the same result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Yjs docs at https://docs.yjs.dev/, the Yjs internals document at https://github.com/yjs/yjs/blob/main/INTERNALS.md, and the Yjs repository at https://github.com/yjs/yjs as primary implementation sources. For the algorithm background, read Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types, the YATA paper.',
        'Study Sequence CRDTs for Collaborative Text first, then Delta-State CRDT Anti-Entropy for the state-vector sync pattern. Compare Automerge Change Graph Columnar Case Study to see a different CRDT storage design. Then read Collaborative Undo Redo Intention Stack for the user-facing problem that sits above merge.',
      ],
    },
  ],
};
