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
        'The "struct store" view traces the hidden data path behind a collaborative edit: from the shared type API (Y.Text) through Item structs, the struct store organized by client ID, the state vector and delete set summaries, and finally the binary update that carries everything to a peer. Active nodes are the current stage of the data flow. Found nodes are durable state already committed to the store. Compare nodes are pending or downstream participants.',
        'The "update sync" view traces the provider boundary: how binary updates are encoded, diffed against state vectors, and delivered through transport-agnostic providers. Active nodes are the encoding pipeline. Found nodes are the wire artifacts. Compare nodes are peers waiting to apply.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and its incoming edge is highlighted, data has reached that stage. If a downstream node is not yet active, no peer can observe that data there. The graph is not a class diagram -- it is a data-flow trace through one sync cycle.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Kevin Jahns, Yjs author',
          text: 'Yjs is a CRDT implementation that exposes its internal state as shared types. The shared types are just a convenient API -- the real work happens in the struct store.',
        },
        'Collaborative editing sounds simple until you add offline support, unreliable networks, and multiple simultaneous writers. A user types into a shared document, goes offline for an hour, reconnects, and expects every edit from every peer to merge cleanly -- no lost characters, no duplicated text, no central server deciding a single global order.',
        'Yjs solves this by separating concerns into four layers: shared types for the application API, Item structs for the CRDT merge state, binary updates for transport and storage, and providers for network delivery. Each layer has a precise contract. Studying the struct store layer reveals why CRDTs can be both theoretically sound and practically fast.',
        'The engineering achievement is concrete. Kevin Jahns benchmarked Yjs on the B4 trace -- 259,778 single-character editing operations from a real LaTeX collaboration session collected by Martin Kleppmann. Yjs merges consecutive insertions by the same user into compound Items, reducing 260K operations to just 10,971 Item structs. The encoded document is 159,927 bytes. That performance comes from how the struct store is organized, not from ignoring CRDT invariants.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is operational transformation (OT): send operations like "insert X at position 5" and transform them against concurrent operations so indexes stay consistent. Google Docs uses this approach with a central server that serializes all operations into one total order.',
        'OT works well with a central server, but it breaks down without one. The transformation functions grow quadratically complex with the number of operation types. Proving correctness requires checking every pair of concurrent operations against every possible interleaving. Adding a new operation type means updating every existing transform.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Naive position-based sync: simple, fragile under concurrency.
function insertAt(doc, position, char) {
  // Position 5 means "after the 5th character" right now.
  // But if another user inserted 3 characters before position 5
  // on their replica, this insert lands in the wrong place.
  return doc.slice(0, position) + char + doc.slice(position);
}
// Without a central server to serialize order, two concurrent
// insertAt(doc, 5, 'A') and insertAt(doc, 5, 'B') can diverge.`,
        },
        'The second common attempt is last-write-wins: timestamp every change, keep the latest one. This converges trivially but silently discards work. A user who edits offline for an hour can lose everything when a peer with a later timestamp overwrites their changes.',
        'Both approaches share a structural weakness: they identify content by its current position in the document. Positions are unstable under concurrent edits. Yjs solves this by giving every piece of content a permanent identity that never changes regardless of what other users do.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is concurrent insertion at the same position without a total order.',
        'Two users place their cursors at the same spot and type simultaneously. User A inserts "hello" and user B inserts "world" -- both at position 10. Without a central server, there is no canonical order. A position-based system must somehow decide: does the result read "helloworld" or "worldhello"? And it must make every replica reach the same answer, even if they receive the operations in different orders.',
        {
          type: 'table',
          headers: ['Approach', 'Concurrent insert behavior', 'Why it breaks'],
          rows: [
            ['Position-based OT (no server)', 'Transform indexes pairwise', 'Transform functions are error-prone; correctness proofs are combinatorially expensive'],
            ['Last-write-wins', 'Later timestamp overwrites', 'Silently discards the losing edit; user intent is destroyed'],
            ['Lock-based', 'Block until lock holder releases', 'Offline users hold locks forever; defeats the purpose of local-first'],
            ['Full-document sync', 'Send entire document after each edit', 'O(n) bandwidth per keystroke; merge is undefined for concurrent full-docs'],
          ],
        },
        'The invariant that must hold: if two replicas eventually receive the same set of insertions, they must produce the same document, regardless of delivery order. Position-based schemes cannot guarantee this without a central serializer. Yjs guarantees it through stable identities and a deterministic ordering algorithm called YATA.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that every character gets a permanent address -- a (clientID, clock) pair -- and every insertion records which existing items it was placed between. The merge algorithm uses these structural anchors, not transient positions, to determine order.',
        {
          type: 'diagram',
          alt: 'Yjs Item struct fields and their roles',
          label: 'An Item is a node in a doubly-linked list with CRDT identity',
          body: `Item {
  id: { client: 42, clock: 7 }    // permanent address
  origin: { client: 42, clock: 6 } // left neighbor at creation time
  rightOrigin: { client: 13, clock: 3 } // right neighbor at creation time
  left:  --> Item                   // current left in the linked list
  right: --> Item                   // current right in the linked list
  parent: Y.Text / Y.Array / Y.Map // which shared type owns this
  content: ContentString("h")      // the actual payload
  deleted: false                   // tombstone flag
}`,
          text: `Item {
  id: { client: 42, clock: 7 }    // permanent address
  origin: { client: 42, clock: 6 } // left neighbor at creation time
  rightOrigin: { client: 13, clock: 3 } // right neighbor at creation time
  left:  --> Item                   // current left in the linked list
  right: --> Item                   // current right in the linked list
  parent: Y.Text / Y.Array / Y.Map // which shared type owns this
  content: ContentString("h")      // the actual payload
  deleted: false                   // tombstone flag
}`,
        },
        'The id is assigned once and never changes. The origin and rightOrigin fields record which items were to the left and right when this item was created. These anchors survive concurrent edits because they reference permanent ids, not positions. When a remote item arrives, the YATA algorithm walks the linked list between origin and rightOrigin and uses client ID comparison to break ties deterministically.',
        'The shared type (Y.Text, Y.Array, Y.Map) is the developer-facing API. It translates friendly operations like "insert at index 3" into Item creation with the correct origin pointers. The developer never sees client IDs or clocks. The struct store does all the merge work underneath.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The struct store is a Map<clientID, Array<AbstractStruct>> -- a flat map from client ID to a sorted array of structs. Each client\'s array is ordered by clock, and clocks are contiguous: client 42\'s array contains items at clocks 0, 1, 2, 3, ... with no gaps. Lookup uses an interpolation-pivoted binary search: the initial midpoint is estimated as floor((targetClock / maxClock) * arrayLength), exploiting the roughly uniform distribution of clocks. This gives O(log n) lookups per client array.',
        {
          type: 'bullets',
          items: [
            'Item: the primary struct type. Each Item carries an info bitfield with four flags -- keep (prevent GC for undo), countable (addressable by index in Y.Array), deleted (one-way tombstone latch), and marker (skip-list fast-search cache). Content is one of nine types: ContentString, ContentAny, ContentBinary, ContentEmbed, ContentFormat (rich text marks like bold/italic -- not countable), ContentType (nested shared types), ContentJSON (legacy), ContentDoc (subdocuments), and ContentDeleted. Multiple characters typed in sequence are stored as one Item with a ContentString; the Item splits later if a remote insert lands in the middle.',
            'GC: a tombstone struct that replaces a deleted Item after garbage collection. It keeps the id and length (so the clock range is preserved) but drops content and origin pointers. Only two fields: id and length. Once GC\'d, the content is gone forever.',
            'Skip: a placeholder struct used during decoding when a received struct depends on another struct that has not arrived yet. It reserves the clock range so later deliveries can fill it in.',
            'State vector: a Map<clientID, clock> where clock is the next expected clock for that client -- one past the last seen, not the last seen itself. If client 42 has items at clocks 0 through 11 (total length 12), the state vector entry is {42: 12}. Computed as lastStruct.id.clock + lastStruct.length. The state vector is the entire "what do I have?" summary.',
            'Delete set: a Map<clientID, Array<{clock, len}>> recording which clock ranges are deleted. Ranges are sorted and non-overlapping within each client. Transmitted alongside structs in binary updates so peers can mark the right items as deleted. V2 encoding uses delta compression on clocks for smaller wire size.',
          ],
        },
        'When a local edit happens, Yjs creates a new Item, links it into the doubly-linked list of its parent shared type, appends it to the client\'s struct array in the store, and advances the local clock. The Item\'s origin is set to the item currently to its left, and rightOrigin to the item currently to its right.',
        {
          type: 'code',
          language: 'javascript',
          body: `// Simplified YATA integration: inserting a remote Item
// between its origin and rightOrigin.
function integrateItem(item, store) {
  let left = store.find(item.origin);
  let right = store.find(item.rightOrigin);
  // Walk right from origin, comparing with conflicting items
  // that share the same origin (concurrent inserts at same spot).
  let cursor = left?.right;
  while (cursor !== right) {
    if (cursor.origin === item.origin) {
      // Tie-break: lower clientID goes left.
      if (cursor.id.client < item.id.client) {
        left = cursor;  // cursor wins left position
      } else {
        break;          // item wins left position
      }
    }
    cursor = cursor.right;
  }
  // Splice item between left and right.
  item.left = left;
  item.right = left?.right;
  // Link neighbors back to item.
}`,
        },
        'The YATA conflict resolution rule is simple: when two items share the same origin (they were both inserted after the same left neighbor), the one with the lower client ID goes first. This is deterministic, requires no coordination, and produces the same result regardless of delivery order.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence rests on three properties of the YATA algorithm:',
        {
          type: 'bullets',
          items: [
            'Commutativity: applying updates A then B produces the same document as applying B then A. This holds because each Item has a fixed id and fixed origin pointers. The integration position depends only on the existing items between origin and rightOrigin, not on the order updates arrived.',
            'Idempotency: applying the same update twice does not duplicate content. The struct store checks whether an item with that (clientID, clock) already exists before inserting.',
            'Associativity: merging update AB with update C gives the same result as merging A with update BC. This follows from commutativity and the deterministic tie-breaking rule.',
          ],
        },
        'The critical invariant is: for any two items with the same origin, their relative order is determined solely by client ID comparison. Because client IDs are unique and the comparison is a total order, there is exactly one valid position for every item. No matter when or in what order items arrive, every replica that has received the same set of items will place them in the same order.',
        {
          type: 'note',
          text: 'The YATA paper -- "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types" by Nicolaescu, Jahns, Derntl, and Klamma (ACM GROUP 2016) -- proves strong eventual consistency: any two replicas that have received the same set of operations are in the same state. The proof is by induction on the number of integrated items. The rightOrigin field is an improvement over the original YATA algorithm that narrows the conflict window and improves performance when many concurrent inserts target the same position.',
        },
        'Deletions converge because they are represented as ranges in the delete set, not as separate operations. Marking (client: 42, clock: 7) as deleted is idempotent -- doing it twice changes nothing. The deleted flag on the Item is a one-way latch: once true, it never goes back to false.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'Why it matters'],
          rows: [
            ['Memory per character', '~88 bytes per Item excluding content (id, origins, pointers, info bitfield)', 'On the B4 trace (260K ops, 105K final chars), memory is ~19.7 MB; deleted items occupy space until GC replaces them with lightweight 2-field stubs'],
            ['Insert (local)', 'O(1) amortized: create Item, append to client array, link into list', 'Typing feels instant; the clock increment and pointer updates are constant-time'],
            ['Insert (remote)', 'O(k) where k is the number of concurrent items sharing the same origin', 'In practice k is almost always 1-3; pathological cases (100 users inserting at the same cursor) grow linearly'],
            ['Lookup by ID', 'O(log n) binary search on the client array by clock', 'Fast because items per client are stored sorted and contiguous'],
            ['State vector', 'O(c) where c is the number of distinct clients', 'Typical documents have 1-50 clients; state vectors are tiny'],
            ['Update encoding', 'O(s) where s is the number of structs to encode', 'Binary encoding is compact: variable-length integers, run-length on client IDs, delta-coded clocks'],
            ['Garbage collection', 'Replaces Item with GC struct: same clock range, no content or origins', 'Reduces memory but is irreversible; cannot merge with peers who still need the deleted content for integration'],
          ],
        },
        'The dominant cost at scale is metadata retention. Every character ever typed -- including deleted characters -- stays in the struct store as either an Item or a GC struct until the document is rebuilt. On the B4 trace, 259,778 operations produce only 10,971 Item structs (96% reduction via merging), using 19.7 MB of memory. The encoded document is 159,929 bytes -- about 53% overhead above the raw 104,852-character text. For comparison, Automerge 2.0 on the same trace uses 44.5 MB memory and takes 46x longer to parse.',
        'Binary updates use LEB128 variable-length integer encoding. V1 writes everything to a single stream. V2 uses column-oriented compression: separate streams for client IDs (run-length encoded), clocks (delta + RLE encoded), info bytes (RLE), and strings (deduplicated), then concatenates them at output. V2 compresses significantly better for large bulk updates; V1 is more efficient for individual keystrokes. The mergeUpdates function combines many small updates into one without loading a Y.Doc -- but it does not GC deleted content. Full GC requires loading into a Y.Doc.',
        {
          type: 'table',
          headers: ['Library', 'Apply time', 'Doc size', 'Parse time', 'Memory', 'Bundle (gzip)'],
          rows: [
            ['Yjs', '5,714 ms', '159,929 B', '39 ms', '3.2 MB', '20 KB'],
            ['Automerge 2.0', '14,326 ms', '129,116 B', '1,805 ms', 'WASM-managed', '604 KB'],
            ['Loro', '3,089 ms', '258,228 B', '13 ms', 'WASM-managed', '399 KB'],
          ],
        },
        'Automerge 2.0 produces smaller documents (columnar encoding) but pays 46x in parse time. Loro is faster to apply but produces larger documents. Yjs has the smallest JavaScript bundle at 20 KB gzipped -- 30x smaller than Automerge. These numbers are from crdt-benchmarks on the B4 trace (Node 20, Intel i5-8400).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two users, Alice (client 1) and Bob (client 2), start with an empty Y.Text. Both type simultaneously.',
        {
          type: 'table',
          headers: ['Step', 'Actor', 'Operation', 'Struct store state', 'State vector'],
          rows: [
            ['1', 'Alice', 'insert "H" at position 0', 'Client 1: [{id:(1,0), content:"H", origin:null, rightOrigin:null}]', '{1:1}'],
            ['2', 'Alice', 'insert "i" at position 1', 'Client 1: [{id:(1,0), "H"}, {id:(1,1), "i", origin:(1,0)}]', '{1:2}'],
            ['3', 'Bob (offline)', 'insert "Y" at position 0', 'Client 2: [{id:(2,0), content:"Y", origin:null, rightOrigin:null}]', '{2:1}'],
            ['4', 'Bob (offline)', 'insert "o" at position 1', 'Client 2: [{id:(2,0), "Y"}, {id:(2,1), "o", origin:(2,0)}]', '{2:1, note: not yet synced}'],
            ['5', 'Sync', 'Alice receives Bob\'s update', 'Both items have origin:null -- tie-break by client ID. Client 1 < 2, so Alice\'s "H" goes first.', '{1:2, 2:2}'],
            ['6', 'Result', 'Both replicas converge', 'Linked list order: H -> i -> Y -> o. Document reads "HiYo"', '{1:2, 2:2}'],
          ],
        },
        'At step 5, the YATA algorithm resolves the conflict. Both "H" (client 1, clock 0) and "Y" (client 2, clock 0) have origin:null -- they were both inserted at the start of an empty document. The tie-breaking rule places the item with the lower client ID first: client 1 < client 2, so "H" goes before "Y".',
        'If Bob had received Alice\'s update first instead, the same tie-breaking rule would produce the same result. That is the convergence guarantee: order of delivery does not affect the final document.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Yjs wins when applications need collaborative editing without depending on a central authority to serialize operations.',
        {
          type: 'bullets',
          items: [
            'Collaborative text editors: Tiptap, BlockNote, Lexical, ProseMirror, CodeMirror, and Monaco all have Yjs bindings. The editor fires local operations; Yjs turns them into Items; a provider moves the updates.',
            'Whiteboard and design tools: Excalidraw uses Yjs for real-time collaboration on canvas objects. Each shape is a Y.Map entry; concurrent moves and resizes merge through the struct store.',
            'Local-first applications: apps like AnyType and AppFlowy use Yjs to let users edit offline and sync later. The state vector protocol means reconnection transfers only missing edits, not the full document.',
            'Multiplayer UI state: shared cursors, selections, and presence indicators use the Yjs awareness protocol -- a lightweight CRDT for ephemeral state that piggybacks on the same provider connection.',
            'Database sync layers: projects like SyncedStore and TinyBase build reactive data stores on top of Yjs shared types, using them as the replication engine for structured application data.',
          ],
        },
        'The provider model is the key architectural advantage. The same Y.Doc can sync through y-websocket to a server, y-webrtc to peers, y-indexeddb for offline persistence, and a custom provider for cloud storage -- simultaneously. Providers are interchangeable because they all move the same binary updates. Swapping WebSocket for WebRTC requires changing one provider constructor, not rewriting the document model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Yjs is a merge engine, not an authorization system. A structurally valid update can carry malicious content, and the CRDT layer will integrate it happily. Access control must happen at the provider layer -- before updates enter the document room.',
        {
          type: 'table',
          headers: ['Anti-pattern', 'What breaks', 'Mitigation'],
          rows: [
            ['No GC on long-lived docs', 'Memory and storage grow without bound as deleted Items accumulate', 'Periodic GC with awareness of offline peer clocks; snapshot the doc and reset'],
            ['Mixing V1 and V2 update formats', 'Peers using different encodings cannot decode each other\'s updates', 'Pin the update format version across all clients and providers'],
            ['Provider invents its own ordering', 'Server reorders or deduplicates updates using app-specific logic, breaking CRDT invariants', 'Providers must be dumb pipes: persist, relay, broadcast -- never rewrite'],
            ['Treating awareness as durable', 'Cursor positions and presence stored as if they were document state', 'Awareness is ephemeral (timeout-based); document updates are the only durable input'],
            ['Storing large blobs in Y.Text', 'Each character is an Item with ~50-100 bytes overhead; a 10 MB image as text is catastrophic', 'Store binary data externally; keep a reference (URL or hash) in the shared type'],
            ['Trusting client IDs for auth', 'Client IDs are random integers, not authenticated identities', 'Authenticate at the transport layer; client IDs are for CRDT ordering, not security'],
          ],
        },
        'The deepest production hazard is garbage collection timing. GC replaces deleted Items with lightweight GC structs that preserve the clock range but discard content and origin pointers. If a slow or offline peer still needs those origin pointers to integrate a pending insert, the integration fails. The safe rule: never GC structs that any connected or expected peer might still reference. In practice, this means GC is only safe when all peers have caught up past the deleted clocks.',
        {
          type: 'note',
          text: 'Yjs GC is irreversible. Once an Item becomes a GC struct, its content and origin pointers are gone. Undo history that references GC\'d items will produce unexpected results. Applications that need undo across GC boundaries must snapshot before collecting.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Yjs repository at https://github.com/yjs/yjs (especially src/structs/Item.js, src/utils/StructStore.js, src/utils/encoding.js), the INTERNALS.md at https://github.com/yjs/yjs/blob/main/INTERNALS.md, the official API docs at https://docs.yjs.dev/, and the sync protocol specification at https://github.com/yjs/y-protocols.',
        'The YATA algorithm is described in "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types" by Nicolaescu, Jahns, Derntl, and Klamma (ACM GROUP 2016, DOI 10.1145/2957276.2957310). Kevin Jahns\' blog post "Are CRDTs suitable for shared editing?" at https://blog.kevinjahns.de/ provides the B4 benchmark analysis. The B4 trace itself comes from Martin Kleppmann\'s crdt-benchmarks at https://github.com/dmonad/crdt-benchmarks.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Sequence CRDTs for Collaborative Text -- the theory of conflict-free replicated sequences that Yjs implements.',
            'Prerequisite: Delta-State CRDT Anti-Entropy -- the sync protocol pattern that state vectors and update diffs follow.',
            'Extension: Automerge Change Graph and Columnar Storage -- a contrasting CRDT implementation that uses a DAG of changes instead of a flat struct store.',
            'Extension: Collaborative Awareness Presence CRDT -- the ephemeral presence protocol that runs alongside Yjs document sync.',
            'Extension: Collaborative Undo/Redo Intention Stack -- how undo works in a multi-user CRDT where "my last action" is interleaved with remote edits.',
            'Case study: Local-First Sync Engine -- the architectural pattern that Yjs enables: compute locally, sync in the background, converge eventually.',
          ],
        },
      ],
    },
  ],
};

