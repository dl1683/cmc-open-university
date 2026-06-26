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
  const peerCount = 2;
  const nodeCount = 5;
  const mergedResult = 'AXYB';
  const anchorId = 'a1';

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
    explanation: `Absolute offsets are the wrong coordinate system for collaboration. If ${peerCount} peers both insert after A, the operation names a stable element ID (like ${anchorId}) instead of byte position 1. The CRDT then uses deterministic tie-breaking across ${nodeCount} nodes so every replica renders the same order.`,
    invariant: `Concurrent operations from ${peerCount} peers must commute to the same visible sequence.`,
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
    explanation: `This table is the core mental model. ${peerCount} peers each see a different local text, but their operations carry stable IDs. Once both operations arrive, sorting by the CRDT rule produces the same merged sequence ${mergedResult} regardless of delivery order.`,
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
    explanation: `Delete cannot always mean "erase every trace." A later remote insert from any of the ${peerCount} peers may still refer to the deleted element as an anchor. Tombstones keep those references meaningful until the system can prove compaction is safe.`,
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
    explanation: `The plot shows the bargain, not a benchmark: IDs, origins, and delete metadata cost more than a local string buffer, but they let ${peerCount} peers avoid a central server having to serialize every keystroke before users can continue typing.`,
  };
}

function* syncAndCompaction() {
  const syncSteps = 5;
  const layerCount = 4;
  const bufferTypes = 3;

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
    explanation: `The sync path spans ${syncSteps} stages from editor to converged state: local operations become compact CRDT updates, updates are stored or relayed, and peers merge them into the same document. Transport can vary; the ordering identity lives in the update.`,
    invariant: `Persistence across all ${syncSteps} stages can be an append log of CRDT updates plus compaction.`,
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
    explanation: `This ${layerCount}-layer table keeps the design honest. The CRDT merges text order; it does not authenticate users, store history forever, show cursors, repair undo intent, or validate document schema. Those are neighboring systems.`,
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
    explanation: `Do not confuse local editing speed with replicated ordering. The table compares ${bufferTypes} approaches: piece tables and ropes make one editor fast, while a sequence CRDT makes many editors agree on where each inserted element belongs after sync.`,
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
    explanation: `The last table lists ${layerCount} usual overclaims. Sequence CRDTs converge the text order, but intent, rich-text marks, comments, permissions, and undo have their own rules. Peritext exists because formatting spans are not solved by character order alone.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows replicas editing the same ordered text while messages arrive later. A replica is one local copy of the document, and a CRDT is a conflict-free replicated data type whose replicas converge after receiving the same operations.',
        {type: 'image', src: './assets/gifs/sequence-crdts-collaborative-text.gif', alt: 'Animated walkthrough of the sequence crdts collaborative text visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Active state marks a local insert or delete, found state marks an operation that has been integrated, and compare state marks concurrent operations being ordered. The safe inference is: stable element IDs, not current numeric offsets, decide where remote edits land.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Collaborative text is hard because order is the data. Users care whether a character lands before or after another character and whether a delete removes the intended content.',
        {type: 'callout', text: 'A sequence CRDT replaces fragile offsets with stable element identities, then lets every replica apply the same deterministic ordering rule.'},
        'Local-first editors cannot ask a server for permission before every keystroke. Users must type while offline or slow, then merge their independently created operations into one visible sequence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious operation format is offset based: insert X at index 12 or delete 3 characters starting at index 7. Inside one local string, offsets are compact and fast.',
        {type: 'image', src: 'https://xi-editor.io/docs/img/tp2.png', alt: 'Collaborative editing trace where asynchronous operations can diverge without a convergence rule', caption: 'A text-editing convergence failure makes the offset problem concrete. Source: Xi Text Engine CRDT notes https://xi-editor.io/docs/crdt-details.html.'},
        'Another simple approach is last-writer-wins on the whole document. That works for a register but loses valid text when two users edit different parts of the same paragraph.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Offsets are local facts. If Alice inserts before index 12 while Bob also edits nearby, index 12 can name different characters on different replicas by the time messages arrive.',
        'A central server can serialize operations and transform offsets, but that makes the server the ordering authority and weakens offline editing. Last-writer-wins is worse because it throws away one side of concurrent work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A sequence CRDT gives each inserted element a stable identity. Operations refer to identities or generated position identifiers rather than to shifting numeric offsets.',
        'Concurrent inserts into the same gap are ordered by a deterministic rule over identifiers, actor IDs, counters, or position paths. Every replica uses the same rule, so every replica eventually renders the same order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a user types, the local replica creates an insert operation containing a new element ID, the character or run of text, and the logical position near existing IDs. The local document applies it immediately for responsive typing.',
        'When a remote replica receives the operation, it places the element using the stable context and ordering rule, not the sender\'s old offset. If dependencies arrive late, the implementation buffers or uses position encodings that become placeable when context arrives.',
        'Deletion marks elements as not visible. Tombstones or equivalent causal metadata may remain so that later operations referring to deleted anchors still have meaning.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The convergence argument is deterministic ordering over stable identities. If two replicas receive the same insert operations, they compare the same IDs and compute the same order, even if they received messages in different orders.',
        'Deletes work because visibility and identity are separated. A character can disappear from the rendered text while its ID remains available as an anchor for delayed operations.',
        'Garbage collection is correct only when the system has causal evidence that no future operation can need a hidden anchor. Removing metadata too early can make a valid remote operation impossible to place.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is metadata. A plain string stores characters; a sequence CRDT stores characters plus IDs, actor clocks, origins, deletion state, block boundaries, or position paths.',
        'When visible text doubles, metadata usually doubles too, and some designs grow faster near heavy concurrent insert hotspots. Production systems batch runs, encode IDs compactly, snapshot, and compact history.',
        'Runtime cost is also layered. The editor may use a rope or piece table for local speed, while the CRDT handles replicated order, sync, and convergence.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sequence CRDTs fit collaborative notes, code editors, shared outlines, comments, whiteboards with text boxes, and offline mobile editing. The access pattern is many small ordered edits created independently and merged later.',
        'They are useful when latency or disconnection makes central serialization unacceptable. A user should see their keystroke locally before any server round trip.',
        'Libraries such as Yjs and Automerge use CRDT-style document models with compact updates, providers, awareness layers, and storage formats around the merge core.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A CRDT is often the wrong tool when a single authoritative server can serialize edits and the product accepts that dependency. Operational Transformation or a versioned database row may be simpler.',
        'Convergence does not mean human intent is preserved. If two people rewrite the same sentence concurrently, the CRDT can keep both edits in a deterministic order without knowing which rewrite is semantically better.',
        'Text order is not the whole editor. Permissions, schema validation, rich-text spans, undo, comments, cursor presence, storage compaction, and abuse controls need separate design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with text AB, where A has id a1 and B has id b1. Alice inserts X after A with id alice:1, while Bob offline inserts Y after A with id bob:1.',
        'Alice locally sees AXB. Bob locally sees AYB. When operations sync, both replicas compare alice:1 and bob:1 by the CRDT tie-break rule; if alice sorts before bob, both render AXYB.',
        'Now Alice deletes A before Bob\'s operation arrives. The visible text may hide A, but the system must keep enough metadata for Bob\'s insert-after-A operation to land between the old A position and B rather than at a random offset.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Yjs repository at https://github.com/yjs/yjs, Automerge documents at https://automerge.org/docs/reference/documents/, Automerge glossary at https://automerge.org/docs/reference/glossary/, and CRDT document-editing evaluation at https://members.loria.fr/CIgnat/files/pdf/AhmedNacerDocEng11.pdf.',
        'Study CRDT basics, logical clocks, operational transformation, piece tables, ropes, Peritext for rich text, Yjs update encoding, Automerge change graphs, and CRDT snapshot compaction before designing a production editor.',
      ],
    },
  ],
};
