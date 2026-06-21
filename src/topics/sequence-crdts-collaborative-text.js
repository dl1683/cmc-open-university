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
    explanation: 'Absolute offsets are the wrong coordinate system for collaboration. If Alice and Bob both insert after A, the operation names a stable element ID instead of byte position 1. The CRDT then uses deterministic tie-breaking so every replica renders the same order.',
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
    explanation: 'This table is the core mental model. Alice and Bob each see a different local text, but their operations carry stable IDs. Once both operations arrive, sorting by the CRDT rule produces the same merged sequence regardless of delivery order.',
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
    explanation: 'Delete cannot always mean "erase every trace." A later remote insert may still refer to the deleted element as an anchor. Tombstones or equivalent metadata keep those references meaningful until the system can prove compaction is safe.',
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
    explanation: 'The plot shows the bargain, not a benchmark: IDs, origins, and delete metadata cost more than a local string buffer, but they avoid a central server having to serialize every keystroke before users can continue typing.',
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
    explanation: 'The sync path is append and apply: local editor operations become compact CRDT updates, updates are stored or relayed, and peers merge them into the same document. Transport can vary; the ordering identity lives in the update.',
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
    explanation: 'This layer table keeps the design honest. The CRDT merges text order; it does not authenticate users, store history forever, show cursors, repair undo intent, or validate document schema. Those are neighboring systems.',
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
    explanation: 'Do not confuse local editing speed with replicated ordering. Piece tables and ropes make one editor fast. A sequence CRDT makes many editors agree on where each inserted element belongs after sync.',
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
    explanation: 'The last table lists the usual overclaims. Sequence CRDTs converge the text order, but intent, rich-text marks, comments, permissions, and undo have their own rules. Peritext exists because formatting spans are not solved by character order alone.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Collaborative text is difficult because the shared object is not just a bag of characters. Order is the product. Users care whether a letter lands before or after another letter, whether a delete removes the intended word, and whether two people typing into the same gap see a sensible result after sync. A replicated counter can merge by addition. A document must preserve a sequence.',
        {
          type: 'callout',
          text: 'A sequence CRDT replaces fragile offsets with stable element identities, then lets every replica apply the same deterministic ordering rule.',
        },
        'The hard constraint is latency and disconnection. A local-first editor cannot ask a central server for permission before every keystroke. The user must be able to type while offline, on a slow connection, or while another peer is editing the same sentence. When the peers reconnect, their independently created operations must merge into one visible order.',
        'A sequence CRDT is the ordering layer for that setting. CRDT means conflict-free replicated data type: replicas can apply operations in different orders and still converge when they have received the same set of operations. A sequence CRDT specializes that idea for text and ordered lists. It gives inserted elements stable identities, defines deterministic order among concurrent inserts, and keeps enough causal metadata for deletes and later sync.',
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The naive operation format is offset based: insert X at index 12, delete 3 characters starting at index 7. This is how a single local string often feels. It is also how many editor APIs expose positions. The format is not foolish. Inside one process, against one current buffer, offsets are compact and fast.',
        {
          type: 'image',
          src: 'https://xi-editor.io/docs/img/tp2.png',
          alt: 'Collaborative editing trace where asynchronous operations can diverge without a convergence rule',
          caption: 'A text-editing convergence failure makes the offset problem concrete. Source: Xi Text Engine CRDT notes https://xi-editor.io/docs/crdt-details.html.',
        },
        'The wall is that offsets are local facts, not replicated facts. If Alice inserts at index 12 while Bob inserts earlier in the document, Alice and Bob no longer agree on what index 12 names. If a delete shifts the buffer before a remote insert arrives, the remote offset may point at the wrong character. A central server can serialize all edits and transform positions, but that makes the server the ordering authority and weakens offline-first editing.',
        'A second naive approach is last-writer-wins. It is simple for registers, but destructive for text. If two users type different words in the same paragraph, choosing one whole document version loses valid work. Collaborative text needs a merge rule that can preserve independent inserts while still producing a single deterministic sequence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to stop treating positions as numbers in a changing array. A sequence CRDT gives each inserted element a stable identity. An operation says that a new element belongs after a known element, before another known element, or at a generated position in the identifier order. The identity travels with the operation, so it still means the same thing after other edits arrive.',
        'Concurrent inserts into the same gap are not resolved by timing guesses. They are resolved by a deterministic ordering rule over identifiers, actor IDs, counters, or position paths, depending on the CRDT design. Every replica uses the same rule. If Alice and Bob both insert after A before either sees the other edit, both inserts survive, and every peer eventually renders them in the same order.',
        'Deletes add the second insight: visible removal is different from forgetting. A remote operation may still refer to an element that is now hidden locally. Tombstones or equivalent causal metadata keep those references meaningful until the system can prove the deleted anchor is no longer needed. Compaction is therefore a correctness question, not just a cleanup pass.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simplified sequence CRDT starts with a known beginning and end, then represents each visible character or run as an element with an ID. When a user types, the replica creates an insert operation containing the new element ID, the value, and the logical context that places it near existing IDs. The local replica applies the operation immediately so typing stays responsive.',
        'When another replica receives the operation, it does not trust the sender offset. It inserts the element according to the stable context and the CRDT ordering rule. If the referenced neighbor is already present, placement is direct. If dependencies arrive out of order, the implementation can buffer, search the identifier tree, or use encoded position identifiers that make the operation placeable once the missing context is known.',
        'Deletion marks an element as not visible. Some CRDTs keep a tombstone element. Others encode deletion in ranges, blocks, causal clocks, or struct metadata so they can avoid one permanent object per removed character. Rendering walks the sequence and skips deleted content. Sync sends compact updates rather than entire documents, and storage often becomes an append log of CRDT updates plus snapshots or compaction records.',
        'Production editors add layers around this core. A local piece table or rope can make editing fast in one browser tab. The CRDT makes replicated order converge across peers. A provider handles transport. Awareness shows cursors and presence. Authorization controls who may write. Rich-text logic attaches marks and spans. Undo tries to preserve user intent. These layers interact, but they are not the same algorithm.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The relative-inserts view proves the coordinate-system change. Alice and Bob each create a local document, but their operations do not depend on the same numeric offset. Both name stable element IDs. When the operations meet, the merge step uses the deterministic CRDT rule to produce one shared order. The important fact is not that the result is AXYB in this toy case; it is that every replica can compute the same result from the same operation set.',
        'The delete view proves why hidden metadata can outlive visible text. A user sees a character disappear, but the system may keep its ID because a late insert still names that character as an anchor. Garbage collection must wait until the system has enough causal knowledge to know that no future operation can need the anchor.',
        'The sync-and-compaction view proves the boundary between algorithm and product. Compact binary updates can be stored, relayed, and replayed, but the CRDT invariant is narrow: replicas that receive the same insert and delete identities render the same order. It does not, by itself, solve auth, schema, cursor presence, comment threads, or rich-text intention.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is convergence. Each operation has a stable identity and a deterministic placement rule. Applying operation X before operation Y or Y before X may create different temporary local states, but once both operations are present, the ordering rule sees the same IDs and produces the same sequence. The operations commute at the level that matters: final rendered order after the same causal set is known.',
        'For deletes, the invariant is that references remain meaningful until they are no longer needed. A tombstone looks wasteful, but it protects the meaning of concurrent or delayed operations. Safe compaction needs causal evidence, such as version vectors, state vectors, snapshots agreed by peers, or server-side retention policy. Removing anchors too early can make a valid remote operation impossible to place.',
        'This is also why sequence CRDTs are different from ordinary sorted IDs. A fractional index can place cards between other cards, but it usually assumes a simpler concurrency model and a central or near-central ordering policy. A sequence CRDT treats independent creation, delayed delivery, duplicate delivery, and merge convergence as first-class requirements.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is metadata. A plain string stores characters. A sequence CRDT stores characters plus IDs, origins, actor clocks, deletion state, block boundaries, parent references, or position paths. When the visible text doubles, metadata usually doubles too, and some designs grow faster near heavy concurrent insert hotspots. Good implementations batch runs, encode IDs compactly, and snapshot old history.',
        'The runtime cost also changes shape. Local typing must update both the editor buffer and the CRDT structure. Sync must encode, transmit, decode, and apply operations. Rendering may need a materialized text view because walking CRDT metadata for every paint would be too slow. Search, syntax highlighting, and editor plugins often operate on the local text buffer, not directly on the CRDT graph.',
        'The conceptual cost is intent. Convergence does not mean the merged prose is what either user intended. If two people rewrite the same sentence at the same time, a sequence CRDT can interleave or order their inserts deterministically without understanding which rewrite should win. Undo is also hard because "undo my change" is not the same as deleting the current characters at the old offsets after other users have edited nearby.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Sequence CRDTs win in collaborative notes, code editors, local-first documents, shared outlines, comments, whiteboards with text boxes, offline mobile editing, and edge-synced apps where users must keep working without round trips. The access pattern is many small ordered edits created independently, then merged later.',
        'They are the wrong tool when a single authoritative server can serialize all edits and the product accepts that dependency. Operational Transformation may fit a centrally mediated editor. A database row with a version number may fit form editing. Fractional Indexing or LexoRank may fit drag-and-drop card order. A CRDT is worth its metadata when independent replicas must accept ordered edits before coordination.',
        'They also fail when teams mistake the text CRDT for the whole editor. Rich text spans can conflict in ways plain character order does not solve. Permissions must reject invalid operations. Schema validation must prevent impossible documents. Presence should not become document truth. Storage needs compaction. Production quality comes from composing these layers without pretending one merge structure handles all semantics.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Yjs repository at https://github.com/yjs/yjs, Automerge document model at https://automerge.org/docs/reference/documents/, Automerge glossary at https://automerge.org/docs/reference/glossary/, and CRDT document-editing evaluation at https://members.loria.fr/CIgnat/files/pdf/AhmedNacerDocEng11.pdf. Study CRDTs: Conflict-Free Replicated Data Types and Logical Clocks first. Then study Piece Table Text Buffer and Text Rope Data Structure for local editing speed, Operational Transformation for the centralized contrast, Peritext for rich text, Yjs Struct Store & Updates and Automerge Change Graph & Columnar Storage for production encodings, and CRDT Snapshot Compaction & Garbage Collection before designing storage retention.',
      ],
    },
  ],
};
