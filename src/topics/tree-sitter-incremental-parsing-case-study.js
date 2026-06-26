// Tree-sitter incremental parsing: edit-aware concrete syntax trees for
// editors, code intelligence, and language-aware tooling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tree-sitter-incremental-parsing-case-study',
  title: 'Tree-sitter Incremental Parsing Case Study',
  category: 'Systems',
  summary: 'How Tree-sitter keeps code intelligence fast: edit the old concrete syntax tree, reparse with structural sharing, and query only changed ranges.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['edit and reuse', 'queries and tooling'], defaultValue: 'edit and reuse' },
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

function editGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'buffer', label: 'buffer', x: 0.7, y: 3.5, note: notes.buffer ?? 'rope/table' },
      { id: 'oldTree', label: 'old tree', x: 2.2, y: 1.8, note: notes.oldTree ?? 'CST' },
      { id: 'edit', label: 'edit', x: 3.7, y: 3.5, note: notes.edit ?? 'byte+point' },
      { id: 'parser', label: 'parser', x: 5.4, y: 3.5, note: notes.parser ?? 'grammar' },
      { id: 'newTree', label: 'new tree', x: 7.1, y: 1.8, note: notes.newTree ?? 'shared' },
      { id: 'ranges', label: 'ranges', x: 7.1, y: 5.3, note: notes.ranges ?? 'changed' },
      { id: 'ui', label: 'editor UI', x: 9.0, y: 3.5, note: notes.ui ?? 'refresh' },
    ],
    edges: [
      { id: 'e-buffer-edit', from: 'buffer', to: 'edit', weight: 'text' },
      { id: 'e-old-edit', from: 'oldTree', to: 'edit', weight: 'adjust' },
      { id: 'e-edit-parser', from: 'edit', to: 'parser', weight: 'old tree' },
      { id: 'e-parser-new', from: 'parser', to: 'newTree', weight: 'reuse' },
      { id: 'e-new-ranges', from: 'newTree', to: 'ranges', weight: 'diff' },
      { id: 'e-ranges-ui', from: 'ranges', to: 'ui', weight: 'small repaint' },
      { id: 'e-new-ui', from: 'newTree', to: 'ui', weight: 'queries' },
    ],
  }, { title });
}

function toolingGraph(title) {
  return graphState({
    nodes: [
      { id: 'tree', label: 'CST', x: 0.8, y: 3.5, note: 'named+anon' },
      { id: 'query', label: 'query', x: 2.7, y: 2.1, note: 'patterns' },
      { id: 'captures', label: 'captures', x: 4.8, y: 2.1, note: '@name' },
      { id: 'highlight', label: 'highlight', x: 7.0, y: 1.2, note: 'tokens' },
      { id: 'fold', label: 'folds', x: 7.0, y: 2.9, note: 'ranges' },
      { id: 'symbols', label: 'symbols', x: 7.0, y: 4.6, note: 'index' },
      { id: 'errors', label: 'errors', x: 7.0, y: 6.3, note: 'ERROR/MISS' },
      { id: 'lsp', label: 'LSP', x: 9.0, y: 3.8, note: 'features' },
    ],
    edges: [
      { id: 'e-tree-query', from: 'tree', to: 'query', weight: 'match' },
      { id: 'e-query-captures', from: 'query', to: 'captures', weight: 'captures' },
      { id: 'e-cap-highlight', from: 'captures', to: 'highlight', weight: '' },
      { id: 'e-cap-fold', from: 'captures', to: 'fold', weight: '' },
      { id: 'e-cap-symbols', from: 'captures', to: 'symbols', weight: '' },
      { id: 'e-tree-errors', from: 'tree', to: 'errors', weight: 'recover' },
      { id: 'e-highlight-lsp', from: 'highlight', to: 'lsp', weight: '' },
      { id: 'e-fold-lsp', from: 'fold', to: 'lsp', weight: '' },
      { id: 'e-symbols-lsp', from: 'symbols', to: 'lsp', weight: '' },
      { id: 'e-errors-lsp', from: 'errors', to: 'lsp', weight: '' },
    ],
  }, { title });
}

function* editAndReuse() {
  yield {
    state: editGraph('Tree-sitter makes each keystroke an edit, not a full reset'),
    highlight: { active: ['buffer', 'oldTree', 'edit', 'parser'], found: ['newTree'] },
    explanation: 'A text editor already knows the inserted or deleted span. Tree-sitter uses that edit to adjust the old tree before reparsing, so unchanged subtrees can be reused.',
    invariant: 'The old tree must be edited to match the new byte and row-column positions before it is reused.',
  };

  yield {
    state: labelMatrix(
      'Incremental parse ledger',
      [
        { id: 'span', label: 'span' },
        { id: 'old', label: 'old' },
        { id: 'parse', label: 'parse' },
        { id: 'diff', label: 'diff' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'job', label: 'job' },
      ],
      [
        ['pos', 'locate'],
        ['CST', 'shift'],
        ['gram', 'reuse'],
        ['range', 'paint'],
      ],
    ),
    highlight: { active: ['span:job', 'old:job', 'parse:job'], found: ['diff:job'] },
    explanation: 'The practical data structure is a ledger of positions, tree nodes, and changed ranges. UI code should update only the ranges whose syntax structure actually changed.',
  };

  yield {
    state: editGraph('Changed ranges bound the blast radius of an edit', { edit: 'rename', ranges: 'small', ui: 'repaint' }),
    highlight: { active: ['edit', 'parser', 'newTree', 'ranges', 'e-new-ranges'], compare: ['buffer'], found: ['ui'] },
    explanation: 'If a variable name changes inside one function, highlighting and symbols outside that function should not be recomputed from scratch. Changed ranges are the bridge between parser work and editor work.',
  };

  yield {
    state: labelMatrix(
      'When reuse fails',
      [
        { id: 'quote', label: 'quote' },
        { id: 'brace', label: 'brace' },
        { id: 'grammar', label: 'grammar' },
        { id: 'embed', label: 'embed' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['string', 'wide'],
        ['block', 'parent'],
        ['ambig', 'err'],
        ['mixed', 'ranges'],
      ],
    ),
    highlight: { active: ['quote:effect', 'brace:effect'], found: ['embed:guard'] },
    explanation: 'Incremental does not mean every keystroke is tiny. Unclosed strings, braces, grammar ambiguity, and embedded languages can widen the affected region. The system still gives a bounded, explicit repair path.',
  };
}

function* queriesAndTooling() {
  yield {
    state: toolingGraph('Queries turn syntax trees into editor features'),
    highlight: { active: ['tree', 'query', 'captures', 'e-tree-query', 'e-query-captures'], found: ['highlight', 'symbols'] },
    explanation: 'Tree-sitter query patterns match concrete syntax tree nodes and emit named captures. Those captures drive syntax highlighting, folding, symbol extraction, lint rules, and refactoring helpers.',
  };

  yield {
    state: labelMatrix(
      'Concrete tree tradeoffs',
      [
        { id: 'named', label: 'named' },
        { id: 'anon', label: 'anon' },
        { id: 'field', label: 'field' },
        { id: 'err', label: 'error' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'use', label: 'use' },
      ],
      [
        ['grammar', 'walk'],
        ['punct', 'format'],
        ['roles', 'query'],
        ['bad', 'diag'],
      ],
    ),
    highlight: { active: ['named:use', 'field:use'], compare: ['anon:use'], found: ['err:use'] },
    explanation: 'A concrete syntax tree keeps punctuation and error nodes, which matters for editors. Named nodes make semantic walks easier, while anonymous nodes keep formatting and token-level features possible.',
    invariant: 'Editor tooling needs a tree that survives broken code, not only valid programs.',
  };

  yield {
    state: toolingGraph('Error and missing nodes make broken programs usable'),
    highlight: { active: ['tree', 'errors', 'e-tree-errors'], found: ['lsp'], compare: ['highlight'] },
    explanation: 'During editing, code is usually incomplete. Tree-sitter represents unrecognized text with ERROR nodes and can expose missing tokens, so the editor can keep showing useful structure.',
  };

  yield {
    state: labelMatrix(
      'Complete IDE pipeline',
      [
        { id: 'edit', label: 'edit' },
        { id: 'parse', label: 'parse' },
        { id: 'query', label: 'query' },
        { id: 'index', label: 'index' },
        { id: 'paint', label: 'paint' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['edit', 'offset'],
        ['CST', 'wide'],
        ['caps', 'gram'],
        ['sym', 'stale'],
        ['range', 'jank'],
      ],
    ),
    highlight: { active: ['edit:artifact', 'parse:artifact', 'query:artifact'], found: ['paint:risk'] },
    explanation: 'A serious code editor is a cache invalidation machine: edit positions, parse trees, query captures, symbol indexes, and painted ranges must all agree on the same source version.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'edit and reuse') yield* editAndReuse();
  else if (view === 'queries and tooling') yield* queriesAndTooling();
  else throw new InputError('Pick a Tree-sitter view.');
}


export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Read the edit view as a cache update, not a full reset. Active nodes show the buffer edit, old-tree adjustment, parser repair, or changed-range calculation.', 'A concrete syntax tree keeps punctuation, tokens, and error nodes. A changed range is the span whose syntax structure changed, so tooling outside it can often be reused.', {type:'callout', text:`Incremental parsing treats syntax as maintained editor state, repairing the old tree just enough to reuse unchanged structure.`}]},
    { heading: 'Why this exists', paragraphs: ['Editors need syntax while code is incomplete. A user can delete a brace or type half a string, and the editor still needs highlighting, folding, symbols, and diagnostics.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is parsing the whole file after every edit. That is simple for small files but expensive when every feature depends on the parse.']},
    { heading: 'The wall', paragraphs: ['Most edits are local, but full reparsing treats them as global. The wall is cache invalidation across node positions, query captures, diagnostics, folds, and symbols.']},
    { heading: 'The core insight', paragraphs: ['Keep syntax as maintained state. Edit the old tree into the new coordinate space, reuse unchanged subtrees, and reparse only grammar regions that changed.']},
    { heading: 'How it works', paragraphs: ['The editor records old and new byte positions plus row-column points. Tree-sitter applies that edit to the old tree, reparses with the new buffer, and exposes changed ranges for queries and UI refresh.']},
    { heading: 'Why it works', paragraphs: ['A reused node must describe the same source text and grammar structure as before, only at updated positions. Error and missing nodes keep the tree useful while the program is temporarily broken.']},
    { heading: 'Cost and complexity', paragraphs: ['A local rename in a 10,000-line file may repaint one function instead of all 10,000 lines. Deleting an opening quote or brace can still widen the repair region, so the cost is local on common edits and wider on grammar-breaking edits.']},
    { heading: 'Real-world uses', paragraphs: ['Tree-sitter powers syntax highlighting, folding, symbols, structural selection, code search, local lint rules, and refactoring helpers. The workload is local edit followed by local refresh.']},
    { heading: 'Where it fails', paragraphs: ['Tree-sitter is syntax, not full language semantics. It does not solve type checking, module resolution, macro expansion, or cross-file reference correctness by itself.']},
    { heading: 'Worked example', paragraphs: ['In a 5,000-line file, changing customerId to customerID inside one function shifts later bytes by 1. The parser reparses the function and reports one changed line; deleting the function\'s closing brace could expand the changed range hundreds of lines.']},
    { heading: 'Sources and study next', paragraphs: ['Read Tree-sitter basic parsing, advanced parsing, query syntax, and repository documentation. Study Text Rope, Piece Table, Parser State Machine, Zipper Focused Tree, Virtual DOM, Language Server Protocol, and Yjs Struct Store next.']},
  ],
};