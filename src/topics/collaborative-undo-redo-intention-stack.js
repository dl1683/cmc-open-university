// Collaborative undo/redo: selective local undo over CRDT/OT documents using
// scopes, origins, inverse patches, redo stacks, and cursor metadata.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'collaborative-undo-redo-intention-stack',
  title: 'Collaborative Undo/Redo Intention Stack',
  category: 'Systems',
  summary: 'Why undo in collaborative editors needs scopes, origins, inverse operations, capture windows, redo stacks, and intent-aware repair.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['selective undo', 'history repair'], defaultValue: 'selective undo' },
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

function undoGraph(title) {
  return graphState({
    nodes: [
      { id: 'txn', label: 'txn', x: 0.8, y: 4.1, note: 'local edit' },
      { id: 'origin', label: 'origin', x: 2.2, y: 4.9, note: 'source tag' },
      { id: 'scope', label: 'scope', x: 2.2, y: 3.3, note: 'types' },
      { id: 'doc', label: 'doc', x: 3.8, y: 4.1, note: 'shared' },
      { id: 'undo', label: 'undo stack', x: 5.5, y: 4.9, note: 'inverse' },
      { id: 'redo', label: 'redo stack', x: 5.5, y: 3.3, note: 'replay' },
      { id: 'remote', label: 'remote', x: 7.2, y: 4.1, note: 'skip' },
      { id: 'cursor', label: 'cursor', x: 8.6, y: 4.9, note: 'meta' },
      { id: 'view', label: 'view', x: 9.5, y: 4.1, note: 'restore' },
    ],
    edges: [
      { id: 'e-txn-origin', from: 'txn', to: 'origin' },
      { id: 'e-txn-scope', from: 'txn', to: 'scope' },
      { id: 'e-origin-doc', from: 'origin', to: 'doc' },
      { id: 'e-scope-doc', from: 'scope', to: 'doc' },
      { id: 'e-doc-undo', from: 'doc', to: 'undo' },
      { id: 'e-undo-redo', from: 'undo', to: 'redo' },
      { id: 'e-remote-doc', from: 'remote', to: 'doc' },
      { id: 'e-undo-cursor', from: 'undo', to: 'cursor' },
      { id: 'e-cursor-view', from: 'cursor', to: 'view' },
    ],
  }, { title });
}

function repairGraph(title) {
  return graphState({
    nodes: [
      { id: 'alice', label: 'Alice', x: 0.8, y: 4.1, note: 'insert X' },
      { id: 'bob', label: 'Bob', x: 2.3, y: 4.9, note: 'edit near X' },
      { id: 'history', label: 'history', x: 4.0, y: 4.1, note: 'causal DAG' },
      { id: 'target', label: 'target', x: 5.6, y: 4.9, note: 'undo item' },
      { id: 'inverse', label: 'inverse', x: 5.6, y: 3.3, note: 'patch' },
      { id: 'transform', label: 'repair', x: 7.3, y: 4.1, note: 'rebase' },
      { id: 'apply', label: 'apply', x: 8.7, y: 4.9, note: 'new op' },
      { id: 'result', label: 'result', x: 9.6, y: 4.1, note: 'intent' },
    ],
    edges: [
      { id: 'e-alice-history', from: 'alice', to: 'history' },
      { id: 'e-bob-history', from: 'bob', to: 'history' },
      { id: 'e-history-target', from: 'history', to: 'target' },
      { id: 'e-target-inverse', from: 'target', to: 'inverse' },
      { id: 'e-inverse-transform', from: 'inverse', to: 'transform' },
      { id: 'e-history-transform', from: 'history', to: 'transform' },
      { id: 'e-transform-apply', from: 'transform', to: 'apply' },
      { id: 'e-apply-result', from: 'apply', to: 'result' },
    ],
  }, { title });
}

function* selectiveUndo() {
  const undoNodes = 9;
  const undoEdges = 9;
  const managerFields = 5;

  yield {
    state: undoGraph('Undo tracks local transactions by scope and origin'),
    highlight: { active: ['txn', 'origin', 'scope', 'doc', 'e-txn-origin', 'e-txn-scope', 'e-origin-doc', 'e-scope-doc'], compare: ['remote'] },
    explanation: `The first rule is selective undo. Across ${undoNodes} pipeline nodes, pressing Undo should usually target this user's recent local transaction in a chosen scope, not the last global operation someone happened to append.`,
  };

  yield {
    state: undoGraph('A stack item stores an inverse patch'),
    highlight: { active: ['doc', 'undo', 'e-doc-undo'], found: ['redo'] },
    explanation: `A stack item stores enough inverse information to express the undo later. Linked by ${undoEdges} edges, the collaborative document targets stable CRDT items or operation identities, not a whole old snapshot.`,
    invariant: `Undo is another edit, not time travel — the ${undoNodes}-node pipeline always moves forward.`,
  };

  yield {
    state: undoGraph('Remote edits change the document but not your undo stack'),
    highlight: { active: ['remote', 'doc', 'e-remote-doc'], compare: ['undo'] },
    explanation: `Remote edits change the document context across ${undoEdges} edges, so they affect how an inverse must be repaired. They should not become your personal undo target. Origins and tracked-origin filters encode that boundary.`,
  };

  yield {
    state: undoGraph('Redo replays the inverse of the inverse'),
    highlight: { active: ['undo', 'redo', 'doc', 'e-undo-redo', 'e-doc-undo'], found: ['cursor'] },
    explanation: `After undo, redo stack items let the user restore the change. The editor can attach metadata across ${managerFields} tracked fields such as cursor location, scroll position, or selected block to make the UI return to a useful place.`,
  };

  yield {
    state: labelMatrix(
      'Undo manager fields',
      [
        { id: 'scope', label: 'scope' },
        { id: 'origin', label: 'origin' },
        { id: 'capture', label: 'capture window' },
        { id: 'inverse', label: 'inverse data' },
        { id: 'meta', label: 'meta' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['shared types', 'which edits count'],
        ['source tag', 'local vs remote'],
        ['time grouping', 'one word not one key'],
        ['reverse patch', 'apply undo'],
        ['cursor/view', 'restore UX'],
      ],
    ),
    highlight: { active: ['scope:why', 'origin:why', 'capture:why', 'meta:why'], compare: ['inverse:stores'] },
    explanation: `This table is the undo manager contract across ${managerFields} fields: scope chooses what can be undone, origin chooses whose changes count, capture windows group intent, inverse data applies the repair, and metadata restores the user's place.`,
  };
}

function* historyRepair() {
  const repairNodes = 8;
  const repairEdges = 8;
  const pitfallCount = 4;

  yield {
    state: repairGraph('The target edit may no longer sit in the same context'),
    highlight: { active: ['alice', 'bob', 'history', 'e-alice-history', 'e-bob-history'], compare: ['target'] },
    explanation: `This is the hard case across ${repairNodes} repair stages. Alice wants to remove her earlier contribution, but Bob has since edited around it. Undo must preserve Bob's later work whenever the structure still makes that possible.`,
  };

  yield {
    state: repairGraph('Undo chooses a target and builds an inverse'),
    highlight: { active: ['history', 'target', 'inverse', 'e-history-target', 'e-target-inverse'], compare: ['bob'] },
    explanation: `The undo manager identifies the stack item and constructs an inverse operation through ${repairEdges} edges. In CRDT systems that may mean deleting specific item ids; in OT systems it may mean transforming a reverse operation through later edits.`,
  };

  yield {
    state: repairGraph('The inverse is repaired against current history'),
    highlight: { active: ['inverse', 'history', 'transform', 'e-inverse-transform', 'e-history-transform'], found: ['apply'] },
    explanation: `The repair step rebases the inverse against current history across ${repairNodes} pipeline stages. Plain text may only need stable IDs; rich text, comments, nested objects, and marks need extra semantics so the inverse still matches the original intention.`,
  };

  yield {
    state: repairGraph('Undo applies as a new operation'),
    highlight: { active: ['transform', 'apply', 'result', 'e-transform-apply', 'e-apply-result'], compare: ['target'] },
    explanation: `Undo is appended as a new operation through the ${repairEdges}-edge pipeline. That is why other replicas can receive it through normal sync and converge. The system does not roll back global history; it adds a compensating edit.`,
    invariant: `Collaborative undo should preserve other users' later work when possible — the ${repairNodes}-node repair path enforces that.`,
  };

  yield {
    state: labelMatrix(
      'Undo pitfalls',
      [
        { id: 'global', label: 'global last undo' },
        { id: 'snapshot', label: 'snapshot revert' },
        { id: 'remote', label: 'remote tracked' },
        { id: 'rich', label: 'rich text' },
      ],
      [
        { id: 'failure', label: 'failure' },
        { id: 'fix', label: 'better control' },
      ],
      [
        ['undoes Bob', 'origin filters'],
        ['drops later work', 'inverse ops'],
        ['pollutes local stack', 'tracked origins'],
        ['bad mark repair', 'range semantics'],
      ],
    ),
    highlight: { removed: ['global:failure', 'snapshot:failure', 'remote:failure'], active: ['global:fix', 'snapshot:fix', 'rich:fix'] },
    explanation: `All ${pitfallCount} naive versions work in a single-user editor and fail in collaboration. Global undo targets the wrong person, snapshot revert erases later work, and remote tracking pollutes the local stack. The fix is intention metadata plus inverse operations.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'selective undo') yield* selectiveUndo();
  else if (view === 'history repair') yield* historyRepair();
  else throw new InputError('Pick a collaborative undo view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization runs two views. The selective-undo view shows a document shared between two users, Alice and Bob. Each local edit passes through origin and scope filters before it enters Alice\'s undo stack. Remote edits from Bob change the document but never appear on Alice\'s stack. Watch the filters reject Bob\'s operations while accepting Alice\'s. The undo and redo stacks sit beside the document, not behind it, because they represent a personal command history rather than the shared operation log.',
        'The history-repair view shows the harder half. Alice presses undo, and the manager retrieves an old inverse. That inverse was computed against an earlier version of the document. Later edits from Bob may have shifted positions, split marks, or deleted neighbors. The repair step rebases the inverse so it still targets the original content. After repair, the inverse is applied as a new forward operation. Every replica receives it through normal sync, so no rollback protocol is needed.',
        {type: 'image', src: './assets/gifs/collaborative-undo-redo-intention-stack.gif', alt: 'Animated walkthrough of the collaborative undo redo intention stack visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Use the playback controls to pause on any frame. Pay attention to which operations the filter admits and which it rejects. The repair step is the most important frame: it is the moment where an old inverse is adjusted to fit the present document.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Undo looks simple in a private editor. One user, one cursor, one recent action. A stack remembers the inverse of the last edit. Ctrl+Z means "reverse my last thing." In a collaborative editor, that sentence hides three hard questions: whose last thing, in which part of the document, and against which version of the surrounding context?',
        {type: 'callout', text: 'Collaborative undo appends a repaired inverse of local intent instead of rewinding shared history.'},
        'Collaborative undo exists to preserve local intention without pretending the shared document has a single personal timeline. Alice should be able to undo the paragraph she pasted even if Bob fixed a typo inside it, Cara moved a heading, and a bot added comments. The useful behavior is not "restore my old snapshot." It is "remove or repair the effect of my earlier contribution while keeping later valid work from everyone else."',
        'That is why collaborative editors need an intention stack instead of a plain history stack. The stack tracks local transactions by scope and origin, stores inverse operations over stable identities, groups nearby edits into meaningful units, keeps a redo path, and carries UI metadata such as cursor or selection position. Without those fields, undo becomes either global, destructive, or surprising.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious design is global last-operation undo. Every operation from every user goes into one log, and undo reverses the last entry. This fails immediately. If Bob typed after Alice, Alice pressing undo removes Bob\'s text. The command is correct according to the log and wrong according to the user. Collaboration makes "last" a property of the shared system, while undo is a property of local user intention.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Basicot.png', alt: 'Operational transformation example with concurrent insert and delete operations', caption: 'Concurrent editing diagrams expose why position-based inverse operations must be repaired before they can preserve intention. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Basicot.png.'},
        'The second obvious design is snapshot restore. The editor saves Alice\'s document before each edit and restores that snapshot on undo. That also fails. The snapshot does not contain Bob\'s later edits, remote comments, presence-aware selections, or generated table IDs. Restoring it silently erases work Alice never meant to touch. Snapshot undo is especially dangerous in rich documents because the snapshot includes objects outside the visible text.',
        'The third obvious design is to put every operation that reaches the replica, including remote operations, into Alice\'s local stack. That avoids losing remote history, but it pollutes Alice\'s undo target. She would need to step over provider sync events, bot rewrites, and edits from other people before reaching her own action. A usable collaborative editor needs filters that define which origins count as local undoable intent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'All three obvious approaches share the same structural failure. They assume that an inverse operation, once computed, stays correct forever. It does not. Remote edits change the context under which the inverse was computed. An inverse that was correct when stored may land on the wrong target or erase concurrent work when applied later.',
        'Suppose Alice inserts "World" at position 5 and stores the inverse "delete characters 5-9." Before she presses undo, Bob inserts "Beautiful " at position 5. The document now reads "HelloBeautiful World." Alice\'s stored inverse still says "delete characters 5-9," but those positions now contain Bob\'s text, not Alice\'s. Applying the old inverse destroys Bob\'s contribution and leaves Alice\'s insertion intact. The inverse was correct at the time it was stored. It is wrong now.',
        'This is the wall. Collaborative undo cannot be a simple stack pop. The stack stores inverses against past document states, but the document keeps moving forward. Every remote edit can invalidate the positional assumptions baked into a stored inverse. The system must either recompute the inverse at undo time, transform it through intervening operations, or use identifiers that do not shift when the document changes. Without one of these strategies, undo in a shared editor is fundamentally broken.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Collaborative undo is selective compensation, not time travel. An undo command selects one prior local transaction, constructs the best inverse for that transaction, repairs the inverse against the current document state, and appends the result as a new forward operation. Other replicas receive the undo through the same sync path as any other edit. The global history grows. It is never rewound.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'Undo in a shared editor is easiest to reason about as a graph of transactions, inverses, origins, and repaired apply operations. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Selection requires scope and origin. Scope defines which shared types or regions are being watched: a text object, a canvas layer, a spreadsheet range, or a subtree of a document model. Origin identifies where the transaction came from: keyboard input, paste, drag, AI rewrite, import, migration, remote provider, or system repair. A good undo manager tracks the origins that represent the user\'s command stream and ignores the ones that should not become personal undo items.',
        'Compensation requires stable targets. In CRDT systems, an insertion creates items with identifiers that remain addressable even when later operations move around them or delete neighbors. Undo can delete those specific items by ID, regardless of position drift. In OT systems, a reverse operation is transformed through all later operations so it still lands at the intended position. In rich text and structured documents, the inverse may need semantic repair for marks, comments, embeds, table cells, or object references.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical undo manager watches transactions after they commit. If the transaction touches a tracked scope and has a tracked origin, the manager captures inverse data. It also decides whether this transaction should merge with the previous stack item. Typing five letters in one word should usually become one undo item, not five separate keypresses. That grouping is the capture window. It clusters nearby transactions by time and sometimes by selection continuity or command type.',
        'A stack item stores enough data to produce the inverse later. For plain text CRDTs, that means inserted item identifiers and deleted ranges. For maps or objects, it includes previous field values. For rich text, it includes mark boundaries, attributes, embeds, annotations, or range anchors. The item also stores metadata for the user interface: where the cursor was, what was selected, which block was active, and sometimes what viewport should be restored after the command.',
        'When the user presses undo, the manager pops the most recent item from the undo stack, builds an inverse, repairs it against the current document, applies it as a normal transaction, and pushes a corresponding item onto the redo stack. Redo reverses the undo by applying the inverse of the inverse or replaying stored redo data. Any new local edit after undo normally clears the redo stack because the user has branched away from that redo path.',
        'Remote edits never enter the local stack, but they do affect repair. If Bob changes text inside Alice\'s pasted paragraph, Alice\'s undo must decide whether Bob\'s change is dependent work, neighboring work, or a conflict. The data structure cannot answer every semantic question. It gives the editor the identities and history needed to make the policy explicit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because it separates three histories that are easy to confuse. The shared operation history is the convergence record: every replica agrees on its contents. The local undo stack is a filtered command history: only this user\'s edits in tracked scopes. The visible document is the current materialized state. Undo reads from the local command history, writes to the shared operation history, and updates the visible state through ordinary synchronization. No special rollback channel is needed.',
        'It also works because stable identities make old intent addressable. Position numbers drift in collaborative text because other people insert before them. Object references, CRDT item IDs, relative positions, operation IDs, and semantic anchors survive more changes than raw offsets. The more stable the target, the less repair the undo command needs. The less stable the target, the more the editor must infer from surrounding structure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The memory cost is the inverse stack plus redo stack plus metadata per item. That is usually small compared with the document, but it can grow if transactions capture large deletes, embedded objects, binary payloads, or many rich-text attributes. Production editors often cap stack depth, merge small edits, drop old redo data, or store compact references instead of full payloads. The trade is familiar: more undo fidelity costs more memory and more repair logic.',
        'The implementation cost is higher than local undo because every document type needs an inverse policy. Text insertion is straightforward. Rich text marks are not. Tables, comments, formulas, canvas groups, file attachments, and generated content each raise policy questions. Should undo remove a comment thread if the selected text is removed? Should it preserve a teammate\'s formatting change inside a deleted block? Should an AI rewrite be one undo item or many? These are product semantics encoded as data-structure rules.',
        'The repair step itself adds algorithmic cost. In OT systems, the inverse must be transformed through every operation that happened after the original edit. If the user undoes an edit from 200 operations ago, the system transforms the inverse through all 200. CRDT systems avoid this sequential cost by using stable item IDs, but they pay for tombstone storage and garbage collection instead. Neither approach is free.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Collaborative undo appears in Google Docs, Figma, Notion, Linear, Miro, and most modern shared editors. Any app where multiple people edit a shared artifact and each user expects a personal undo history needs this pattern. The Yjs library provides a built-in UndoManager that tracks origins and scopes against a CRDT document. Automerge offers similar history primitives.',
        'The same pattern appears outside user interfaces. Compensating transactions in distributed databases append a correction record rather than deleting old history. Saga patterns in microservices issue compensating commands when a step fails. Event-sourced systems record a reversal event rather than mutating the log. The common thread is: the past is immutable, so reversal means appending a new operation that counteracts an old one.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If the target of an undo no longer exists, the undo becomes a no-op. Alice deletes a paragraph, Bob also deletes the same paragraph, and Alice presses undo. Her inverse says "re-insert the paragraph," but the system must decide where, because Bob\'s deletion may have changed the surrounding structure. Most editors silently drop the undo or show a warning.',
        'If later work depends on the undone content, undo may remove dependent work or trigger a conflict. Alice inserts a heading, Bob adds three paragraphs under it, and Alice undoes her heading. Should Bob\'s paragraphs become orphaned, get moved, or block the undo? There is no universal right answer. Each editor makes a product-level choice.',
        'Capture window tuning is a constant source of friction. If windows are too aggressive, unrelated edits collapse into one undo item: the user presses undo and loses both a paste and a format change. If windows are too narrow, ordinary typing becomes tedious to undo letter by letter. Good defaults use time gaps (300-500ms) and selection discontinuity to split items, but no heuristic is perfect.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Alice opens a shared document and types "Hello World" at position 0. Her undo manager records one stack item: inverse = delete characters at positions 0-10, or in a CRDT, delete item IDs [id1..id10]. The document reads "Hello World" on both Alice\'s and Bob\'s screens.',
        'Bob places his cursor at position 5 (between "Hello" and " World") and types "Beautiful ". The document now reads "Hello Beautiful World" on both screens. Bob\'s edit is a remote operation from Alice\'s perspective, so her undo stack is unchanged. Her stored inverse still targets her original insertion.',
        'Alice presses undo. With naive position-based undo, her inverse says "delete positions 0-10." That would delete "Hello Beau" and leave "tiful World." Alice\'s text and half of Bob\'s text would be destroyed. This is exactly the wall described above.',
        'With intention-preserving undo, the system looks up the stable identifiers of Alice\'s original items [id1..id10]. Those items are the characters H-e-l-l-o-space-W-o-r-l-d. Bob\'s "Beautiful " has its own item IDs [id11..id20] interleaved at the same region. The undo operation deletes only [id1..id10], leaving Bob\'s "Beautiful " intact. The document after undo reads "Beautiful " (just Bob\'s contribution). Alice removed exactly what she typed, nothing more.',
        'If Alice then presses redo, the system re-inserts [id1..id10] in their original positions relative to the document structure. The document returns to "Hello Beautiful World." The redo item is popped from the redo stack and pushed back to the undo stack. If Alice types something new instead of pressing redo, the redo stack is cleared.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Yjs UndoManager documentation at https://docs.yjs.dev/api/undo-manager is the best starting point for implementation. It covers origin tracking, scope binding, capture timeouts, and stack item structure. The Yjs relative-position API explains how stable references survive remote insertions and deletions. Peritext (Ink & Switch, 2022) formalizes rich-text CRDT semantics, including how marks and annotations interact with undo. Automerge\'s documentation covers history traversal and change dependencies for local-first applications.',
        'Sun and Ellis, "Operational Transformation in Real-Time Group Editors: Issues, Algorithms, and Achievements" (1998), introduced the formal distinction between undo and inverse transformation in concurrent editing. Ressel, Nitsche-Ruhland, and Gunzenhauser, "An Integrating, Transformation-Oriented Approach to Concurrency Control and Undo in Group Editors" (1996), proposed the first OT-based selective undo algorithm.',
        'In this curriculum, study next: CRDTs: Conflict-Free Replicated Data Types, Sequence CRDTs for Collaborative Text, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Yjs Struct Store & Updates, Collaborative Awareness & Presence CRDT, CRDT Snapshot Compaction & Garbage Collection, and Local-First Sync Engine Case Study.',
      ],
    },
  ],
};
