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
    explanation: 'Yjs exposes friendly shared types such as Y.Text, Y.Array, and Y.Map. Internally, the shared document is organized around list-like Item structs with stable client-clock identities.',
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
    explanation: 'A Yjs struct is named by client id plus clock. Origins connect it into the sequence. The internals note calls out originRight as an optimization for heavy concurrent inserts at the same position.',
  };

  yield {
    state: yjsGraph('The struct store groups structs by client clock ranges', { store: 'ranges', sv: 'next clock', update: 'diff' }),
    highlight: { active: ['itemA', 'itemB', 'store', 'sv', 'e-a-store', 'e-b-store', 'e-store-sv'], found: ['update'] },
    explanation: 'A state vector summarizes the next expected clock for each client. If a peer says it has A up to clock 12, the local document can encode only structs after that point.',
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
    explanation: 'Deletes are not ordinary string splices. The delete set records deleted clock ranges so the document can hide content while preserving enough structure for remote updates and sync.',
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
    explanation: 'The important separation is API, CRDT structs, binary updates, and provider transport. Provider code should move updates; it should not redefine convergence.',
  };
}

function* updateSync() {
  yield {
    state: yjsGraph('Document updates are binary CRDT deltas', { update: 'binary', peer: 'merge' }),
    highlight: { active: ['store', 'sv', 'del', 'update', 'e-sv-update', 'e-del-update'], found: ['peer'] },
    explanation: 'Yjs encodes document changes into compact Uint8Array updates. The docs state that updates are commutative, associative, and idempotent: apply them in any order, even repeatedly, and replicas still converge once they have all updates.',
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
    explanation: 'The README documents update-level APIs such as mergeUpdates, encodeStateVectorFromUpdate, and diffUpdate. That lets storage servers compact or diff update blobs without materializing the editor state.',
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
    explanation: 'A Yjs update log is not a permission system or retention policy. Production systems still need document-level access control, storage compaction, room lifecycle rules, and a plan for update-format compatibility.',
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
      heading: 'What it is',
      paragraphs: [
        'Yjs is a CRDT implementation for collaborative software. Its public API exposes shared types such as Y.Text, Y.Array, and Y.Map. Internally, those shared types are backed by CRDT structs, client ids, clocks, delete sets, state vectors, and binary updates.',
        'This page is about the implementation shape rather than the product API. The important lesson is that collaborative editing becomes tractable when every inserted unit has stable identity and every sync message can be applied in any delivery order without breaking convergence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Yjs internals describe the system as a list CRDT. Arrays, text, and map entries are represented through list-like Items. Each client receives a unique client id, and structs are addressed by client id plus clock. Text can group several characters in one Item for efficiency, and maps use entries where the latest inserted entry for a key wins while older duplicates are marked deleted.',
        'Document updates are compact binary Uint8Array values. Yjs documents say updates are commutative, associative, and idempotent. State vectors summarize the next expected clock for each client, letting a peer encode only missing differences. Delete sets record deleted ranges so rendering can hide content while sync still has the causal anchors it needs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is metadata. Client clocks, origins, delete ranges, and shared-type structure have to exist so peers can merge without a central order. Yjs reduces overhead through binary updates, struct grouping, state-vector diffs, update merging, and provider-agnostic transport.',
        'The operational cost is lifecycle management. Providers need to persist and relay updates, compact history safely, gate access, and handle update-format choices such as V1 versus V2. A provider that drops needed history or applies permissions after merging untrusted updates can still create product-level failures even if the CRDT algorithm is correct.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A browser user types into a Y.Text document. Yjs creates Item structs owned by that client id and clock range, updates the shared type, and emits a binary update. A WebSocket provider sends that update to peers and persists it. A peer applies the update, merges the new structs into its store, updates its state vector, and renders the same text. If the peer already saw the update, applying it again is harmless.',
        'Later, the server wants to reduce storage overhead. It can merge multiple updates into one compact update and compute state vectors from stored update blobs. That means the server can act like a durable relay for CRDT data without understanding the editor DOM or replaying every keystroke into an application-specific model.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Yjs convergence does not mean authorization, audit, or retention are solved. A malicious update can still be a valid CRDT update. Access control must happen at the document or room boundary. Deleting visible content also does not necessarily delete all causal history immediately; offline peers and future merges may require retained metadata.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Yjs repository at https://github.com/yjs/yjs, Yjs internals at https://github.com/yjs/yjs/blob/main/INTERNALS.md, Yjs internals docs at https://docs.yjs.dev/api/internals, Yjs document updates at https://docs.yjs.dev/api/document-updates, and Yjs README update API at https://github.com/yjs/yjs/blob/main/README.md. Study Sequence CRDTs for Collaborative Text, Local-First Sync Engine Case Study, Delta-State CRDT Anti-Entropy Case Study, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, and Automerge Change Graph & Columnar Storage next.',
      ],
    },
  ],
};
