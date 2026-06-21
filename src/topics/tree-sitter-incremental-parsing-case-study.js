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
      heading: 'Why this exists',
      paragraphs: [
        `Tree-sitter exists because code editors need syntax information while the code is changing. A user types half a function, deletes a brace, pastes a block, or opens a file with mixed languages. The editor still has to highlight tokens, fold blocks, show local symbols, support structural selection, and keep diagnostics useful.`,
        `A compiler-style parser is usually built for a different moment. It receives a complete file or compilation unit and can reject invalid input. An editor parser lives during the messy middle. Most source buffers are temporarily broken many times per minute, and the parser must recover quickly enough that the UI does not lag behind typing.`,
        `Tree-sitter is a parser generator and incremental parsing library designed for that editor workload. It keeps a concrete syntax tree synchronized with an editable buffer, reuses unchanged subtrees after edits, and reports the ranges whose syntax actually changed. That makes syntax a maintained data structure rather than a full-file rebuild.`,
        {type:'callout', text:`Incremental parsing treats syntax as maintained editor state, repairing the old tree just enough to reuse unchanged structure.`},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive editor pipeline reparses the entire file after every edit and repaints every syntax-dependent feature. This is easy to reason about. The current buffer goes in, a new tree comes out, and the editor throws away all old derived state. For small files and simple grammars, it may be fine.`,
        `The wall appears when files grow, grammars become ambiguous, and editor features stack up. Syntax highlighting, folding, symbol extraction, code navigation, lint rules, semantic tokens, and language server requests all depend on the parse. If every keystroke invalidates everything, one local edit can create global work and visible jank.`,
        `There is also a correctness problem. If the editor has cached node handles, query captures, symbol ranges, or diagnostic positions, a full reset must invalidate all of them exactly. A stale range can paint the wrong text. A stale symbol can point navigation to the wrong function. Reparse-everything sounds simple until the editor has many caches that must agree on the same source version.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that most edits do not change most of the syntax tree. Renaming a variable inside a function should not rebuild the parse of every other function. Inserting an argument should not force the editor to rediscover unrelated class declarations. If the old tree is adjusted into the new coordinate space, a parser can reuse large unchanged subtrees.`,
        `Tree-sitter treats an edit as structured data. The edit records old byte positions, new byte positions, old row-column points, and new row-column points. The old tree is edited first so its node ranges match the new buffer coordinates. The parser then receives the new text plus the edited old tree and can search for reusable structure.`,
        `The result is not only a new tree. The system can compute changed ranges. Those ranges are the bridge from parsing to tooling. Highlighting, folding, query captures, symbol indexes, and UI repaint can update locally instead of pretending the whole file became unknown.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The editor starts with a text buffer, often backed by a rope, piece table, or similar edit-friendly structure. When the user inserts or deletes text, the editor knows the span that changed. That span is translated into byte offsets and row-column points because parser nodes need both raw byte positions and human line-column positions.`,
        `Before reparsing, the old syntax tree receives the same edit. This does not make the old tree correct. It shifts the old tree so unchanged nodes now point at their new positions. Without this step, a reusable subtree would have old coordinates and would corrupt every downstream cache.`,
        `The parser then reads the new buffer and the edited old tree. Where grammar context still matches, it can keep old subtrees. Where the edit changed syntax, it reparses. The changed-ranges comparison identifies parts of the old and new trees whose structure differs. An editor can use those ranges to repaint only affected text and update local indexes.`,
        `Queries turn the concrete tree into features. A query pattern matches nodes, fields, anonymous tokens, error nodes, or missing nodes and emits captures such as a function name, string literal, or fold boundary. The query layer is why Tree-sitter can support many editor features without writing a custom walker for every task.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The edit-and-reuse visual proves that parsing is part of a cache pipeline. Buffer, old tree, edit record, parser, new tree, changed ranges, query results, and UI refresh must all refer to one source version. The important motion is not "parse again." The important motion is "repair the old structure enough to reuse what remains true."`,
        `The queries-and-tooling visual proves why Tree-sitter keeps a concrete syntax tree rather than only a clean abstract syntax tree. Editors care about punctuation, anonymous tokens, error nodes, missing tokens, and field names. A formatter, highlighter, fold provider, symbol index, and diagnostic view all need slightly different slices of the same tree.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Incremental parsing works when the parser can preserve this invariant: reused nodes describe exactly the same source text and grammar structure as before, just at updated positions. The edit operation preserves coordinates. The parser's grammar checks preserve syntactic validity around the edit. Changed ranges expose the remaining uncertainty to downstream tools.`,
        `The approach also works because concrete syntax is stable enough for editor features. A compiler may discard punctuation and recover a semantic AST later. An editor cannot. The user sees tokens, commas, braces, comments, and incomplete statements. Keeping named and anonymous nodes lets the same tree serve both AST-like walks and token-level features.`,
        `Error and missing nodes are part of the correctness story. During editing, code is often invalid. Tree-sitter can represent unrecognized text as ERROR nodes and recovered absent tokens as MISSING nodes. That means tools can keep working around broken code instead of falling back to raw text until the file compiles again.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Incremental parsing is usually much cheaper than whole-file parsing, but it is not magic constant time. Some edits have a wide blast radius. An unclosed string can change how the rest of the file tokenizes. A deleted brace can move many statements into a different block. A grammar ambiguity can force wider repair. Embedded languages can require several trees and included ranges.`,
        `The maintained tree also consumes memory. The editor keeps source text, syntax tree nodes, query caches, symbol indexes, diagnostics, and painted ranges. Each cache must be invalidated by version and range. A fast parser with sloppy cache discipline still produces wrong UI.`,
        `Grammar quality matters. A grammar that is too permissive may recover quickly but hide real errors. A grammar that is too brittle may produce large ERROR regions and poor highlighting while users type. Good editor grammars are engineered for partial code, not just for final programs.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Tree-sitter wins in code editors, code search, structural selection, syntax highlighting, folding, local symbol extraction, simple lint rules, refactoring helpers, and language-aware navigation. The common access pattern is local change followed by local refresh. That is exactly the workload incremental parsing is built for.`,
        `It is also useful for tooling that wants consistent syntax across many languages. A query can capture functions, classes, calls, comments, or strings in a grammar-specific way while exposing a common matching model. This is why Tree-sitter is attractive for editor ecosystems and code intelligence tools that need broad language coverage.`,
        `The curriculum bridge is clean. Text Rope or Piece Table explains editable buffers. Parser topics explain grammars. Tree-sitter shows how those ideas become an interactive system: edit positions, concrete syntax trees, query captures, changed ranges, and UI invalidation.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Tree-sitter is not a full compiler. It does not solve type checking, cross-file symbol resolution, macro expansion, build-system configuration, module resolution, or semantic refactoring by itself. A language server may use Tree-sitter as a fast syntax layer, but deeper intelligence needs more context.`,
        `Stored node references can go stale if code keeps them across edits without checking tree versions. Query captures can also go stale. Embedded languages add another risk: the host tree must identify included ranges correctly, and child parsers must parse the right spans. A bug in that boundary can make syntax features disappear or apply to the wrong language.`,
        `The last failure mode is over-trusting changed ranges. They describe syntax structure changes, not every semantic consequence. Renaming a function may affect references elsewhere even if the syntax tree outside the local range did not change. Incremental syntax is a foundation, not the whole editor brain.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Text Rope and Piece Table for editable buffers, Pratt Parser and JSON Parser Stack for parsing basics, Zipper Focused Tree for localized tree updates, Virtual DOM for another changed-range rendering model, and Yjs Struct Store for collaborative text updates.`,
        `For primary Tree-sitter references, read the basic parsing guide, advanced parsing guide, query syntax guide, and the Tree-sitter repository. Then build a small experiment: parse a file, apply one edit, update the old tree, reparse, print changed ranges, and rerun one query only inside those ranges. That exercise makes the cache contract concrete.`,
      ],
    },
  ],
};
