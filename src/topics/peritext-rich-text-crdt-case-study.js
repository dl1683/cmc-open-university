// Peritext: rich-text CRDT case study for marks, spans, boundaries,
// and editor integration on top of a plain sequence CRDT.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'peritext-rich-text-crdt-case-study',
  title: 'Peritext Rich-Text CRDT Case Study',
  category: 'Systems',
  summary: 'How rich-text collaboration extends sequence CRDTs with append-only formatting spans, boundary semantics, rendering rules, and editor integration.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['format merge', 'span anchors', 'editor pipeline'], defaultValue: 'format merge' },
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

function* formatMerge() {
  yield {
    state: labelMatrix(
      'Concurrent rich-text intent',
      [
        { id: 'base', label: 'base' },
        { id: 'alice', label: 'Alice' },
        { id: 'bob', label: 'Bob' },
        { id: 'merge', label: 'merge' },
      ],
      [
        { id: 'the', label: 'The' },
        { id: 'fox', label: 'fox' },
        { id: 'jumped', label: 'jumped' },
      ],
      [
        ['plain', 'plain', 'plain'],
        ['bold', 'bold', 'plain'],
        ['plain', 'bold', 'bold'],
        ['bold', 'bold', 'bold'],
      ],
    ),
    highlight: { active: ['alice:the', 'alice:fox', 'bob:fox', 'bob:jumped'], found: ['merge:the', 'merge:fox', 'merge:jumped'] },
    explanation: 'This step starts with intent. Alice and Bob create overlapping formatting ranges, and the useful merge is not a byte trick; it is the union of two bold intentions over stable text positions.',
    invariant: 'Rich-text merge must preserve text order and formatting intent separately.',
  };

  yield {
    state: labelMatrix(
      'Why Markdown-as-text fails',
      [
        { id: 'alice', label: 'Alice markers' },
        { id: 'bob', label: 'Bob markers' },
        { id: 'merged', label: 'merged stream' },
      ],
      [
        { id: 'before', label: 'before fox' },
        { id: 'fox', label: 'fox' },
        { id: 'after', label: 'after fox' },
      ],
      [
        ['** start', 'word', '** end'],
        ['** start', 'word', '** end'],
        ['interleave', 'ambiguous', 'wrong style'],
      ],
    ),
    highlight: { compare: ['merged:before', 'merged:fox', 'merged:after'], active: ['alice:before', 'alice:after', 'bob:before', 'bob:after'] },
    explanation: 'Markdown markers are ordinary characters to a plain text CRDT. They may converge byte-for-byte while the formatting they imply becomes ambiguous or wrong. Rich text needs mark semantics, not hidden punctuation races.',
  };

  yield {
    state: labelMatrix(
      'Boundary behavior is semantic',
      [
        { id: 'boldEnd', label: 'insert after bold' },
        { id: 'linkEnd', label: 'insert after link' },
        { id: 'commentEnd', label: 'insert after comment' },
      ],
      [
        { id: 'commonEditor', label: 'common behavior' },
        { id: 'intent', label: 'intent' },
      ],
      [
        ['new text inherits', 'continue emphasis'],
        ['new text outside', 'do not extend URL'],
        ['new text outside', 'do not extend note'],
      ],
    ),
    highlight: { found: ['boldEnd:commonEditor'], compare: ['linkEnd:commonEditor', 'commentEnd:commonEditor'] },
    explanation: 'Boundary behavior is part of the data model. New text at the edge of bold often should inherit bold; new text at the edge of a link or comment usually should not extend that annotation. One generic range rule cannot capture all mark types.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'editing cases handled', min: 0, max: 12 }, y: { label: 'intent risk', min: 0, max: 10 } },
      series: [
        { id: 'plain', label: 'plain text CRDT only', points: [{ x: 1, y: 2 }, { x: 4, y: 7 }, { x: 8, y: 9 }] },
        { id: 'peritext', label: 'Peritext marks', points: [{ x: 1, y: 2 }, { x: 4, y: 3 }, { x: 8, y: 4 }] },
      ],
    }),
    highlight: { found: ['peritext'], compare: ['plain'] },
    explanation: 'This is a conceptual plot. Rich text adds cases: overlapping marks, insertion at span boundaries, comments, links, colors, undo, and copy-paste. Peritext reduces a specific class of merge anomalies by modeling marks as operations, not as inline control text.',
  };
}

function* spanAnchors() {
  yield {
    state: graphState({
      nodes: [
        { id: 'c1', label: '1@A', x: 1.0, y: 4.0, note: 'The' },
        { id: 'c2', label: '2@A', x: 2.4, y: 4.0, note: 'fox' },
        { id: 'c3', label: '3@B', x: 3.8, y: 4.0, note: 'jumped' },
        { id: 'm1', label: 'mark', x: 2.4, y: 1.7, note: 'bold' },
        { id: 's', label: 'start', x: 1.0, y: 2.8, note: 'before' },
        { id: 'e', label: 'end', x: 3.8, y: 2.8, note: 'after' },
      ],
      edges: [
        { id: 'e-c1-c2', from: 'c1', to: 'c2' },
        { id: 'e-c2-c3', from: 'c2', to: 'c3' },
        { id: 'e-m1-s', from: 'm1', to: 's' },
        { id: 'e-m1-e', from: 'm1', to: 'e' },
        { id: 'e-s-c1', from: 's', to: 'c1' },
        { id: 'e-e-c3', from: 'e', to: 'c3' },
      ],
    }, { title: 'Formatting spans anchor to CRDT positions' }),
    highlight: { active: ['m1'], found: ['c1', 'c2', 'c3'], compare: ['s', 'e'] },
    explanation: 'The graph shows the two-layer design. The sequence CRDT owns character identity and order. Peritext adds mark operations whose start and end anchor around those stable character positions.',
    invariant: 'A mark is metadata over stable positions, not hidden text inserted into the character stream.',
  };

  yield {
    state: labelMatrix(
      'Append-only mark log',
      [
        { id: 'op18', label: '18@A' },
        { id: 'op22', label: '22@B' },
        { id: 'op31', label: '31@A' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'range', label: 'range' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['add bold', 'before 5 to before 17', 'style on'],
        ['add link', 'after 9 to after 14', 'URL mark'],
        ['remove bold', 'before 8 to before 12', 'style off'],
      ],
    ),
    highlight: { active: ['op18:kind', 'op18:range'], compare: ['op31:effect'] },
    explanation: 'Marks live in history as operations, not as one mutable HTML string. Rendering is a deterministic projection: take the sequence, apply add/remove mark operations, and compute the active styles for each visible span.',
  };

  yield {
    state: labelMatrix(
      'Rendering sweep',
      [
        { id: 'the', label: 'The' },
        { id: 'fox', label: 'fox' },
        { id: 'jumped', label: 'jumped' },
        { id: 'period', label: '.' },
      ],
      [
        { id: 'bold', label: 'bold' },
        { id: 'link', label: 'link' },
        { id: 'comment', label: 'comment' },
      ],
      [
        ['on', 'off', 'off'],
        ['on', 'on', 'off'],
        ['on', 'on', 'note'],
        ['off', 'off', 'note'],
      ],
    ),
    highlight: { found: ['fox:bold', 'fox:link', 'jumped:comment'], active: ['the:bold', 'jumped:bold'] },
    explanation: 'The rendered document is not stored as one mutable HTML string. It is derived from a sequence plus marks. That separation is what lets overlapping bold, links, comments, and text edits converge.',
  };

  yield {
    state: labelMatrix(
      'Data-structure pressure',
      [
        { id: 'sequence', label: 'sequence CRDT' },
        { id: 'marks', label: 'mark spans' },
        { id: 'render', label: 'render index' },
        { id: 'gc', label: 'compaction' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['characters and IDs', 'metadata per edit'],
        ['format ranges', 'overlap queries'],
        ['active styles', 'incremental patches'],
        ['causal safety', 'coordination'],
      ],
    ),
    highlight: { active: ['sequence:stores', 'marks:stores'], compare: ['gc:cost'] },
    explanation: 'This table is the systems cost. Once marks are ranges, the editor repeatedly asks which marks cover the visible span. Interval indexes, segment trees, and incremental render caches become practical infrastructure, not academic extras.',
  };
}

function* editorPipeline() {
  yield {
    state: graphState({
      nodes: [
        { id: 'ui', label: 'UI', x: 0.9, y: 4.0, note: 'editor' },
        { id: 'tx', label: 'tx', x: 2.3, y: 4.0, note: 'change' },
        { id: 'ops', label: 'ops', x: 3.8, y: 4.0, note: 'intent' },
        { id: 'crdt', label: 'CRDT', x: 5.4, y: 4.0, note: 'log' },
        { id: 'patch', label: 'patch', x: 7.1, y: 4.0, note: 'delta' },
        { id: 'view', label: 'view', x: 8.8, y: 4.0, note: 'render' },
      ],
      edges: [
        { id: 'e-ui-tx', from: 'ui', to: 'tx' },
        { id: 'e-tx-ops', from: 'tx', to: 'ops' },
        { id: 'e-ops-crdt', from: 'ops', to: 'crdt' },
        { id: 'e-crdt-patch', from: 'crdt', to: 'patch' },
        { id: 'e-patch-view', from: 'patch', to: 'view' },
      ],
    }, { title: 'Editor integration is a pipeline' }),
    highlight: { active: ['tx', 'ops', 'crdt'], found: ['patch', 'view'] },
    explanation: 'The pipeline is the integration boundary. Editor transactions are translated into CRDT operations; CRDT changes emit patches; patches update the editor view. Keeping this boundary clean prevents the algorithm core from becoming the whole editor.',
    invariant: 'The CRDT core should not become the whole editor.',
  };

  yield {
    state: labelMatrix(
      'Product responsibilities',
      [
        { id: 'local', label: 'local buffer' },
        { id: 'rich', label: 'rich CRDT' },
        { id: 'sync', label: 'sync' },
        { id: 'auth', label: 'auth' },
        { id: 'history', label: 'history' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'risk', label: 'risk if mixed' },
      ],
      [
        ['cursor and edits', 'slow typing'],
        ['merge semantics', 'lost intent'],
        ['delivery/order', 'missed updates'],
        ['permissions', 'data leak'],
        ['branches/undo', 'confusing recovery'],
      ],
    ),
    highlight: { found: ['rich:owns', 'sync:owns'], compare: ['auth:risk', 'history:risk'] },
    explanation: 'Peritext is an algorithmic core. A serious local-first editor still needs fast local storage, sync transport, permissions, awareness, history UI, schema rules, and observability.',
  };

  yield {
    state: labelMatrix(
      'What Peritext does not solve alone',
      [
        { id: 'blocks', label: 'block layout' },
        { id: 'diffs', label: 'version diffs' },
        { id: 'schema', label: 'schema' },
        { id: 'undo', label: 'undo' },
      ],
      [
        { id: 'status', label: 'status' },
        { id: 'engineering', label: 'engineering work' },
      ],
      [
        ['future scope', 'tables/headings'],
        ['outside core', 'review UI'],
        ['app layer', 'valid document'],
        ['hard', 'intent aware'],
      ],
    ),
    highlight: { compare: ['blocks:status', 'diffs:status'], active: ['schema:engineering', 'undo:engineering'] },
    explanation: 'This step names what Peritext does not solve by itself. Inline mark convergence is the core. Tables, review UI, branch comparison, undo policy, permissions, and schema validation still need product-level data structures.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'document size', min: 0, max: 100 }, y: { label: 'metadata pressure', min: 0, max: 100 } },
      series: [
        { id: 'plain', label: 'plain text buffer', points: [{ x: 10, y: 8 }, { x: 50, y: 18 }, { x: 100, y: 32 }] },
        { id: 'seq', label: 'sequence CRDT', points: [{ x: 10, y: 15 }, { x: 50, y: 48 }, { x: 100, y: 82 }] },
        { id: 'rich', label: 'rich marks', points: [{ x: 10, y: 18 }, { x: 50, y: 57 }, { x: 100, y: 92 }] },
      ],
    }),
    highlight: { active: ['rich'], compare: ['plain', 'seq'] },
    explanation: 'The chart is conceptual. CRDT collaboration spends metadata to avoid coordination. Rich text adds mark metadata and range queries on top of the sequence layer, so compaction and incremental rendering become product-critical.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'format merge') yield* formatMerge();
  else if (view === 'span anchors') yield* spanAnchors();
  else if (view === 'editor pipeline') yield* editorPipeline();
  else throw new InputError('Pick a Peritext view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tables as two layers. Active text cells show character order from the sequence CRDT, while active mark cells show formatting intent anchored over that stable text.',
        'A CRDT is a conflict-free replicated data type, which means replicas can accept local edits and later converge after exchanging operations. The safe inference rule is that rich text converges only when formatting is stored as semantic operations, not as hidden marker characters.',
        {type:'callout', text:'Rich-text CRDTs converge by storing formatting as anchored semantic spans instead of smuggling intent through inline marker characters.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Plain collaborative text is already hard because users can insert and delete while offline. Rich text adds marks such as bold, links, comments, highlights, and suggestions that cover ranges of text.',
        'Peritext exists because a document can converge as bytes while formatting intent is lost. If Alice bolds The fox and Bob bolds fox jumped, the merged result should preserve the overlapping semantic ranges rather than interleaved punctuation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to encode formatting as Markdown, HTML, or hidden control characters inside a plain sequence CRDT. Bold becomes marker text, a link becomes inline syntax, and comments become tokens.',
        'That is attractive because one sequence data structure stores everything. It works for single-user serialization, but it gives the merge algorithm the wrong object: marker bytes instead of formatting intent.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is overlapping intent. Bold can overlap a link, a comment can cover part of a bold span, and a deletion can remove text inside a mark without deleting the whole mark.',
        'Boundary behavior is another wall. Text inserted at the end of bold often should inherit bold, while text inserted at the end of a link usually should not become part of the URL.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate character order from mark semantics. The sequence CRDT owns stable character identities, while mark operations anchor before or after those identities and describe formatting over ranges.',
        'Rendering becomes a deterministic projection. Given the same sequence, mark log, and boundary rules, every replica computes the same visible spans even if operations arrived in different orders.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each text insertion creates character identities such as operation 18 from replica A. A mark operation then stores type, value, start anchor, end anchor, and boundary behavior relative to those identities.',
        'When the editor renders, it sweeps the visible sequence, applies add and remove mark operations, resolves overlaps, and emits styled spans. Large documents need interval indexes or incremental render caches so one keystroke does not rescan the whole history.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'The first invariant is sequence convergence. If all replicas receive the same text operations, the sequence CRDT gives them the same ordered character identities.',
        'The second invariant is deterministic mark projection. Since marks refer to stable identities instead of mutable offsets, concurrent insertions move around anchors without changing what the mark operation originally meant.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is metadata. A plain buffer stores characters; a rich-text CRDT stores character identities, causal metadata, tombstones or compaction state, mark operations, anchors, and render indexes.',
        'Typing cost matters more than merge cost in the editor loop. If a 100,000-character document has 8,000 marks and each keystroke scans every mark, local typing becomes slow even though eventual convergence is correct.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Peritext-style models fit local-first notes, collaborative documents, design annotations, code notebooks, and knowledge bases where inline marks are product data. A comment or suggestion has identity, author, permissions, and history.',
        'They are useful when offline editing matters. Users can change text and marks locally, sync later, and still converge without a central server ordering every edit in real time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when treated as the whole editor. The product still needs schema validation, block layout, copy-paste policy, permissions, presence, storage, search, and undo.',
        'It may also be unnecessary for append-only chat, generated reports, or documents where a server-authoritative model is acceptable. Rich CRDT metadata is a tax that should buy real offline or concurrent-editing value.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with three words: The fox jumped. Alice selects characters 0 through 7 and adds bold, while Bob selects characters 4 through 14 and adds bold on another replica.',
        'With Markdown markers, the replicas may interleave four marker insertions and create ambiguous syntax. With Peritext, Alice creates one bold mark over identities for The fox, Bob creates one bold mark over identities for fox jumped, and the renderer computes bold over the union.',
        'Now a user inserts red at the end of a bold phrase and inserts .com at the end of a link. The bold boundary can be inclusive so red inherits bold, while the link boundary can be exclusive so .com does not silently extend the URL.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Ink and Switch Peritext article at https://www.inkandswitch.com/peritext/, the PACM HCI paper at https://www.inkandswitch.com/peritext/static/cscw-publication.pdf, the ACM DOI at https://doi.org/10.1145/3555644, the prototype at https://github.com/inkandswitch/peritext, and Loro rich text notes at https://loro.dev/blog/loro-richtext.',
        'Next, study Sequence CRDTs for Collaborative Text, CRDTs and Logical Clocks, Interval Tree, Segment Tree, Piece Table Text Buffer, Text Rope Data Structure, Operational Transformation Collaborative Editing, Local-First Sync Engine, and Collaborative Undo/Redo Intention Stack. These topics cover order, range queries, local editing speed, and recovery.',
      ],
    },
  ],
};