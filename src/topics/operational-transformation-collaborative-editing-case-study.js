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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows operational transformation, usually called OT. OT is a method for collaborative editing where each user applies local edits immediately, then rewrites remote edits so they still mean the right thing after concurrent local changes.',
        'Active nodes are operations being applied or transformed. Compare nodes are concurrent operations with different base versions. Found nodes are transformed operations that preserve intent. Removed nodes are stale coordinates that would edit the wrong character if applied directly.',
        'The safe inference rule is coordinate translation. An operation such as insert X at position 1 is valid relative to the document version where it was created. If another operation changed positions first, the incoming operation must be translated before it runs.',
        {type:'callout', text:'OT works by translating remote operations from their original base version into the current local coordinate system, preserving intent without locking editors.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/58/Basicot.png', alt:'Diagram showing concurrent edits transformed so replicated documents converge.', caption:'Basic operational transformation example, by Nusnus, CC BY-SA 3.0 or GFDL, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Collaborative editors need local responsiveness and shared convergence at the same time. A user expects typing to appear immediately, even if the network is slow and another user is editing nearby. The replicas still need to end at the same document.',
        'A document operation is an edit with intent and a base version. Insert, delete, style change, table merge, and object move are not just byte patches. They are actions authored against a specific document state.',
        'OT exists because concurrent edits shift coordinates. If Alice inserts text before Bob deletes, the original Bob position may now point at the wrong character. The system must preserve what Bob meant, not only replay what Bob typed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is locking. Let one user edit a document, paragraph, row, or object at a time. That can be correct, but it destroys the feel of a shared live editor.',
        'Another approach is final-state diffing. Let everyone edit freely, compare document versions later, and merge the diffs. That works better for source control with human review than for live keystrokes.',
        'Diffing loses operation intent. A final diff cannot always tell whether a deletion meant to remove the old C, the newly inserted X, a formatting mark, or the target of an undo operation. OT keeps operations and transforms them while intent is still visible.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is concurrent coordinate drift. Alice and Bob both start with ABCD. Alice inserts X after A, producing AXBCD. Bob deletes C, which was position 2 in the original document.',
        'If Alice applies the Bob delete at position 2 without transformation, she deletes B, not C. The Bob operation was correct in its base version and wrong in the Alice current coordinate system.',
        'Rich documents make the wall larger. Text ranges, marks, comments, tables, embeds, selections, and undo history all need transform rules. A collaborative editor is only as correct as its operation matrix.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Transform a remote operation through concurrent local operations before applying it. The transformed operation should produce the effect the author intended, but in the current local document coordinates.',
        'For text, the rules are position rules. An insert before my position shifts me right. A delete before my position shifts me left. Concurrent inserts at the same position need a deterministic tie-breaker. Overlapping deletes must not delete the same character twice.',
        'A central server can choose a canonical operation order. Clients apply local edits optimistically, send operations to the server, and transform remote operations over any local work that the server has not acknowledged yet.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client stores the latest server revision it has seen, a sent operation waiting for acknowledgement, and a queue of later local operations. The user sees local edits immediately because the editor applies them before the server responds.',
        'When a remote operation arrives, the client checks which local operations have already changed the local view but are not yet part of the remote operation base. It transforms the remote operation over those local operations, then applies the transformed result.',
        'When the server acknowledgement arrives, the client removes the acknowledged operation from the sent slot and advances its revision. More aggressive systems batch and compose operations, but the bookkeeping problem remains base versions plus transform rules.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two goals: convergence and intention preservation. Convergence means all replicas end with the same document after receiving the same accepted operations. Intention preservation means each accepted operation still edits the logical content its author meant.',
        'Transform rules preserve the coordinate invariant. Before applying a remote operation, its positions must refer to the current local document, not to an older base. If every client and server uses compatible rules, operation replay stays equivalent to the server order plus local optimistic edits.',
        'Convergence alone is not enough. A bad transform can make every replica agree on the same wrong text. Mature OT systems use algebraic properties, operation-pair tests, randomized concurrent edits, and divergence checks to catch bad rules.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost depends on how much concurrent history an operation crosses. If a remote edit must transform over 5 pending local edits, cost is small. If an offline client reconnects with 2,000 edits, rebasing can become expensive.',
        'The specification cost is larger. Each operation type needs rules against every other operation type. Insert against delete is simple. Delete against overlapping delete, style range against pasted block, table merge against text insert, and undo against remote delete are where bugs live.',
        'Systems reduce cost by composing adjacent operations, snapshotting documents, limiting offline branches, and using efficient local buffers such as ropes or piece tables. Those help performance but do not remove the need for correct transform semantics.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OT fits centralized collaborative products where low-latency local editing matters and a service can maintain the canonical revision log. Shared documents, spreadsheets, JSON applications, and some design tools use this shape.',
        'ShareDB is a JavaScript example of an OT backend for realtime JSON documents. Document types define the operation semantics, and the server orders accepted operations.',
        'OT also fits products that already trust a central service for storage, permissions, and history. The central order simplifies reasoning compared with peer-to-peer offline collaboration.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when there is no trusted ordering service and offline peer-to-peer editing is the main requirement. Sequence CRDTs often fit that shape better because operations commute through stable element identities rather than position rewrites.',
        'It fails when the document model evolves faster than transform rules. Rich text, tables, comments, embeds, and undo can create operation interactions that are hard to specify and test.',
        'It fails silently if divergence is not checked. Users may keep editing a corrupted replica. Production systems should sample document hashes, validate structure after replay, and alert on rejected or untransformable operations.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Alice and Bob start with ABCD at revision 10. Alice creates operation A: insert X at position 1. Bob creates operation B: delete one character at position 2, intending to delete C.',
        'Alice applies A locally and sees AXBCD. Bob applies B locally and sees ABD. The server accepts A first at revision 11, then receives B based on revision 10. Before applying B after A, the server transforms B because A inserted before the target of B.',
        'B shifts from delete position 2 to delete position 3. The server document becomes AXBD. Bob receives A and transforms it against his local delete; inserting at position 1 still yields AXBD. Both clients converge while preserving the intent to delete C.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Jupiter collaboration paper, Apache Wave operational transform notes, Google Docs collaboration writeups, and ShareDB documentation. Use them to compare central-server OT protocols and document-type-specific operation rules.',
        'Study Piece Table and Rope for local text buffers, Logical Clocks for causality, Sequence CRDTs for the stable-identifier alternative, Peritext for rich-text CRDT semantics, and Fractional Indexing for collaborative ordering outside plain text.',
      ],
    },
  ],
};
