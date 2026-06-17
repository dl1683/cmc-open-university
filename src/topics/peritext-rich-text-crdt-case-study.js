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
      heading: 'Why This Exists',
      paragraphs: [
        'Collaborative text editing is hard even before formatting appears. A sequence CRDT can let Alice and Bob insert and delete characters offline, exchange operations later, and converge on the same character order. That solves the plain-text layer. Real editors need more. Users bold phrases, create links, attach comments, color spans, paste styled fragments, and expect those marks to survive concurrent editing.',
        'Peritext exists because rich text is not just plain text with prettier rendering. A document can converge as bytes while the user-visible formatting is wrong. If Alice bolds The fox and Bob bolds fox jumped, the merged document should usually preserve the union of their formatting intent. Treating that intent as punctuation or HTML inside the character stream gives the CRDT the wrong object to merge.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The obvious approach is to encode rich text as Markdown, HTML, or hidden control characters inside a plain text CRDT. Bold becomes a pair of marker characters. A link becomes inline syntax or a tag. A comment anchor becomes a hidden token. This is attractive because the editor can reuse the same sequence machinery for everything.',
        'That approach works for simple, single-user serialization. It fails as a merge model. Markers are ordinary characters to the CRDT, so concurrent formatting operations can interleave in ways that converge byte-for-byte while expressing neither user intention. The data structure preserved the string and lost the semantic range. The wall is not rendering; it is that formatting intent needs identity, anchors, and boundary rules of its own.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'The first wall is overlap. Rich-text marks are intervals over a changing sequence, and intervals overlap constantly. Bold can overlap a link. A comment can cover part of a bold span. A deletion can remove text inside a mark while leaving the mark meaningful around the remaining text. A plain start index and end index are unstable because concurrent edits move positions.',
        'The second wall is boundary behavior. New text inserted at the end of a bold phrase often should inherit bold because the user is continuing emphasis. New text inserted at the end of a link usually should not extend the URL. New text at the edge of a comment often should sit outside the annotation. One generic range rule cannot express those different product semantics.',
        'The third wall is editor integration. A correct merge core is not a full editor. The product still needs local typing latency, selection state, undo, schema validation, comments with bodies, permissions, copy-paste policy, block structure, persistence, and sync. Peritext solves the inline mark convergence problem; it does not erase the surrounding application data structures.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'Peritext separates character order from formatting intent. A sequence CRDT owns stable character identities and order. Mark operations live in their own append-only history and anchor before or after those stable positions. Rendering is a deterministic projection from text plus marks into the visible editor view.',
        'That separation changes the merge problem. The text layer answers which characters exist and in what order. The mark layer answers which semantic ranges are active over those characters. Because marks are not hidden text, the system can merge overlapping bold, links, comments, and removals without asking punctuation characters to represent user intent.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'A character in the underlying sequence has an identity, often derived from an operation id or logical timestamp. Text operations insert or delete identities, and the sequence CRDT provides a deterministic order even when operations arrive in different orders on different replicas. Peritext adds mark operations that name a mark type, a value if needed, and a start and end anchor relative to character identities.',
        'Anchors matter because they are stable under concurrent insertion. A mark can start before one character identity and end after another. If new text arrives at an edge, the mark type can define whether that boundary is inclusive or exclusive. Bold can choose behavior that feels like continuing emphasis. A link can choose behavior that avoids accidentally extending the clickable URL.',
        'Rendering is a sweep over the visible sequence and the mark operations. The renderer computes active marks for each span, resolves additions and removals, and emits editor patches. For performance, a serious implementation does not rescan the whole document on every keypress. It builds interval indexes, segment structures, or incremental render caches over the visible ranges.',
      ],
    },
    {
      heading: 'Visual Proof',
      paragraphs: [
        'The overlapping-bold table proves that semantic intent and byte serialization are different. Alice bolds one range, Bob bolds an overlapping range, and the merged intent is a union over stable text positions. The Markdown-as-text table shows the counterexample: marker characters can interleave and still converge as text while the rendered style becomes ambiguous or wrong.',
        'The boundary table proves that a mark is more than two numbers. Insert after bold, insert after link, and insert after comment are all edge cases with different desired behavior. A data model that cannot represent per-mark boundary semantics will push those decisions into ad hoc editor code, where replicas can diverge or users can see surprising formatting.',
        'The span-anchor view proves the two-layer structure. The sequence stores character identities. A mark operation points to anchors around those identities. The rendering sweep proves the projection: the stored document is not one mutable HTML string. It is text plus mark history plus deterministic rendering rules.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument starts with convergence of the underlying sequence CRDT. If all replicas eventually receive the same text operations, they derive the same ordered set of character identities. Peritext then applies the same mark operations to the same identities. Since anchors refer to identities rather than mutable offsets, concurrent insertions do not change what an operation originally pointed at.',
        'Deterministic rendering completes the argument. Given the same sequence, same mark log, and same boundary rules, replicas compute the same active marks for each visible span. Rich-text correctness is not that every user always likes the result. It is that the system preserves expressed intent as operations and gives all replicas the same rules for projecting that intent into a document.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'The tax is metadata. A plain text buffer stores characters. A sequence CRDT stores characters plus identities, causal metadata, and tombstones or compaction state. Peritext adds mark operations, anchors, add/remove histories, boundary semantics, and render indexes. Document size, edit history, and mark density all increase pressure on memory and rendering.',
        'The dominant operation in an editor is often not merge; it is keeping typing fast. Each keystroke may need to update the local buffer, produce CRDT operations, adjust active marks, emit view patches, and preserve selection. If the renderer recomputes every mark over the whole document, the CRDT can be correct and the product can still feel broken. Incremental indexes are not optional polish for large documents.',
        'Compaction is difficult because old operations can carry semantic meaning. Removing tombstones or squashing mark history must remain causally safe for replicas that have not yet seen every operation. Undo is also hard. A user expects undo to reverse intent, not merely delete the last received operation from the global log. Collaborative undo needs its own intention model.',
      ],
    },
    {
      heading: 'Uses and Failure Modes',
      paragraphs: [
        'Peritext-style models fit local-first notes, collaborative documents, comments, design tools, code notebooks, and annotation-heavy knowledge bases. The fit is strongest when inline marks are product data. A comment, link, highlight, or suggestion is not decoration; it has identity, permissions, history, and user intent.',
        'It is the wrong abstraction for plain logs, append-only chat, or documents where formatting can be regenerated from a source format after edits. If users do not collaboratively edit overlapping rich spans, a simpler model may be enough. Operational transformation, server-authoritative editors, or block-level CRDTs may be better depending on latency, product semantics, and deployment constraints.',
        'The failure modes are semantic leaks between layers. Markdown markers can corrupt formatting intent. Mutable offsets can point at the wrong text after concurrent insertions. One-size-fits-all boundary rules can extend links or comments unexpectedly. Missing render indexes can make typing slow. Treating Peritext as a whole editor can leave schema, permissions, comments, block layout, presence, and storage unsolved.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: Ink and Switch Peritext article at https://www.inkandswitch.com/peritext/, Peritext PACM HCI PDF at https://www.inkandswitch.com/peritext/static/cscw-publication.pdf, ACM DOI at https://doi.org/10.1145/3555644, Peritext prototype repository at https://github.com/inkandswitch/peritext, and Loro rich-text CRDT discussion at https://loro.dev/blog/loro-richtext.',
        'Study Sequence CRDTs for Collaborative Text for the underlying order layer. Study CRDTs and Logical Clocks for convergence and causality. Study Interval Tree and Segment Tree for active-mark queries. Study Piece Table Text Buffer and Text Rope Data Structure for local editing performance. Study Operational Transformation Collaborative Editing Case Study for the main alternative tradition, Local-First Sync Engine Case Study for product integration, Collaborative Awareness Presence CRDT for cursors, and Collaborative Undo/Redo Intention Stack for the hard recovery path.',
      ],
    },
  ],
};
