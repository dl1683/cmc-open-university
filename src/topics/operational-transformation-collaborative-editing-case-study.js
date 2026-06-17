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
        `Operational transformation, usually shortened to OT, is a way to make collaborative editing feel local while still converging across users. Each editor applies the user's own change immediately. The network later delivers other people's changes, and those changes may have been written against an older document. OT rewrites the incoming operation so it means the same thing in the local document's current coordinate system.`,
        `The small example is the whole problem in miniature. Alice and Bob both start with ABCD. Alice inserts X after A, producing AXBCD. Bob deletes C, producing ABD. Bob's delete was written as delete position 2 in the original document, but position 2 in Alice's current document is now B. Alice must transform Bob's delete so it targets position 3. Bob must transform Alice's insert against his local delete. If the transform rules are correct, both users end at AXBD without waiting for locks.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is locking. Let one user edit a paragraph, row, object, or whole document at a time. That is simple and can be correct, but it destroys the experience users expect from a shared editor. People type in the same region, work offline, reconnect, undo, and paste large spans. Waiting for a lock or a server round trip on every keystroke turns collaboration into remote control.`,
        `The next obvious approach is diffing. Let everyone edit freely, compare final document versions, and merge the diffs. That can work for source control with human review. It fails inside a live editor because the system has already lost the operation intent. A final diff does not know whether a deleted character was meant to remove the old C, remove the new X, shrink a bold range, or undo a prior local change. OT keeps the operations themselves and transforms them before applying them.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that an edit is not only a patch to bytes. It is an operation with a base version. Insert X at position 1 means something relative to the document where it was authored. When another concurrent operation has already changed that document, the incoming operation must be translated through the local change. The transform function preserves intent while changing coordinates.`,
        `For text, the transform rules are mostly about positions and ranges. Insert before my position shifts me right. Delete before my position shifts me left. Concurrent inserts at the same position need a deterministic tie-breaker. Overlapping deletes must not delete the same character twice. Rich editors add marks, comments, tables, embeds, schema changes, and undo operations. OT is not one rule; it is a matrix of operation-pair rules that must agree on convergence and intention preservation.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `A practical OT editor usually has three layers. The local editing layer uses a buffer structure such as a gap buffer, piece table, or rope so typing and rendering are fast. The operation layer represents semantic edits: insert text, delete a span, apply a style, move an object, or update a JSON field. The collaboration layer keeps enough history to transform operations that were created from different base revisions.`,
        `In a central-server design, the server maintains a revision log and a current document state. A client stores the latest server revision it has seen, a queue of local operations not yet sent, and a sent operation waiting for acknowledgement. Google described this shape for Docs: clients apply local edits immediately, send changes to the server, and process remote changes as they arrive. The server chooses a canonical order, while clients transform remote operations over their own unacknowledged local work.`,
        `A stop-and-wait protocol makes the state easier to reason about. The client sends one operation, keeps later local edits in a pending queue, and applies them locally anyway. If a remote operation arrives before the acknowledgement, the client transforms that remote operation over the sent operation and any pending operations that already changed the local view. When the acknowledgement arrives, the sent operation is removed from the queue and the client can advance its revision number. More aggressive systems batch and compose operations to reduce network chatter, but the bookkeeping problem is the same.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument starts with a shared base. If two operations are concurrent, neither was authored with knowledge of the other. A transform pair takes the remote operation and the local concurrent operation and returns a remote operation that is valid after the local one. If both clients use compatible transform rules and the server gives every accepted operation a single revision order, each client can replay a history that is equivalent to the server history plus its own optimistic edits.`,
        `Convergence alone is not enough. A bad transform function can make every replica agree on the same wrong document. The stronger goal is intention preservation: an insertion should still insert the intended text at the intended logical place, and a deletion should delete the intended existing content rather than a neighboring character created by someone else. OT systems earn trust through a combination of algebraic properties, exhaustive operation-pair tests, randomized concurrent-edit testing, and production telemetry for divergence.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost of OT is not usually asymptotic in the way a sorting algorithm is. The cost is the amount of concurrent history an operation must cross and the size of the operation matrix. A short pending queue keeps transforms cheap. A long offline branch can force many transforms or a server-side rebase. Rich document operations increase constant factors because one user action may touch text, marks, comments, embedded objects, selections, and undo state.`,
        `The deeper cost is specification. Every operation type needs transform rules against every other operation type. Insert against delete is easy to explain. Delete against overlapping delete, table-cell merge against text insert, style range against pasted block, and undo against remote delete are where bugs live. Mature OT systems compose adjacent operations, compress history, snapshot documents, and test generated operation sequences because manual examples do not cover the edge cases.`,
      ],
    },
    {
      heading: 'Where it is useful and where it fails',
      paragraphs: [
        `OT fits centralized collaborative products where low-latency local editing matters and a service can maintain the canonical revision log. Browser documents, spreadsheets, shared JSON applications, and some design tools can use that shape. ShareDB is a JavaScript example of an OT-based backend for realtime JSON documents, with document types defining the operation semantics.`,
        `OT is a poor fit when offline peer-to-peer editing is the dominant requirement, when there is no trusted ordering service, or when the document model changes faster than the transform rules can be specified. Sequence CRDTs solve the same user problem by giving elements stable identities and making operations commute through metadata rather than through position rewrites. CRDTs have their own costs: identifiers, causal metadata, deleted-element handling, and rich-text mark semantics. The choice is not OT good or CRDT good. It is where the product wants to pay for coordination.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Useful signals include pending queue length, age of sent operations, reconnect rebase count, transform failures by operation pair, server revision lag, document divergence checks, rejected operations, undo conflicts, and the number of remote operations applied while a local edit is unacknowledged. A collaboration system should also sample full-document hashes or structural checks after replay. Silent divergence is worse than a visible reject because users may build more work on a corrupt document.`,
        `When investigating an incident, ask which base revision the bad operation was authored against, which local operations it crossed, which transform pair ran, and whether the server and client agreed on revision order. Most OT bugs are not mysterious; they are missing cases in the operation matrix or stale assumptions about what counts as concurrent.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Google Docs collaboration protocol at https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs.html, Google Docs conflict resolution at https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs_22.html, Apache Wave operational transform notes at https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html, ShareDB docs at https://share.github.io/sharedb/, and the Jupiter collaboration paper. Study Sequence CRDTs for Collaborative Text for the stable-identifier alternative, Peritext Rich-Text CRDT Case Study for mark semantics, Logical Clocks for causality, Piece Table Text Buffer and Text Rope Data Structure for local editing, and Fractional Indexing for collaborative ordering outside plain text next.`,
      ],
    },
  ],
};
