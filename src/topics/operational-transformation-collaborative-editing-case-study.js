// Operational transformation: collaborative editors keep users responsive by
// applying local edits immediately, then transforming remote edits into the
// local coordinate system before applying them.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'operational-transformation-collaborative-editing-case-study',
  title: 'Operational Transformation Collaborative Editing Case Study',
  category: 'Systems',
  summary: 'How Google-Docs-style collaborative editors transform concurrent insert, delete, and style operations so local optimistic edits still converge.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['transform positions', 'revision protocol', 'OT vs CRDT'], defaultValue: 'transform positions' },
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

const base = 'ABCD';
const aliceAfterLocal = 'AXBCD';
const bobAfterLocal = 'ABD';
const converged = 'AXBD';

function transformGraph(title) {
  return graphState({
    nodes: [
      { id: 'base', label: 'ABCD', x: 4.8, y: 0.9, note: 'revision 7' },
      { id: 'aliceOp', label: 'A: ins X@1', x: 1.4, y: 2.8, note: 'local first' },
      { id: 'bobOp', label: 'B: del C@2', x: 8.2, y: 2.8, note: 'local first' },
      { id: 'aliceDoc', label: 'AXBCD', x: 1.4, y: 5.0, note: 'Alice view' },
      { id: 'bobDoc', label: 'ABD', x: 8.2, y: 5.0, note: 'Bob view' },
      { id: 'xformA', label: 'xform', x: 3.6, y: 6.4, note: 'del 2 -> 3' },
      { id: 'xformB', label: 'xform', x: 6.0, y: 6.4, note: 'ins stays 1' },
      { id: 'finalA', label: 'AXBD', x: 3.6, y: 8.0, note: 'Alice final' },
      { id: 'finalB', label: 'AXBD', x: 6.0, y: 8.0, note: 'Bob final' },
    ],
    edges: [
      { id: 'e-base-aliceOp', from: 'base', to: 'aliceOp' },
      { id: 'e-base-bobOp', from: 'base', to: 'bobOp' },
      { id: 'e-aliceOp-aliceDoc', from: 'aliceOp', to: 'aliceDoc' },
      { id: 'e-bobOp-bobDoc', from: 'bobOp', to: 'bobDoc' },
      { id: 'e-bobOp-xformA', from: 'bobOp', to: 'xformA', weight: 'remote' },
      { id: 'e-aliceOp-xformB', from: 'aliceOp', to: 'xformB', weight: 'remote' },
      { id: 'e-aliceDoc-xformA', from: 'aliceDoc', to: 'xformA', weight: 'local' },
      { id: 'e-bobDoc-xformB', from: 'bobDoc', to: 'xformB', weight: 'local' },
      { id: 'e-xformA-finalA', from: 'xformA', to: 'finalA' },
      { id: 'e-xformB-finalB', from: 'xformB', to: 'finalB' },
    ],
  }, { title });
}

function* transformPositions() {
  yield {
    state: transformGraph('Concurrent edits start in the same base coordinates'),
    highlight: { active: ['base', 'aliceOp', 'bobOp'], compare: ['aliceDoc', 'bobDoc'] },
    explanation: `Both editors start from "${base}". Alice inserts X at position 1 while Bob deletes C at position 2. Each client applies its own edit immediately, before the network can serialize anything.`,
    invariant: 'OT keeps local editing optimistic: the user does not wait for a lock or a server round trip.',
  };

  yield {
    state: labelMatrix(
      'Without transformation, coordinates mean different things',
      [
        { id: 'alice', label: 'Alice local' },
        { id: 'naive', label: 'naive remote' },
        { id: 'bob', label: 'Bob local' },
        { id: 'naiveB', label: 'naive remote' },
      ],
      [
        { id: 'doc', label: 'current doc' },
        { id: 'op', label: 'incoming op' },
        { id: 'bad', label: 'bad result' },
      ],
      [
        [aliceAfterLocal, 'del C@2', 'AXB D?'],
        ['pos 2 now B', 'delete wrong', 'AXCD'],
        [bobAfterLocal, 'ins X@1', 'ok here'],
        ['positions shifted', 'maybe lucky', converged],
      ],
    ),
    highlight: { removed: ['alice:bad', 'naive:bad'], compare: ['bob:bad', 'naiveB:bad'] },
    explanation: 'A remote operation was authored against an older document. Position 2 in the base document names C, but after Alice inserted X, position 2 names B. Applying the raw operation can delete the wrong character.',
  };

  yield {
    state: labelMatrix(
      'Transform pair',
      [
        { id: 'aliceRecv', label: 'Alice receives Bob' },
        { id: 'bobRecv', label: 'Bob receives Alice' },
        { id: 'both', label: 'both replicas' },
      ],
      [
        { id: 'local', label: 'local op' },
        { id: 'incoming', label: 'incoming op' },
        { id: 'transformed', label: 'transformed' },
        { id: 'result', label: 'result' },
      ],
      [
        ['ins X@1', 'del C@2', 'del C@3', converged],
        ['del C@2', 'ins X@1', 'ins X@1', converged],
        ['different paths', 'same intent', 'same final', converged],
      ],
    ),
    highlight: { active: ['aliceRecv:transformed', 'bobRecv:transformed'], found: ['both:result'] },
    explanation: 'The transform function rewrites an incoming operation so it is meaningful after the local concurrent operation. Delete C shifts right because Alice inserted before C. Insert X does not shift because Bob deleted after the insertion point.',
    invariant: 'Transform operations, not whole documents: preserve the intended edit while changing its coordinates.',
  };

  yield {
    state: labelMatrix(
      'Real editor operation matrix',
      [
        { id: 'insIns', label: 'insert x insert' },
        { id: 'insDel', label: 'insert x delete' },
        { id: 'delDel', label: 'delete x delete' },
        { id: 'styleIns', label: 'style x insert' },
        { id: 'styleDel', label: 'style x delete' },
      ],
      [
        { id: 'rule', label: 'rule shape' },
        { id: 'risk', label: 'failure if wrong' },
      ],
      [
        ['tie break same pos', 'double order flip'],
        ['shift positions', 'delete wrong char'],
        ['overlap rules', 'delete twice'],
        ['expand or shift', 'style misses text'],
        ['shrink range', 'style deleted text'],
      ],
    ),
    highlight: { active: ['insDel:rule', 'styleIns:rule', 'styleDel:rule'], compare: ['delDel:risk'] },
    explanation: 'The simple insert/delete example is only the first row. Production OT has to define transform pairs for insert, delete, formatting ranges, comments, embeds, undo, and schema-specific operations.',
  };
}

function* revisionProtocol() {
  yield {
    state: graphState({
      nodes: [
        { id: 'clientA', label: 'client A', x: 0.9, y: 3.9, note: 'typing' },
        { id: 'pendingA', label: 'pending', x: 2.4, y: 2.2, note: 'not sent' },
        { id: 'sentA', label: 'sent', x: 2.4, y: 5.6, note: 'await ack' },
        { id: 'server', label: 'server', x: 4.9, y: 3.9, note: 'revision log' },
        { id: 'clientB', label: 'client B', x: 8.9, y: 3.9, note: 'typing' },
        { id: 'pendingB', label: 'pending', x: 7.4, y: 2.2, note: 'not sent' },
        { id: 'sentB', label: 'sent', x: 7.4, y: 5.6, note: 'await ack' },
        { id: 'history', label: 'history', x: 4.9, y: 1.4, note: 'rev 42..' },
        { id: 'ack', label: 'acks', x: 4.9, y: 6.8, note: 'advance rev' },
      ],
      edges: [
        { id: 'e-clientA-pendingA', from: 'clientA', to: 'pendingA' },
        { id: 'e-pendingA-sentA', from: 'pendingA', to: 'sentA' },
        { id: 'e-sentA-server', from: 'sentA', to: 'server' },
        { id: 'e-server-clientB', from: 'server', to: 'clientB', weight: 'remote op' },
        { id: 'e-clientB-pendingB', from: 'clientB', to: 'pendingB' },
        { id: 'e-pendingB-sentB', from: 'pendingB', to: 'sentB' },
        { id: 'e-sentB-server', from: 'sentB', to: 'server' },
        { id: 'e-server-clientA', from: 'server', to: 'clientA', weight: 'remote op' },
        { id: 'e-server-history', from: 'server', to: 'history' },
        { id: 'e-server-ack', from: 'server', to: 'ack' },
        { id: 'e-ack-sentA', from: 'ack', to: 'sentA' },
        { id: 'e-ack-sentB', from: 'ack', to: 'sentB' },
      ],
    }, { title: 'Central revision log plus optimistic clients' }),
    highlight: { active: ['clientA', 'pendingA', 'sentA', 'server', 'history'], compare: ['clientB', 'pendingB', 'sentB'] },
    explanation: 'A practical OT system often has a server that serializes accepted operations into a revision log. Clients still apply local edits instantly, keeping pending and sent-but-unacknowledged operations around for transforms.',
    invariant: 'The server chooses a canonical revision order; clients transform around their own optimistic local history.',
  };

  yield {
    state: labelMatrix(
      'Client and server bookkeeping',
      [
        { id: 'clientRev', label: 'client rev' },
        { id: 'pending', label: 'pending queue' },
        { id: 'inflight', label: 'in flight' },
        { id: 'serverLog', label: 'server log' },
        { id: 'serverDoc', label: 'server doc' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['last server rev', 'knows base'],
        ['new local ops', 'compose later'],
        ['sent, no ack', 'transform remote'],
        ['accepted ops', 'canonical order'],
        ['latest replay', 'snapshots'],
      ],
    ),
    highlight: { active: ['clientRev:stores', 'pending:stores', 'inflight:stores'], found: ['serverLog:stores'] },
    explanation: 'The Google Docs collaboration posts describe this shape: clients track the latest server revision plus local pending and sent changes, while the server keeps a revision log and current document state.',
  };

  yield {
    state: labelMatrix(
      'One round through the protocol',
      [
        { id: 'step1', label: '1 local edit' },
        { id: 'step2', label: '2 send one op' },
        { id: 'step3', label: '3 type more' },
        { id: 'step4', label: '4 remote arrives' },
        { id: 'step5', label: '5 ack arrives' },
      ],
      [
        { id: 'client', label: 'client state' },
        { id: 'server', label: 'server state' },
      ],
      [
        ['apply now', 'unchanged'],
        ['sent queue', 'append if valid'],
        ['pending queue', 'wait for ack'],
        ['xform remote', 'broadcast op'],
        ['drop sent op', 'rev advances'],
      ],
    ),
    highlight: { active: ['step4:client', 'step5:client'], found: ['step2:server', 'step4:server'] },
    explanation: 'The stop-and-wait flavor is easier to reason about: send one outstanding change, keep later local changes pending, transform remote changes over unacknowledged local work, then advance when the ack lands.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'operations per second', min: 0, max: 120 }, y: { label: 'transform pressure', min: 0, max: 100 } },
      series: [
        { id: 'simple', label: 'single op type', points: [{ x: 10, y: 8 }, { x: 50, y: 24 }, { x: 100, y: 48 }] },
        { id: 'rich', label: 'rich editor', points: [{ x: 10, y: 18 }, { x: 50, y: 58 }, { x: 100, y: 92 }] },
      ],
      markers: [
        { id: 'batch', x: 72, y: 50, label: 'batch and compose' },
      ],
    }),
    highlight: { active: ['rich', 'batch'], compare: ['simple'] },
    explanation: 'This conceptual plot shows why production systems compose, batch, snapshot, and aggressively test transform functions. Rich documents multiply the operation pairs that must be correct.',
  };
}

function* otVsCrdt() {
  yield {
    state: labelMatrix(
      'Two ways to make collaboration converge',
      [
        { id: 'coord', label: 'coordinate model' },
        { id: 'operation', label: 'operation shape' },
        { id: 'server', label: 'server role' },
        { id: 'metadata', label: 'metadata' },
        { id: 'rich', label: 'rich text' },
        { id: 'failure', label: 'hard failure' },
      ],
      [
        { id: 'ot', label: 'OT' },
        { id: 'crdt', label: 'CRDT' },
      ],
      [
        ['positions shift', 'stable IDs'],
        ['rewrite ops', 'merge states/ops'],
        ['often central log', 'optional'],
        ['history queues', 'per element IDs'],
        ['transform ranges', 'mark spans'],
        ['bad xform pair', 'metadata blowup'],
      ],
    ),
    highlight: { active: ['coord:ot', 'operation:ot', 'server:ot'], compare: ['coord:crdt', 'metadata:crdt'] },
    explanation: 'OT and sequence CRDTs solve the same user problem with different data-structure choices. OT keeps human-friendly positions and rewrites operations. CRDTs put stable identity into the sequence so operations commute more directly.',
    invariant: 'Neither approach removes product complexity; they move it to different layers.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'ui', label: 'editor UI', x: 0.9, y: 4.0, note: 'typing' },
        { id: 'local', label: 'local buffer', x: 2.5, y: 4.0, note: 'gap/piece/rope' },
        { id: 'op', label: 'operation', x: 4.0, y: 4.0, note: 'insert/delete/style' },
        { id: 'transform', label: 'transform', x: 5.8, y: 2.3, note: 'OT path' },
        { id: 'stableId', label: 'stable ID', x: 5.8, y: 5.7, note: 'CRDT path' },
        { id: 'sync', label: 'sync', x: 7.6, y: 4.0, note: 'network' },
        { id: 'view', label: 'view', x: 9.1, y: 4.0, note: 'converged' },
      ],
      edges: [
        { id: 'e-ui-local', from: 'ui', to: 'local' },
        { id: 'e-local-op', from: 'local', to: 'op' },
        { id: 'e-op-transform', from: 'op', to: 'transform' },
        { id: 'e-op-stableId', from: 'op', to: 'stableId' },
        { id: 'e-transform-sync', from: 'transform', to: 'sync' },
        { id: 'e-stableId-sync', from: 'stableId', to: 'sync' },
        { id: 'e-sync-view', from: 'sync', to: 'view' },
      ],
    }, { title: 'The local editor buffer is still a separate layer' }),
    highlight: { active: ['local', 'op'], found: ['transform', 'stableId'], compare: ['sync'] },
    explanation: 'Gap buffers, piece tables, and ropes optimize local text mutation. OT or CRDT logic optimizes replicated order. A serious editor usually has both layers, plus schema, undo, cursors, permissions, and persistence.',
  };

  yield {
    state: labelMatrix(
      'Choosing the branch',
      [
        { id: 'central', label: 'central SaaS doc' },
        { id: 'localFirst', label: 'local-first notes' },
        { id: 'json', label: 'shared JSON app' },
        { id: 'whiteboard', label: 'whiteboard' },
        { id: 'richDoc', label: 'rich document' },
      ],
      [
        { id: 'leans', label: 'often leans' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['OT or hybrid', 'server log already exists'],
        ['CRDT', 'offline peer sync'],
        ['OT via ShareDB', 'JSON ops'],
        ['CRDT/hybrid', 'object IDs'],
        ['either', 'marks are hard'],
      ],
    ),
    highlight: { active: ['central:leans', 'json:leans'], compare: ['localFirst:leans', 'richDoc:reason'] },
    explanation: 'The right design follows product constraints. A central browser editor can make OT practical. A local-first app often accepts CRDT metadata to reduce coordination. Rich documents are hard in both worlds.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'ot', label: 'this page' },
        { id: 'seq', label: 'Sequence CRDTs' },
        { id: 'peritext', label: 'Peritext' },
        { id: 'piece', label: 'Piece Table' },
        { id: 'clock', label: 'Logical Clocks' },
      ],
      [
        { id: 'question', label: 'question answered' },
        { id: 'next', label: 'next link' },
      ],
      [
        ['how transform ops?', 'protocol'],
        ['how use stable IDs?', 'rich text'],
        ['how merge spans?', 'ranges'],
        ['how edit locally?', 'buffers'],
        ['what is concurrent?', 'causality'],
      ],
    ),
    highlight: { found: ['seq:next', 'peritext:question', 'piece:question', 'clock:next'] },
    explanation: 'Use the links as a loop, not a ladder. Collaboration mixes ordering theory, local buffer data structures, network protocol, range indexes, and product-specific semantics.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'transform positions') yield* transformPositions();
  else if (view === 'revision protocol') yield* revisionProtocol();
  else if (view === 'OT vs CRDT') yield* otVsCrdt();
  else throw new InputError('Pick an operational transformation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Operational Transformation, usually shortened to OT, is a concurrency-control technique for collaborative editing. The core problem is that users edit immediately on their own local copies, so a remote operation may arrive in a coordinate system that no longer matches the local document. OT rewrites that operation so it preserves the author\'s intent after the local concurrent edits have already happened.',
        'A plain example is enough to see the need. Alice inserts X into "ABCD" at position 1 while Bob deletes C at position 2. If Alice later applies Bob\'s raw delete-at-2 operation, she can delete the wrong character because her local insert shifted the document. The transform function changes Bob\'s delete from position 2 to position 3 before Alice applies it. Bob transforms Alice\'s insertion in the other direction. Both replicas converge to "AXBD".',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An OT system represents edits as operations: insert text at a position, delete a range, apply a style to a range, update an object field, and so on. When two operations are concurrent, the transform function takes one operation and another operation that already happened locally, then returns an equivalent operation in the new coordinate system. The transformed operation should have the same human intent even though the numeric positions changed.',
        'In a client-server editor, the server commonly serializes accepted operations into a revision log. A client tracks the latest server revision it has seen, operations made locally but not yet sent, and operations sent but not yet acknowledged. Incoming remote operations are transformed against the client\'s unacknowledged local operations before being applied. This is the protocol shape described in the 2010 Google Docs collaboration posts, with a server-side revision log and client-side pending/sent queues.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The difficult part is not the first insert/delete demo. The difficult part is the operation matrix. Insert must transform against insert, delete, and style. Delete must transform against overlapping deletes and style ranges. Style ranges may expand across inserted text or shrink around deleted text. Rich documents add comments, links, embeds, tables, suggestions, undo, cursor positions, and schema constraints. Every pair needs rules that converge and preserve intent.',
        'OT therefore concentrates complexity in transform functions, revision bookkeeping, operation composition, acknowledgement handling, and extensive adversarial testing. A central server can make the protocol easier because it provides a canonical revision order, but clients still need local optimism to keep typing responsive. Offline editing and long-lived forks make the transform history deeper and the edge cases sharper.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a browser word processor. The local editor buffer may be a Piece Table Text Buffer or Text Rope Data Structure so typing, undo, and viewport rendering stay fast. Each UI transaction becomes a semantic operation such as insert text, delete text, or apply bold to a range. The client applies the operation immediately, records it in a pending or sent queue, and sends it to the server with the revision number it was based on.',
        'The server accepts operations in one order, appends them to a revision log, updates the server document, and broadcasts each accepted operation to other clients. When a client receives a remote operation, it transforms that operation over its own unacknowledged local operations, applies the transformed result to the local buffer, and advances its revision state when acknowledgements arrive. The user sees responsive local typing, while every editor eventually replays a compatible history.',
        'ShareDB is a modern JavaScript example in the broader OT family for realtime JSON document collaboration. It delegates conflict management to OT type plugins, with JSON0 as the default type. That product shape is useful because it separates the backend coordination layer, document type semantics, persistence adapters, query subscriptions, and presence from the transform rules themselves.',
      ],
    },
    {
      heading: 'OT versus CRDTs',
      paragraphs: [
        'OT and Sequence CRDTs for Collaborative Text attack the same problem from opposite directions. OT keeps operations in human-facing positions and rewrites coordinates when histories diverge. A sequence CRDT gives inserted elements stable identifiers so concurrent operations can be merged with less reliance on a central transform server. OT pays in transform-function complexity and protocol bookkeeping. CRDTs pay in per-element metadata, tombstones or equivalent causal structure, and compaction work.',
        'Neither approach is a magic editor. Peritext Rich-Text CRDT Case Study shows that CRDTs still need a rich-text mark model. OT systems also need explicit transform rules for style ranges and rich document objects. Both approaches still sit above local buffer structures such as Gap Buffer Text Editor, Piece Table Text Buffer, and Text Rope Data Structure, and both need Logical Clocks-style reasoning about which operations are concurrent.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that OT is just diffing documents. It is not. Diffing compares two finished versions and tries to infer edits; OT preserves and transforms the actual operations users performed. The Google Docs posts explicitly contrast the older version-comparison approach with the newer revision-log approach.',
        'The second misconception is that convergence alone is enough. A transform function can make every replica agree while still violating user intent, for example by deleting the wrong character or extending a style range incorrectly. The third misconception is that a central server removes all hard cases. It gives a canonical order, but clients still have pending local edits, acknowledgements, reconnection, undo, and rich document semantics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and high-quality sources: Sun and Ellis, Operational Transformation in Real-Time Group Editors, at https://dl.acm.org/doi/10.1145/289444.289469; Jupiter collaboration system paper at https://dl.acm.org/doi/10.1145/215585.215706 and a PDF mirror at https://lively-kernel.org/repository/webwerkstatt/projects/Collaboration/paper/Jupiter.pdf; Apache Wave OT whitepaper at https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html; Google Docs conflict-resolution post at https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs_22.html; Google Docs collaboration protocol post at https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs.html; ShareDB docs at https://share.github.io/sharedb/ and repository at https://github.com/share/sharedb.',
        'Study next: Sequence CRDTs for Collaborative Text, Peritext Rich-Text CRDT Case Study, Local-First Sync Engine Case Study, Collaborative Undo/Redo Intention Stack, Collaborative Awareness Presence CRDT, CRDTs, Logical Clocks, Gap Buffer Text Editor, Piece Table Text Buffer, Text Rope Data Structure, Interval Tree, Segment Tree, and Fractional Indexing & LexoRank Case Study.',
      ],
    },
  ],
};
