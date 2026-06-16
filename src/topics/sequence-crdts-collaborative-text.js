// Sequence CRDTs for collaborative text: characters are inserted relative to
// stable element IDs, so concurrent edits can merge without a central lock.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sequence-crdts-collaborative-text',
  title: 'Sequence CRDTs for Collaborative Text',
  category: 'Systems',
  summary: 'How collaborative editors merge text: give every inserted element a stable ID, tombstone or splice deletes, and sync compact updates between peers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['relative inserts', 'sync and compaction'], defaultValue: 'relative inserts' },
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

function* relativeInserts() {
  yield {
    state: graphState({
      nodes: [
        { id: 'A', label: 'A', x: 0.8, y: 4.0, note: 'id a1' },
        { id: 'X', label: 'X', x: 2.7, y: 4.0, note: 'alice' },
        { id: 'Y', label: 'Y', x: 4.6, y: 4.0, note: 'bob' },
        { id: 'B', label: 'B', x: 6.4, y: 4.0, note: 'id b1' },
        { id: 'order', label: 'order', x: 8.3, y: 4.0, note: 'tie sort' },
      ],
      edges: [
        { id: 'e-A-X', from: 'A', to: 'X' },
        { id: 'e-X-Y', from: 'X', to: 'Y' },
        { id: 'e-Y-B', from: 'Y', to: 'B' },
        { id: 'e-B-order', from: 'B', to: 'order' },
      ],
    }, { title: 'Concurrent inserts attach to stable element IDs' }),
    highlight: { active: ['X', 'Y'], found: ['order'], compare: ['A', 'B'] },
    explanation: 'In collaborative text, absolute position is fragile. If Alice and Bob both insert after A, a sequence CRDT records each insertion relative to stable element IDs and resolves the tie deterministically.',
    invariant: 'Concurrent operations must commute to the same visible sequence.',
  };

  yield {
    state: labelMatrix(
      'Operations carry stable IDs',
      [
        { id: 'base', label: 'base' },
        { id: 'alice', label: 'Alice op' },
        { id: 'bob', label: 'Bob op' },
        { id: 'merge', label: 'merge' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'visible', label: 'visible text' },
      ],
      [
        ['A -> B', 'AB'],
        ['insert X after a1', 'AXB'],
        ['insert Y after a1', 'AYB'],
        ['sort by IDs', 'AXYB'],
      ],
    ),
    highlight: { active: ['alice:operation', 'bob:operation'], found: ['merge:visible'] },
    explanation: 'The exact ordering rule varies by CRDT, but the shape is stable: operations name elements, not raw byte offsets. Replica delivery order should not change the final text.',
  };

  yield {
    state: labelMatrix(
      'Delete is not just splice',
      [
        { id: 'mark', label: 'mark deleted' },
        { id: 'keep', label: 'keep ID' },
        { id: 'render', label: 'render text' },
        { id: 'gc', label: 'garbage collect' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['remote ops may refer', 'metadata'],
        ['causal anchor', 'space'],
        ['skip tombstone', 'cheap'],
        ['when safe', 'coordination'],
      ],
    ),
    highlight: { active: ['mark:why', 'keep:why'], compare: ['gc:cost'] },
    explanation: 'Many sequence CRDTs keep tombstones or equivalent metadata so later operations still have anchors. Production systems compact, merge, or garbage-collect when causal knowledge says it is safe.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'concurrent inserts at same spot', min: 1, max: 100 }, y: { label: 'metadata pressure', min: 0, max: 100 } },
      series: [
        { id: 'naive', label: 'plain offsets', points: [{ x: 1, y: 5 }, { x: 20, y: 70 }, { x: 100, y: 100 }] },
        { id: 'crdt', label: 'ID-based CRDT', points: [{ x: 1, y: 12 }, { x: 20, y: 28 }, { x: 100, y: 60 }] },
      ],
    }),
    highlight: { active: ['crdt'], compare: ['naive'] },
    explanation: 'The CRDT pays metadata to avoid coordination. That is the bargain: more structure in every operation, less need for a central editor server to serialize every keystroke.',
  };
}

function* syncAndCompaction() {
  yield {
    state: graphState({
      nodes: [
        { id: 'editor', label: 'editor', x: 0.8, y: 4.0, note: 'local op' },
        { id: 'update', label: 'update', x: 2.7, y: 4.0, note: 'binary' },
        { id: 'store', label: 'store', x: 4.6, y: 4.0, note: 'append' },
        { id: 'peer', label: 'peer', x: 6.5, y: 4.0, note: 'apply' },
        { id: 'state', label: 'state', x: 8.4, y: 4.0, note: 'converged' },
      ],
      edges: [
        { id: 'e-editor-update', from: 'editor', to: 'update' },
        { id: 'e-update-store', from: 'update', to: 'store' },
        { id: 'e-store-peer', from: 'store', to: 'peer' },
        { id: 'e-peer-state', from: 'peer', to: 'state' },
      ],
    }, { title: 'Yjs-style systems sync compact binary updates' }),
    highlight: { active: ['update', 'store', 'peer'], found: ['state'] },
    explanation: 'Libraries such as Yjs distribute compact updates. Peers apply updates in any delivery order allowed by the protocol and converge on the same shared document state.',
    invariant: 'Persistence can be an append log of CRDT updates plus compaction.',
  };

  yield {
    state: labelMatrix(
      'Production layers around the CRDT',
      [
        { id: 'crdt', label: 'CRDT core' },
        { id: 'awareness', label: 'presence' },
        { id: 'provider', label: 'provider' },
        { id: 'storage', label: 'storage' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'not', label: 'not for' },
      ],
      [
        ['merge edits', 'auth'],
        ['cursors/users', 'document truth'],
        ['transport', 'conflict logic'],
        ['history', 'ordering oracle'],
      ],
    ),
    highlight: { found: ['crdt:does', 'storage:does'], compare: ['awareness:not', 'provider:not'] },
    explanation: 'A collaborative editor is not only the CRDT. It needs transport, auth, storage, awareness, undo, schema rules, and editor integration. Keep those responsibilities separate.',
  };

  yield {
    state: labelMatrix(
      'Text buffer versus sync structure',
      [
        { id: 'piece', label: 'piece table' },
        { id: 'rope', label: 'rope' },
        { id: 'crdt', label: 'sequence CRDT' },
      ],
      [
        { id: 'optimizes' , label: 'optimizes' },
        { id: 'hard', label: 'hard part' },
      ],
      [
        ['local edits', 'descriptor tree'],
        ['large strings', 'balance'],
        ['replicated edits', 'metadata'],
      ],
    ),
    highlight: { active: ['crdt:optimizes'], compare: ['piece:optimizes', 'rope:optimizes'] },
    explanation: 'A local editor may use a Piece Table Text Buffer or Text Rope Data Structure for speed. A CRDT is the replicated ordering layer that lets many peers edit without a central lock.',
  };

  yield {
    state: labelMatrix(
      'Misreadings to avoid',
      [
        { id: 'magic', label: 'magic merge' },
        { id: 'intent', label: 'intent' },
        { id: 'storage', label: 'storage' },
        { id: 'scale', label: 'scale' },
      ],
      [
        { id: 'wrong', label: 'wrong read' },
        { id: 'better', label: 'better read' },
      ],
      [
        ['no conflicts', 'structured conflicts'],
        ['always preserved', 'best-effort rules'],
        ['free history', 'compact updates'],
        ['always cheap', 'measure docs'],
      ],
    ),
    highlight: { removed: ['magic:wrong', 'intent:wrong'], found: ['magic:better', 'storage:better'] },
    explanation: 'CRDTs guarantee convergence, not perfect human intent. Rich-text schemas, marks, undo, comments, and permissions add separate constraints above the sequence layer. Peritext Rich-Text CRDT Case Study shows why formatting spans need their own merge model.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'relative inserts') yield* relativeInserts();
  else if (view === 'sync and compaction') yield* syncAndCompaction();
  else throw new InputError('Pick a sequence CRDT view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A sequence CRDT is a replicated list or text structure that lets users insert and delete concurrently while every replica eventually renders the same order. It is the missing bridge between the algebraic CRDTs page and real collaborative editors. Counters and sets merge cleanly because they have simple semilattice structure; text has order, and order is harder.',
        'The key move is stable identity. Instead of saying "insert at byte offset 12," an operation says "insert this element after element a1" or uses a related position identifier. If two peers insert at the same logical place, their element IDs break the tie deterministically. Delivery order should not change the final visible sequence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Different sequence CRDTs choose different identifiers, list structures, blocks, or tree layouts, but the common pattern is relative insertion plus deterministic ordering. Deletes often keep tombstones or equivalent causal metadata so remote operations can still find anchors. Rendering skips deleted elements while synchronization keeps enough structure to merge future updates.',
        'Libraries such as Yjs and Automerge wrap these structures in practical APIs, binary update formats, sync protocols, and editor integrations. Yjs exposes shared types whose changes are distributed and merged. Automerge documents list/text structures and sync formats for local-first collaboration. The CRDT core handles convergence; the product still needs permissions, schema validation, storage, awareness, and undo semantics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sequence CRDTs spend metadata to avoid central coordination. Every element may carry IDs, origins, clocks, deletion state, or block metadata. Large documents need compaction and garbage collection. Rich-text marks, nested objects, comments, and undo can be harder than plain characters. Peritext Rich-Text CRDT Case Study covers that formatting layer, while Fractional Indexing & LexoRank Case Study shows the lighter-weight ordered-key approach used when a product needs reorderable items rather than character-level intent preservation. Operational Transformation Collaborative Editing Case Study shows the alternative: keep position-based operations and transform them through a revision protocol. The winning implementation is therefore not only the merge rule; it is the storage format, update batching, and integration with a fast local text buffer.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Yjs is widely used with editors such as ProseMirror, TipTap, Slate, and CodeMirror. Its repository describes shared data types whose changes are automatically distributed and merged without conflicts. Automerge describes documents with maps, lists, counters, and sync, and its documentation notes that ordered collections are represented as lists appropriate for concurrent editing. Research on replicated growable arrays evaluated CRDTs for real-time document editing and highlights the data-structure challenge behind insertion and deletion.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A CRDT does not mean every human intention is preserved. If two users rewrite the same sentence in incompatible ways, convergence gives one deterministic document, not necessarily the document either user imagined. A CRDT also does not replace local editor data structures. Piece tables and ropes optimize local editing; sequence CRDTs optimize replicated ordering; Peritext-style rich-text CRDTs add formatting-span semantics above that ordering layer. Production systems often need all of these layers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Yjs repository at https://github.com/yjs/yjs, Automerge document model at https://automerge.org/docs/reference/documents/, Automerge glossary at https://automerge.org/docs/reference/glossary/, and CRDT document-editing evaluation at https://members.loria.fr/CIgnat/files/pdf/AhmedNacerDocEng11.pdf. Study CRDTs: Conflict-Free Replicated Data Types, Logical Clocks, Piece Table Text Buffer, Text Rope Data Structure, Operational Transformation Collaborative Editing Case Study, Peritext Rich-Text CRDT Case Study, Local-First Sync Engine Case Study, Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, CRDT Snapshot Compaction & Garbage Collection, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, Fractional Indexing & LexoRank Case Study, and Cloudflare Durable Objects Case Study next.',
      ],
    },
  ],
};
