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
    explanation: 'Peritext starts from user intent, not from a serialization trick. If Alice bolds "The fox" while Bob bolds "fox jumped", the intended merged result is the whole sentence bold.',
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
    explanation: 'The Peritext article shows that encoding rich text as Markdown inside a plain text CRDT can interleave control characters. The merged character stream converges, but the rendered formatting can betray both authors.',
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
    explanation: 'Peritext treats marks differently at boundaries. Bold and italic often grow when text is inserted at an edge. Links and comments usually should not grow, because extending the URL or annotation changes meaning.',
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
    explanation: 'Peritext stores text with an underlying sequence CRDT, then represents formatting as mark operations whose start and end refer to positions around CRDT character IDs.',
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
    explanation: 'The paper describes rich formatting as operations over an append-only history. Rendering derives the visible document by applying text operations and active formatting spans in a deterministic order.',
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
    explanation: 'A production implementation needs indexes over ranges, not just a theoretical merge function. Interval Tree and Segment Tree ideas reappear when the editor asks which marks cover this visible span.',
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
    explanation: 'The Peritext prototype integrates with ProseMirror. Editor transactions become CRDT input operations; CRDT changes emit patches; patches become editor updates.',
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
    explanation: 'The paper explicitly focuses on inline formatting and says more work is needed for asynchronous collaboration features such as version visualization. The honest lesson is a boundary: convergence core first, product workflow around it.',
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
      heading: 'What it is',
      paragraphs: [
        'Peritext is a CRDT algorithm for collaborative rich-text editing. Plain sequence CRDTs already let replicas insert and delete characters without a central lock, but rich text adds another dimension: bold, italic, links, comments, colors, and other annotations apply over ranges. If those ranges are encoded as ordinary hidden characters or Markdown markers, concurrent edits can converge to the same bytes while rendering the wrong formatting.',
        'The useful mental model is two-layered. A Sequence CRDT owns the order and identity of text elements. Peritext adds formatting operations whose spans anchor to stable CRDT positions around those elements. The rendered editor document is derived from the text sequence plus active marks, rather than stored as one mutable HTML or Markdown string.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Peritext starts by analyzing examples of author intent. If Alice bolds "The fox" while Bob concurrently bolds "fox jumped", the desirable merge is that all three words become bold. Markdown markers in a plain text CRDT can interleave and accidentally unbold the overlap. Hidden start/end control characters have similar boundary anomalies. Peritext avoids that by representing formatting as operations over ranges.',
        'A mark operation records the type of mark, an operation id, and start/end positions such as before or after a stable character id. Applying operations builds internal document state. Rendering sweeps the text sequence and marks to produce the editor view. Different mark types can have different boundary behavior: bold and italic often extend when typing at their edges, while links and comments usually should not automatically grow.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Peritext buys intention preservation with metadata. The underlying sequence CRDT stores element ids, causal structure, and deletion state. The rich-text layer stores add/remove mark operations and range boundaries. Rendering may need efficient lookup of active marks over the visible span, which connects naturally to Interval Tree, Segment Tree, and editor piece indexing ideas.',
        'The hard cost is not only asymptotic. A real editor needs low-latency typing, incremental patches, stable cursor behavior, undo, copy-paste, schema validation, compaction, sync transport, and permission checks. If every keystroke forces a full document render, the merge algorithm can be correct and still unusable.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a local-first notes app. Each paragraph has a fast local text buffer for typing, a sequence CRDT for replicated ordering, and a Peritext-style mark log for inline formatting. Alice edits offline on a train, bolds a phrase, and adds a comment. Bob concurrently inserts a sentence and links a term. When the devices sync, their text operations and mark operations are merged in any delivery order. Both replicas derive the same final view, and the result tries to preserve the visible intent of both edits.',
        'The product architecture should keep layers separate. The editor UI emits transactions. A translation layer turns them into CRDT input operations. The CRDT log persists and syncs compact updates. A renderer maps CRDT patches back into the local editor. Authorization and document sharing must sit outside the merge algorithm; a correct CRDT should never be asked to merge unauthorized private text into another user\'s context.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that convergence equals user intent. A CRDT can guarantee all replicas agree while still agreeing on a bad rendering; an Operational Transformation system can also converge while transforming a range in a way users did not mean. Rich text needs a model of formatting behavior, not only a conflict-free byte sequence or a correct-looking position shift. The second misconception is that Peritext replaces local text data structures. It does not. Gap Buffer Text Editor, Piece Table Text Buffer, and Text Rope Data Structure still matter for local editing speed, undo, and large documents.',
        'The third trap is treating inline formatting as the whole problem. The Peritext paper focuses on inline marks within a paragraph and explicitly leaves broader collaboration workflows open. Block elements, tables, comments with mutable bodies, branch review UI, conflict surfacing, permissions, and history visualization still need product and data-structure design.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Ink & Switch Peritext article at https://www.inkandswitch.com/peritext/, Peritext PACM HCI PDF at https://www.inkandswitch.com/peritext/static/cscw-publication.pdf, ACM DOI at https://doi.org/10.1145/3555644, Peritext prototype repository at https://github.com/inkandswitch/peritext, and Loro rich-text CRDT discussion at https://loro.dev/blog/loro-richtext. Study Sequence CRDTs for Collaborative Text, Operational Transformation Collaborative Editing Case Study, Local-First Sync Engine Case Study, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, CRDTs, Logical Clocks, Interval Tree, Segment Tree, Piece Table Text Buffer, Text Rope Data Structure, and Cloudflare Durable Objects Case Study next.',
      ],
    },
  ],
};
