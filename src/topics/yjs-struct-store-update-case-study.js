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
        "Read the animation as the execution trace for Yjs Struct Store & Updates. A Yjs implementation case study: Item structs, client clocks, shared types, delete sets, state vectors, binary updates, and provider-agnostic sync..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Yjs exists to make collaborative local-first data structures practical in real applications. A user can type into a shared text document, go offline, reconnect, receive remote edits, and converge without one central server deciding a single global order for every operation.',
        'The reason it is worth studying is that Yjs connects CRDT theory to production machinery: shared types for application code, stable structs for merge logic, compact binary updates for transport and storage, and provider boundaries for WebSocket, WebRTC, IndexedDB, or custom sync.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious sync shortcut is to send the whole document after each change. That is simple, but it wastes bandwidth, makes offline merge hard, and gives storage servers too much responsibility. Another shortcut is to invent an app-specific patch format. That often works until concurrent edits, duplicate delivery, and reconnect gaps appear.',
        'Collaborative editing needs updates that survive retries, reordering, partial delivery, and storage compaction. A patch that means insert this character at current index five is fragile because current index five can change on another replica. Yjs uses identities and struct relationships instead of trusting transient positions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that the friendly shared type is not the merge unit. Y.Text, Y.Array, and Y.Map are developer-facing APIs. Under them, Yjs stores structs with stable client-clock identities, origins, delete metadata, and enough ordering information to merge remote work later.',
        'The durable unit of sync is a binary update. An update is not a command that must run once in a single order. It is CRDT state encoded as bytes. Correctly applied updates are designed to be commutative, associative, and idempotent, so replicas can converge after different delivery paths.',
      ],
    },
    {
      heading: 'Struct identity',
      paragraphs: [
        'Every Yjs client has an id, and each local insertion advances a clock. Together, client id plus clock range form a stable address for inserted content. That address is much safer than an array index because it does not change just because another user inserted text earlier in the document.',
        'Origins connect a new item to neighboring sequence context. In a text CRDT, concurrent inserts can target the same visible position. The merge algorithm needs stable anchors and tie-breaking information so replicas can place items consistently even when they hear about edits in different orders.',
      ],
    },
    {
      heading: 'Struct store and state vectors',
      paragraphs: [
        'The struct store groups known structs by client and clock ranges. That organization makes it possible to summarize what a replica has without listing the whole document. A state vector says, for each client, the next clock the replica expects. It is a compact missing-work summary.',
        'When peer A sends its state vector to peer B, B can encode only the structs A is missing. That is the incremental-sync boundary. The system does not need to replay the entire document on every reconnect if both sides can describe their known clock ranges.',
      ],
    },
    {
      heading: 'Deletes and retention',
      paragraphs: [
        'Deletion in Yjs is not the same as pretending an item never existed. A delete set records clock ranges that are no longer visible. Rendering can skip deleted content, but sync still needs enough metadata to understand future updates that refer to old anchors.',
        'This is one of the hard production tradeoffs in CRDT systems. Keeping history forever grows storage. Garbage collecting too early can break peers that still need old structure to merge. Yjs gives mechanisms, but application infrastructure still needs a retention and compaction plan.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The struct-store view follows the hidden path behind a friendly editor operation: shared type to item structs, item structs to the store, store to state vector and delete set, and those summaries into an update. The point is that the merge state is more structured than visible text.',
        'The update-sync view shows the provider boundary. Providers can persist, relay, batch, merge, and rebroadcast updates, but they should not replace the CRDT rules with their own ordering semantics. The update format and struct store carry the convergence contract.',
      ],
    },
    {
      heading: 'Why it converges',
      paragraphs: [
        'Yjs convergence depends on stable identities and mergeable update application. If two replicas eventually receive the same set of relevant updates, duplicate delivery should not create duplicate content, and different delivery order should not produce different final documents.',
        'That property is what lets Yjs work across unreliable networks and mixed providers. A WebSocket server, an IndexedDB cache, and a peer-to-peer channel can all move the same update bytes. They do not need to understand every application-level edit, but they must preserve the update data needed for peers to catch up.',
        'State vectors make catch-up precise. A reconnecting peer can ask for only the client-clock ranges it lacks. A server that stores merged updates or snapshots can answer that request without replaying every keystroke through an editor model. The CRDT layer defines what missing means.',
        'That precision is what keeps sync incremental instead of repeatedly becoming full-document transfer.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is metadata and lifecycle complexity. Client ids, clocks, origins, delete ranges, state vectors, update blobs, snapshots, awareness messages, and provider protocol details all exist because concurrent local editing is harder than last-write-wins storage.',
        'Binary updates keep the overhead manageable, but not free. Large documents need compaction strategies. Long-lived rooms need storage policies. Multi-version clients need an update-format plan. Offline peers need a path back to consistency without forcing every server to hold infinite history.',
        'There is a latency tradeoff too. Local edits can apply immediately, which gives the user a fast editor, but remote peers still need update delivery and awareness messages. Providers decide how quickly to broadcast, persist, batch, and retry, so operational behavior depends on the transport even when convergence belongs to Yjs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Yjs wins in collaborative editors, shared whiteboards, local-first note tools, multiplayer interface state, design tools, and apps that need offline edits to merge later. The same document model can move over different providers because the important unit is the update, not a transport-specific command.',
        'It is also strong when the server should be simpler than the collaboration logic. A provider can authenticate a room, persist update bytes, answer state-vector diffs, and broadcast messages. It does not have to be the single authority that rewrites every document operation into one total order.',
        'That separation lets teams change transports without rewriting the document model. A prototype can start with IndexedDB and WebSocket, then add peer-to-peer or server snapshots while keeping update semantics stable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Yjs convergence does not solve authorization. A structurally valid update can still be malicious or sent by the wrong user. Access control must happen before updates enter a document room, and applications may need audit logs or moderation rules above the CRDT layer.',
        'Other failures come from deleting history too aggressively, mixing incompatible update formats, trusting provider delivery order, failing to snapshot large histories, or confusing awareness presence with durable document state. Presence can be ephemeral. Document updates are the durable merge input.',
        'A provider can also fail by becoming too clever. If it rewrites updates as custom operations, assumes one delivery order, drops old ranges that offline clients still need, or treats snapshots as proof of authorization, it has moved outside the Yjs contract. Keep transport logic boring and explicit.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: the Yjs repository at https://github.com/yjs/yjs, Yjs INTERNALS at https://github.com/yjs/yjs/blob/main/INTERNALS.md, the internals docs at https://docs.yjs.dev/api/internals, and document updates at https://docs.yjs.dev/api/document-updates.',
        'Study Sequence CRDTs for Collaborative Text, Delta-State CRDT Anti-Entropy Case Study, Local-First Sync Engine Case Study, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, and Automerge Change Graph and Columnar Storage next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for yjs-struct-store-update-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

