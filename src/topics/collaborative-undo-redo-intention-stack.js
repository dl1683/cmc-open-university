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
    explanation: 'Collaborative undo should not blindly reverse the last global document change. It should usually reverse this user\'s recent local transaction in a specific scope, such as a text object or selected shared type.',
  };

  yield {
    state: undoGraph('A stack item stores an inverse patch'),
    highlight: { active: ['doc', 'undo', 'e-doc-undo'], found: ['redo'] },
    explanation: 'When a tracked local transaction changes the shared document, the undo manager records enough inverse information to remove, restore, or adjust the affected CRDT items later.',
    invariant: 'Undo is another edit, not time travel.',
  };

  yield {
    state: undoGraph('Remote edits change the document but not your undo stack'),
    highlight: { active: ['remote', 'doc', 'e-remote-doc'], compare: ['undo'] },
    explanation: 'Remote edits still affect what an undo operation must do, but they should not become your personal undo target. That is why origins and tracked-origin filters matter.',
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
    explanation: 'The data structure is not a generic stack of snapshots. It is a selective stack of scoped, origin-tagged, grouped inverse operations plus UI metadata.',
  };
}

function* historyRepair() {
  yield {
    state: repairGraph('The target edit may no longer sit in the same context'),
    highlight: { active: ['alice', 'bob', 'history', 'e-alice-history', 'e-bob-history'], compare: ['target'] },
    explanation: 'Alice inserted text. Bob later edited around it. When Alice presses undo, the system must remove Alice\'s contribution without damaging Bob\'s concurrent or dependent edits.',
  };

  yield {
    state: repairGraph('Undo chooses a target and builds an inverse'),
    highlight: { active: ['history', 'target', 'inverse', 'e-history-target', 'e-target-inverse'], compare: ['bob'] },
    explanation: 'The undo manager identifies the stack item and constructs an inverse operation. In CRDT systems that may mean deleting specific item ids; in OT systems it may mean transforming a reverse operation through later edits.',
  };

  yield {
    state: repairGraph('The inverse is repaired against current history'),
    highlight: { active: ['inverse', 'history', 'transform', 'e-inverse-transform', 'e-history-transform'], found: ['apply'] },
    explanation: 'The hard part is rebasing the inverse so it still expresses the original undo intention in the current document. Rich text, comments, nested objects, and formatting spans make this much harder than plain text.',
  };

  yield {
    state: repairGraph('Undo applies as a new operation'),
    highlight: { active: ['transform', 'apply', 'result', 'e-transform-apply', 'e-apply-result'], compare: ['target'] },
    explanation: 'The repaired inverse is appended as a new operation. Other replicas receive it like any other change and converge on the same result.',
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
    explanation: 'The naive implementations all feel fine in single-user editing and break in collaboration. The fix is not more snapshots; it is explicit intention metadata and inverse operations.',
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
      heading: 'What it is',
      paragraphs: [
        'Collaborative undo is the problem of reversing a user\'s own intention without corrupting other users\' concurrent work. In a single-user editor, undo can often mean restore a previous local snapshot or apply a simple inverse operation. In a shared CRDT or OT document, other people may have edited around the target operation before undo happens.',
        'Yjs ships a selective UndoManager for shared types. The docs describe scoping to Y.AbstractType values, optional tracked origins, a capture timeout that groups nearby edits, undo and redo stacks, stopCapturing, and stack metadata hooks: https://docs.yjs.dev/api/undo-manager.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A collaborative undo manager watches local transactions in a chosen scope. Each transaction has an origin, such as local editor input, paste, import, AI rewrite, or remote provider. The undo manager tracks selected origins and ignores others. For tracked transactions, it records inverse data and groups nearby edits into stack items so typing a word can undo as one action instead of one character at a time.',
        'Undo itself becomes a new document operation. If Alice inserted a phrase and Bob later typed after it, Alice\'s undo should remove Alice\'s inserted CRDT items while preserving Bob\'s text. In OT systems, the reverse operation may need to be transformed through later operations. In CRDT systems, it may target stable element ids, tombstones, mark operations, or object-field changes. Either way, undo is not a rewind of global time.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main records are undo stack, redo stack, scoped type set, tracked-origin set, capture timer, inverse patch, delete filter, and metadata map. The metadata map can store cursor position, selection, viewport, or active block so the editor can restore user context when an undo or redo occurs.',
        'This layer connects to Sequence CRDTs, Operational Transformation, Peritext Rich-Text CRDT Case Study, and Collaborative Awareness Presence CRDT. Sequence CRDTs give stable text identities. OT gives transform rules. Peritext explains why rich-text marks need their own range semantics. Awareness and cursor metadata make the UI feel coherent after the structural change.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A collaborative markdown editor tracks local typing transactions on the shared text object. The user types "hello", and the capture window groups those five character inserts into one undo stack item. A teammate concurrently adds a comment after the word. The first user presses undo. The undo manager generates a delete over the inserted items, applies it as a new CRDT operation, moves the stack item to redo, and restores the cursor near the original insertion point. The teammate\'s comment remains.',
        'Now consider an AI rewrite button. Its transaction origin should be distinct from keyboard input. The product may let users undo the rewrite separately, or exclude automated imports from normal typing undo. That is why trackedOrigins is not a minor API detail; it encodes product intention.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first mistake is global undo: reverse the last operation in the whole document, even if another user made it. The second is snapshot undo: revert the document to an earlier local copy and erase later remote work. The third is ignoring rich text. Removing text can split or preserve formatting ranges, comments, links, and decorations in surprising ways. Peritext explicitly marks undo and version visualization as hard product work beyond a plain merge algorithm.',
        'A collaborative undo system should be honest about impossible cases. If a target was deleted, transformed, or semantically merged beyond repair, the UI may need to surface a no-op, partial undo, or conflict rather than pretend every intention can be reconstructed perfectly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Yjs UndoManager docs at https://docs.yjs.dev/api/undo-manager, Yjs Delta Format at https://docs.yjs.dev/api/delta-format, Yjs RelativePosition at https://docs.yjs.dev/api/relative-positions, Peritext at https://www.inkandswitch.com/peritext/, and Automerge history/branching overview at https://automerge.org/docs/hello/. Study Local-First Sync Engine Case Study, Yjs Struct Store & Updates, CRDT Snapshot Compaction & Garbage Collection, Collaborative Awareness Presence CRDT, Sequence CRDTs for Collaborative Text, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Piece Table Text Buffer, and Text Rope Data Structure next.',
      ],
    },
  ],
};
