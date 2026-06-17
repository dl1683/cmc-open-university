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
  yield {
    state: undoGraph('Undo tracks local transactions by scope and origin'),
    highlight: { active: ['txn', 'origin', 'scope', 'doc', 'e-txn-origin', 'e-txn-scope', 'e-origin-doc', 'e-scope-doc'], compare: ['remote'] },
    explanation: 'The first rule is selective undo. Pressing Undo should usually target this user\'s recent local transaction in a chosen scope, not the last global operation someone happened to append.',
  };

  yield {
    state: undoGraph('A stack item stores an inverse patch'),
    highlight: { active: ['doc', 'undo', 'e-doc-undo'], found: ['redo'] },
    explanation: 'A stack item stores enough inverse information to express the undo later. In a collaborative document, that usually means targeting stable CRDT items or operation identities, not saving a whole old snapshot.',
    invariant: 'Undo is another edit, not time travel.',
  };

  yield {
    state: undoGraph('Remote edits change the document but not your undo stack'),
    highlight: { active: ['remote', 'doc', 'e-remote-doc'], compare: ['undo'] },
    explanation: 'Remote edits change the document context, so they affect how an inverse must be repaired. They should not become your personal undo target. Origins and tracked-origin filters encode that boundary.',
  };

  yield {
    state: undoGraph('Redo replays the inverse of the inverse'),
    highlight: { active: ['undo', 'redo', 'doc', 'e-undo-redo', 'e-doc-undo'], found: ['cursor'] },
    explanation: 'After undo, redo stack items let the user restore the change. The editor can attach metadata such as cursor location, scroll position, or selected block to make the UI return to a useful place.',
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
    explanation: 'This table is the undo manager contract: scope chooses what can be undone, origin chooses whose changes count, capture windows group intent, inverse data applies the repair, and metadata restores the user\'s place.',
  };
}

function* historyRepair() {
  yield {
    state: repairGraph('The target edit may no longer sit in the same context'),
    highlight: { active: ['alice', 'bob', 'history', 'e-alice-history', 'e-bob-history'], compare: ['target'] },
    explanation: 'This is the hard case. Alice wants to remove her earlier contribution, but Bob has since edited around it. Undo must preserve Bob\'s later work whenever the structure still makes that possible.',
  };

  yield {
    state: repairGraph('Undo chooses a target and builds an inverse'),
    highlight: { active: ['history', 'target', 'inverse', 'e-history-target', 'e-target-inverse'], compare: ['bob'] },
    explanation: 'The undo manager identifies the stack item and constructs an inverse operation. In CRDT systems that may mean deleting specific item ids; in OT systems it may mean transforming a reverse operation through later edits.',
  };

  yield {
    state: repairGraph('The inverse is repaired against current history'),
    highlight: { active: ['inverse', 'history', 'transform', 'e-inverse-transform', 'e-history-transform'], found: ['apply'] },
    explanation: 'The repair step rebases the inverse against current history. Plain text may only need stable IDs; rich text, comments, nested objects, and marks need extra semantics so the inverse still matches the original intention.',
  };

  yield {
    state: repairGraph('Undo applies as a new operation'),
    highlight: { active: ['transform', 'apply', 'result', 'e-transform-apply', 'e-apply-result'], compare: ['target'] },
    explanation: 'Undo is appended as a new operation. That is why other replicas can receive it through normal sync and converge. The system does not roll back global history; it adds a compensating edit.',
    invariant: 'Collaborative undo should preserve other users\' later work when possible.',
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
    explanation: 'The naive versions work in a single-user editor and fail in collaboration. Global undo targets the wrong person, snapshot revert erases later work, and remote tracking pollutes the local stack. The fix is intention metadata plus inverse operations.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Undo looks simple in a private editor because there is one user, one cursor, and one recent action. A normal stack can remember the old document state or the inverse of the last edit. Pressing Ctrl+Z means "reverse my last thing." In a collaborative editor, that sentence hides three hard questions: whose last thing, in which part of the document, and against which version of the surrounding context?',
        'Collaborative undo exists to preserve local intention without pretending the shared document has a single personal timeline. Alice should be able to undo the paragraph she pasted even if Bob fixed a typo inside it, Cara moved a heading, and a bot added comments. The useful behavior is not "restore my old snapshot." It is "remove or repair the effect of my earlier contribution while keeping later valid work from everyone else."',
        'That is why collaborative editors need an intention stack instead of a plain history stack. The stack tracks local transactions by scope and origin, stores inverse operations over stable identities, groups nearby edits into meaningful units, keeps a redo path, and carries UI metadata such as cursor or selection position. Without those fields, undo becomes either global, destructive, or surprising.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The first naive design is global last-operation undo. Every operation from every user is appended to one log, and undo reverses the last entry. This fails immediately. If Bob typed after Alice, Alice pressing undo would remove Bob\'s text. The command would be correct according to the log and wrong according to the user. Collaboration makes "last" a property of the shared system, while undo is usually a property of a local user intention.',
        'The second naive design is snapshot restore. The editor saves Alice\'s document before each edit and restores that snapshot on undo. That also fails. The snapshot does not contain Bob\'s later edits, remote comments, presence-aware selections, generated table IDs, or other concurrent changes. Restoring it can silently erase work that Alice never meant to touch. Snapshot undo is especially dangerous in rich documents because the snapshot includes many objects outside the visible text.',
        'The third naive design is to track every operation that reaches the replica, including remote operations, in Alice\'s local stack. That avoids losing remote history, but it pollutes Alice\'s undo target. Alice would need to step over provider sync events, import jobs, bot rewrites, or edits made by other people before reaching her own action. A usable collaborative editor needs filters that define which origins count as local undoable intent.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that collaborative undo is selective compensation, not time travel. An undo command should select one prior local transaction, construct the best inverse for that transaction, repair that inverse against the current document state, and append the result as a new operation. Other replicas then receive the undo through the same sync path as any other edit. The global history grows; it is not rewound.',
        'Selection requires scope and origin. Scope says which shared types or regions are being watched: a text object, a canvas layer, a spreadsheet range, or a subtree of a document model. Origin says where the transaction came from: keyboard input, paste, drag operation, AI rewrite, import, migration, remote provider, or system repair. A good undo manager tracks the origins that represent the user\'s command stream and ignores the ones that should not become personal undo items.',
        'Compensation requires stable targets. In CRDT systems, an insertion creates items with identifiers that remain addressable even when later operations move around them or delete neighboring items. Undo can delete those specific items. In OT systems, a reverse operation may be transformed through later operations so it still lands in the intended position. In rich text and structured documents, the inverse may need semantic repair for marks, comments, embeds, table cells, or object references.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical undo manager watches transactions after they commit. If the transaction touches a tracked scope and has a tracked origin, the manager captures inverse data. It also decides whether this transaction should merge with the previous stack item. Typing five letters in one word should usually become one undo item, not five separate keypresses. That is the capture window. It groups nearby transactions by time and sometimes by selection continuity or command type.',
        'A stack item stores enough data to produce the inverse later. For plain text CRDTs, that may mean inserted item identifiers and deleted ranges. For maps or objects, it may include previous field values. For rich text, it may include mark boundaries, attributes, embeds, annotations, or range anchors. The item also stores metadata for the user interface: where the cursor was, what was selected, which block was active, and sometimes what viewport should be restored after the command.',
        'When the user presses undo, the manager pops the most recent item from the undo stack, builds an inverse, repairs it against the current document, applies it as a normal transaction, and pushes a corresponding item onto the redo stack. Redo reverses the undo, usually by applying the inverse of the inverse or replaying stored redo data. Any new local edit after undo normally clears the redo stack because the user has branched away from that redo path.',
        'Remote edits do not enter the local stack, but they do affect repair. If Bob changes text inside Alice\'s pasted paragraph, Alice\'s undo must decide whether Bob\'s change is dependent work, neighboring work, or a conflict. The data structure cannot answer every semantic question; it gives the editor the identities and history needed to make the policy explicit.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The selective-undo visual is proving that the stack is not fed by every document change. A local transaction passes through origin and scope filters before it becomes undoable. The remote node still changes the document, but it does not become Alice\'s next undo target. The undo and redo stacks sit beside the document, not behind it, because they represent a user command history rather than the canonical shared operation log.',
        'The repair visual is proving the harder invariant: an inverse must be interpreted in the present. The target edit was made in an older context. Later operations may have inserted around it, deleted part of it, split its marks, or changed the object that held it. The repair step rebases or retargets the inverse so the final apply operation expresses the original intention as well as the current structure allows.',
        'The final apply node is the convergence guarantee. Undo is sent as a new operation with normal causality, so every replica can integrate it without a special rollback protocol. This is why collaborative undo works with CRDT and OT designs: the system preserves a monotonic history while still giving the user a personal command stack.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because it separates three histories that are easy to confuse. The shared operation history is the convergence record. The local undo stack is a filtered command history. The visible document is the current materialized state. Undo reads from the local command history, writes to the shared operation history, and updates the visible state through ordinary synchronization.',
        'It also works because stable identities make old intent addressable. Position numbers drift in collaborative text because other people can insert before them. Object references, CRDT item IDs, relative positions, operation IDs, and semantic anchors survive more changes than raw offsets. The more stable the target, the less repair the undo command needs. The less stable the target, the more the editor must infer from surrounding structure.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The memory cost is the inverse stack plus redo stack plus metadata. That is usually small compared with the document, but it can grow if transactions capture large deletes, embedded objects, binary payloads, or many rich-text attributes. Production editors often cap stack depth, merge small edits, drop old redo data, or store compact references instead of full payloads. The trade is familiar: more undo fidelity costs more memory and more repair logic.',
        'The implementation cost is higher than local undo because every document type needs an inverse policy. Text insertion is straightforward. Rich text marks are not. Tables, comments, formulas, canvas groups, file attachments, and generated content each raise policy questions. Should undo remove a comment thread if the selected text is removed? Should it preserve a teammate\'s formatting change inside a deleted block? Should an AI rewrite be one undo item or many? These are product semantics encoded as data-structure rules.',
      ],
    },
    {
      heading: 'Uses, limits, and failure modes',
      paragraphs: [
        'Collaborative undo appears in text editors, design tools, whiteboards, spreadsheets, document databases, notebooks, issue trackers, and AI-assisted writing tools. Any shared app with local commands needs a way to reverse a user action without corrupting concurrent work. The same pattern also appears outside user interfaces: compensating transactions in distributed systems often append a correction rather than removing old history.',
        'The limits are real. If the target no longer exists, undo may become a no-op. If later work depends on the target, undo may remove dependent work or require a conflict. If the product model lacks stable identities, undo may land in the wrong place. If capture windows are too aggressive, unrelated edits collapse into one undo item; if they are too narrow, ordinary typing becomes tedious to undo.',
        'A good editor admits these boundaries. It can show partial undo, keep an audit trail, preserve redo while the branch is valid, and treat destructive operations such as imports or AI rewrites as explicit transaction groups. The goal is predictable local command history layered on a convergent shared document.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources to read next are the Yjs UndoManager docs at https://docs.yjs.dev/api/undo-manager, Yjs relative positions, Peritext for rich-text CRDT semantics, and Automerge material on history and local-first collaboration. In this curriculum, study CRDTs: Conflict-Free Replicated Data Types, Sequence CRDTs for Collaborative Text, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Yjs Struct Store & Updates, Collaborative Awareness & Presence CRDT, CRDT Snapshot Compaction & Garbage Collection, Local-First Sync Engine Case Study, Piece Table Text Buffer, and Text Rope Data Structure.',
      ],
    },
  ],
};
