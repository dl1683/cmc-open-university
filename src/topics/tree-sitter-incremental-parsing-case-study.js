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
    {
      heading: 'What it is',
      paragraphs: [
        'Tree-sitter is a parser generator and incremental parsing library for programming tools. It builds concrete syntax trees for source files and updates those trees efficiently as the source changes. The important data-structure idea is not just parsing. It is keeping a versioned, position-aware tree synchronized with an editor buffer.',
        'This belongs after Parser Design Patterns Primer, Text Rope Data Structure, Piece Table Text Buffer, Pratt Parser Expression AST, and Zipper Focused Tree. Those topics explain inputs, edits, expression trees, and localized tree navigation. Tree-sitter combines them into a production editor substrate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'After an edit, the application records the changed byte span and row-column span. It applies that edit to the old tree so existing node positions shift into the new coordinate space. Then the parser reparses with the edited old tree, producing a new tree that can internally share unchanged structure.',
        'The resulting old-versus-new comparison yields changed ranges: source regions whose syntax ancestry changed. Editors can use those ranges to refresh highlighting, folds, symbol indexes, diagnostics, and semantic caches without treating every keystroke as a whole-file reset.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The central structures are a source buffer, edit records, concrete syntax tree nodes, named and anonymous child relationships, field names, changed ranges, query patterns, and captures. The source buffer may be a rope or piece table; Tree-sitter can parse through a callback instead of requiring one flat string.',
        'The tree is concrete because editors care about punctuation, delimiters, comments, and broken syntax. Named nodes provide AST-like semantic traversal, while anonymous nodes preserve token-level detail. Error and missing nodes let the tree remain useful while code is incomplete.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A developer renames a JavaScript variable inside one function. The editor updates the piece table, constructs a Tree-sitter edit with old and new byte/point positions, edits the old tree, reparses with that old tree, and asks for changed ranges. Highlighting, local symbols, folding ranges, and diagnostics are refreshed only in the affected function body.',
        'A mixed HTML template adds a second layer. The outer grammar identifies embedded JavaScript or Ruby ranges. The application parses those included ranges with the inner-language parser, then merges query captures into one editor view. The key lesson is that language composition is coordinated by the application using ranges, not by pretending one grammar owns the whole file.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'Incremental parsing is not magic. An edit inside an unclosed string, a missing brace, or an ambiguous grammar region can widen the changed range. Stored node handles can become stale unless they are edited or refetched. Query captures also need versioning so UI features do not mix old-tree results with new-buffer text.',
        'The production failure mode is usually cache drift. The buffer, tree, changed ranges, query captures, symbol index, and painted UI must all refer to the same source version. If one layer updates while another layer lags, the editor shows wrong highlights, stale diagnostics, or broken refactors.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Tree-sitter repository at https://github.com/tree-sitter/tree-sitter, Tree-sitter basic parsing docs at https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html, Tree-sitter advanced parsing docs at https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html, and Tree-sitter query syntax docs at https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html. Study Parser Design Patterns Primer, Text Rope Data Structure, Piece Table Text Buffer, Pratt Parser Expression AST, Zipper Focused Tree, JSON Parser Stack, Yjs Struct Store Update Case Study, and Virtual DOM next.',
      ],
    },
  ],
};
