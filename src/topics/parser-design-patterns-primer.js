// Parser design patterns: the reusable pipeline behind UTF-8, CSV, JSON,
// expression parsing, binary protocols, and streaming ingestion.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'parser-design-patterns-primer',
  title: 'Parser Design Patterns Primer',
  category: 'Concepts',
  summary: 'A primer tying parser topics together: bytes become characters, characters become tokens, tokens update stack or tree state, and outputs are events, ASTs, or typed values.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pipeline layers', 'streaming versus tree'], defaultValue: 'pipeline layers' },
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

function parserGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'bytes', label: 'bytes', x: 0.6, y: 4.0, note: notes.bytes ?? 'input' },
      { id: 'decode', label: 'decode', x: 2.2, y: 4.0, note: notes.decode ?? 'UTF-8' },
      { id: 'lexer', label: 'lexer', x: 3.9, y: 2.4, note: notes.lexer ?? 'tokens' },
      { id: 'parser', label: 'parser', x: 5.8, y: 4.0, note: notes.parser ?? 'grammar' },
      { id: 'state', label: 'state', x: 7.4, y: 2.4, note: notes.state ?? 'stack/FSM' },
      { id: 'output', label: 'output', x: 9.2, y: 4.0, note: notes.output ?? 'tree/event' },
      { id: 'errors', label: 'errors', x: 7.4, y: 6.2, note: notes.errors ?? 'spans' },
    ],
    edges: [
      { id: 'e-bytes-decode', from: 'bytes', to: 'decode', weight: '' },
      { id: 'e-decode-lexer', from: 'decode', to: 'lexer', weight: '' },
      { id: 'e-lexer-parser', from: 'lexer', to: 'parser', weight: '' },
      { id: 'e-parser-state', from: 'parser', to: 'state', weight: '' },
      { id: 'e-state-output', from: 'state', to: 'output', weight: '' },
      { id: 'e-parser-errors', from: 'parser', to: 'errors', weight: '' },
    ],
  }, { title });
}

function* pipelineLayers() {
  yield {
    state: parserGraph('A parser is a pipeline, not one giant if statement'),
    highlight: { active: ['bytes', 'decode', 'lexer', 'parser'], found: ['output'] },
    explanation: 'Most parsers become simpler when split into layers: byte decoding, lexical scanning, structural parsing, state management, output construction, and diagnostics.',
    invariant: 'Keep each layer responsible for one kind of meaning.',
  };

  yield {
    state: labelMatrix(
      'Layer responsibilities',
      [
        { id: 'decode', label: 'decode' },
        { id: 'lex', label: 'lex' },
        { id: 'parse', label: 'parse' },
        { id: 'build', label: 'build' },
        { id: 'diag', label: 'diagnose' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['bytes', 'characters/code points'],
        ['characters', 'tokens'],
        ['tokens', 'structure'],
        ['structure', 'tree/events/values'],
        ['source positions', 'actionable errors'],
      ],
    ),
    highlight: { active: ['decode:output', 'parse:output'], found: ['diag:output'] },
    explanation: 'A UTF-8 decoder should not know JSON grammar. A lexer should not build business objects. A parser should report what it expected at the current token. Separation makes failures explainable.',
  };

  yield {
    state: labelMatrix(
      'Which memory model fits?',
      [
        { id: 'fsm', label: 'finite state' },
        { id: 'stack', label: 'stack' },
        { id: 'tree', label: 'tree' },
        { id: 'table', label: 'table' },
      ],
      [
        { id: 'fits', label: 'fits' },
        { id: 'example', label: 'example' },
      ],
      [
        ['bounded modes', 'CSV quotes'],
        ['nested structure', 'JSON arrays'],
        ['semantic structure', 'expression AST'],
        ['operator policy', 'Pratt parselets'],
      ],
    ),
    highlight: { active: ['fsm:example', 'stack:example', 'tree:example'], compare: ['table:fits'] },
    explanation: 'The right state structure comes from the grammar. CSV needs a handful of modes. JSON needs nesting memory. Expressions need trees and operator tables.',
  };

  yield {
    state: parserGraph('Binary formats use the same discipline', { bytes: 'wire', decode: 'varint', lexer: 'field tag', parser: 'schema', state: 'reader', output: 'record' }),
    highlight: { active: ['bytes', 'decode', 'parser', 'state'], found: ['output'] },
    explanation: 'The pattern is not only for text. Protobuf and Avro still classify bytes, decode primitive values, consult schema state, and emit typed records.',
  };

  yield {
    state: labelMatrix(
      'The parser contract',
      [
        { id: 'valid', label: 'valid input' },
        { id: 'invalid', label: 'invalid input' },
        { id: 'partial', label: 'partial input' },
        { id: 'huge', label: 'huge input' },
      ],
      [
        { id: 'must', label: 'must do' },
        { id: 'avoid', label: 'avoid' },
      ],
      [
        ['emit one meaning', 'ambiguous output'],
        ['reject with location', 'silent repair'],
        ['resume or wait', 'lose state'],
        ['bound memory', 'load everything blindly'],
      ],
    ),
    highlight: { active: ['invalid:must', 'partial:must'], compare: ['huge:avoid'] },
    explanation: 'A production parser is a contract. It should accept one language, reject everything else clearly, preserve streaming state, and keep resource limits visible.',
  };
}

function* streamingVersusTree() {
  yield {
    state: parserGraph('The same parser can emit events or build a tree', { state: 'stack', output: 'events/tree' }),
    highlight: { active: ['parser', 'state', 'output', 'e-state-output'], found: ['errors'] },
    explanation: 'Output shape is a design choice. A SAX-style stream emits events as input arrives. A DOM-style parser builds a full tree. A compiler parser often builds an AST with source spans.',
    invariant: 'Choose output shape from the downstream workflow, not from parser convenience alone.',
  };

  yield {
    state: labelMatrix(
      'Output shapes',
      [
        { id: 'events', label: 'event stream' },
        { id: 'rows', label: 'row batches' },
        { id: 'tree', label: 'full tree' },
        { id: 'ast', label: 'AST' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['low memory', 'consumer must track state'],
        ['pipeline friendly', 'batch sizing'],
        ['random access', 'memory heavy'],
        ['analysis/refactor', 'more node types'],
      ],
    ),
    highlight: { active: ['events:strength', 'rows:strength'], compare: ['tree:cost'] },
    explanation: 'CSV ingestion usually wants row batches. Large JSON logs may want event streams. Editors and compilers want trees because later passes navigate and rewrite structure.',
  };

  yield {
    state: labelMatrix(
      'Resource guards',
      [
        { id: 'bytes', label: 'byte limit' },
        { id: 'depth', label: 'depth limit' },
        { id: 'field', label: 'field limit' },
        { id: 'time', label: 'time budget' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'failure', label: 'failure if missing' },
      ],
      [
        ['memory', 'giant payload'],
        ['stack/recursion', 'deep nesting'],
        ['row shape', 'wide records'],
        ['latency', 'UI freeze or timeout'],
      ],
    ),
    highlight: { active: ['bytes:protects', 'depth:protects'], found: ['time:failure'] },
    explanation: 'Parsers are attack surfaces. Size, depth, field-count, and time limits turn a neat grammar into something that survives production inputs.',
  };

  yield {
    state: parserGraph('Good diagnostics carry source spans through every layer', { lexer: 'token span', parser: 'expected', errors: 'line/col' }),
    highlight: { active: ['lexer', 'parser', 'errors', 'e-parser-errors'], compare: ['output'] },
    explanation: 'Diagnostics require bookkeeping. If the lexer discards positions, the parser can only say failed. If spans survive, the parser can say expected colon after key at line 12, column 8.',
  };

  yield {
    state: labelMatrix(
      'Complete design checklist',
      [
        { id: 'language', label: 'language' },
        { id: 'states', label: 'states' },
        { id: 'output', label: 'output' },
        { id: 'limits', label: 'limits' },
        { id: 'errors', label: 'errors' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['what is valid?', 'grammar/spec'],
        ['what memory?', 'FSM/stack/tree'],
        ['who consumes it?', 'events/tree/rows'],
        ['what can grow?', 'caps and budgets'],
        ['what helps repair?', 'source spans'],
      ],
    ),
    highlight: { active: ['states:artifact', 'output:artifact'], found: ['errors:artifact'] },
    explanation: 'This checklist is the reusable primer: name the language, choose the state structure, choose the output, cap the resources, and preserve enough source information to debug failures.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pipeline layers') yield* pipelineLayers();
  else if (view === 'streaming versus tree') yield* streamingVersusTree();
  else throw new InputError('Pick a parser-design view.');
}

export const article = {
  sections: [
    {
      heading: 'What A Parser Really Does',
      paragraphs: [
        'A parser turns raw input into one explicit meaning. That sounds simple until the input is malformed, partial, huge, ambiguous, encoded oddly, or hostile. Parser design is the work of making those cases boring.',
        { type: 'callout', text: 'Parser design is boundary design: each layer owns one kind of meaning and one kind of failure.' },
        'The same shape appears in UTF-8 decoders, CSV readers, JSON parsers, expression parsers, regex engines, Protobuf readers, Avro decoders, HTTP header compressors, SQL parsers, and compiler front ends. Bytes become characters or primitive values. Characters become tokens. Tokens update state. State emits events, rows, trees, typed records, or diagnostics.',
        'A production parser answers five questions before code starts: what language is valid, what state structure recognizes it, what output the caller needs, what resource limits protect the machine, and what error information helps a human or upstream system repair the input.',
      ],
    },
    {
      heading: 'The Obvious Approach And Its Wall',
      paragraphs: [
        'The obvious implementation is one large loop with many branches: read a byte, check a quote, append a character, maybe build an object, maybe throw an error. This works for tiny examples and becomes unmaintainable as soon as the grammar grows.',
        'The wall is responsibility collapse. A tangled parser cannot explain whether a failure came from invalid bytes, tokenization, grammar, schema validation, resource limits, or output construction. It cannot resume cleanly after partial input because no layer owns resumable state. It cannot produce useful diagnostics because source positions were thrown away too early.',
        'The cure is not abstraction for its own sake. It is separating kinds of meaning. Byte validity, lexical categories, grammar structure, semantic validation, output shape, and diagnostics are different jobs.',
      ],
    },
    {
      heading: 'The Layered Pipeline',
      paragraphs: [
        'The decoder validates the lowest representation. For text, that may mean UTF-8 byte sequences and Unicode scalar values. For binary formats, it may mean varints, fixed-width integers, endianness, lengths, checksums, or frame boundaries.',
        'The lexer groups the decoded stream into symbols the grammar can use: identifiers, numbers, strings, braces, delimiters, operators, field tags, or record separators. Some formats, such as CSV, can skip a separate lexer and use a small state machine directly, but the separation is still conceptually useful.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg',
          alt: 'Abstract syntax tree for a small Euclidean algorithm program',
          caption: 'An AST is one possible parser output: syntax made navigable for later analysis and transformation. Source: Wikimedia Commons.',
        },
        'The parser applies structure. It recognizes arrays inside objects, expressions inside parentheses, statements inside blocks, or fields inside records. The builder then emits the chosen output: events, row batches, DOM-like trees, AST nodes, typed structs, or validation errors with source spans.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A parser works when each layer has a smaller contract than the layer before it. The lexer turns messy bytes into tokens. The parser turns tokens into structure. The semantic layer checks names, types, limits, and domain rules. Keeping those contracts separate makes the system easier to prove, test, stream, and repair after errors.',
        'The correctness invariant is that the parser state explains every token consumed so far. A stack frame records the construct currently open, what token is legal next, and where the finished value should be attached. When a token violates that state, the parser can reject at the source span that made the input impossible instead of guessing later. That is why explicit parser state beats ad hoc string splitting for languages, data formats, and protocols that must fail safely.',
      ],
    },
    {
      heading: 'Choosing The Right State',
      paragraphs: [
        'The grammar determines the memory model. Bounded modes fit a finite-state machine. CSV quoted fields are a good example: outside field, inside unquoted field, inside quoted field, after quote. No unbounded nesting is needed.',
        'Nested languages need a stack. JSON arrays and objects can nest arbitrarily, so the parser must remember whether it is inside an array, object key, object value, or closing delimiter. XML, HTML, many binary container formats, and programming-language block structures have the same pressure.',
        'Expressions need precedence state. A Pratt parser uses a table of prefix and infix parselets plus binding powers to decide whether `a + b * c` groups as `a + (b * c)`. Recursive descent, operator-precedence parsing, shunting-yard, LR parsers, and parser combinators all encode different answers to the same state question.',
      ],
    },
    {
      heading: 'Choosing The Output',
      paragraphs: [
        'Output is a product decision, not a parser convenience. A CSV ingestion path may want row batches so it can stream into a worker or database loader. A JSON API gateway may want a typed value for schema validation. A compiler wants an AST with source spans because later passes analyze, transform, and report errors.',
        'Event streams minimize memory but push state to the consumer. Full trees are easy to navigate but expensive for huge inputs. Typed records are convenient but can hide malformed optional fields if construction and validation are mixed. ASTs preserve structure but require more node types and source metadata.',
        'The best parser can often support more than one output shape because recognition and building are separated. The recognizer says what the input means. The builder decides how much of that meaning to retain.',
      ],
    },
    {
      heading: 'Worked Case Study: Streaming CSV',
      paragraphs: [
        'A browser uploads a 2 GB CSV file. Loading the whole file into one string would freeze the page and blow memory. A streaming parser instead consumes chunks in a worker. The decoder validates UTF-8 and keeps partial multibyte sequences between chunks.',
        'The CSV state machine keeps the current row, current field, quote mode, row number, byte offset, and whether a delimiter or newline is legal at this point. It emits row batches, not one giant table. Backpressure from the consumer can pause reading without losing parser state.',
        'Diagnostics need the same discipline. A malformed quote should report the row, column, byte range, and expected transition. "Invalid CSV" is not enough for a user trying to fix a file with millions of rows.',
      ],
    },
    {
      heading: 'Worked Case Study: JSON Gateway',
      paragraphs: [
        'A JSON API gateway has a different state shape. It validates UTF-8, tokenizes strings, numbers, punctuation, booleans, and null, then uses an object/array stack to enforce nesting. It tracks byte count, depth, string length, key count, duplicate-key policy, and parse time.',
        'The output may be a typed value handed to schema validation. The parser should not silently repair missing commas, accept comments in strict JSON, or coerce duplicate fields unless the contract says so. Permissive parsing can be useful at an edge, but it must be a named mode because it changes the language accepted by the service.',
        'The same architecture appears as in CSV: decoder, tokenizer, structural state, output builder, limits, diagnostics. The state structure changes because JSON has unbounded nesting and typed values.',
      ],
    },
    {
      heading: 'Errors And Source Spans',
      paragraphs: [
        'Good diagnostics are designed, not sprinkled on later. The lexer or low-level reader must preserve enough location information for higher layers to explain failures. That can mean byte offset, line, column, token span, decoded character range, original slice, and include-file or source-map identity.',
        'The parser should report what it expected from its current state. "Expected colon after object key at line 12, column 8" is actionable. "Unexpected token" is often not. In editors, spans power underlines, code actions, incremental reparsing, rename safety, and formatting preservation.',
        'Spans cost memory. Full AST spans can dominate small inputs, and retaining original slices can keep large buffers alive. Production parsers choose how much location data to keep based on whether the output is for ingestion, diagnostics, compilation, or interactive editing.',
      ],
    },
    {
      heading: 'Resource Limits And Security',
      paragraphs: [
        'Parsers sit on untrusted input. A correct grammar is not enough if the implementation can be forced into huge allocation, deep recursion, catastrophic backtracking, endless error recovery, or quadratic string concatenation.',
        'Useful limits include total bytes, nesting depth, token length, string length, number of fields, number of errors reported, parse time, row batch size, recursion depth, and output tree size. Streaming parsers also need backpressure so a fast producer cannot overwhelm a slow consumer.',
        'Regular-expression based lexers need special care. Backtracking regex engines can turn a small hostile string into exponential work. DFA-style tokenizers, bounded regexes, and explicit state machines are often better for protocol boundaries.',
      ],
    },
    {
      heading: 'Incremental And Streaming Parsers',
      paragraphs: [
        'Streaming parsers preserve state across chunks. They are mandatory for large files, sockets, browser uploads, and pipeline ingestion. The parser must remember partial tokens, incomplete UTF-8 sequences, open containers, quote modes, row counters, and consumer backpressure.',
        'Incremental parsers preserve work across edits. Editors and IDEs do not want to reparse a whole project after one character changes. They keep syntax trees, invalidation ranges, source spans, and grammar state so only affected regions are rebuilt.',
        'Both designs punish hidden global state. If the parser cannot serialize or localize its state, it cannot pause, resume, recover, or reparse cheaply.',
      ],
    },
    {
      heading: 'Costs And Failure Modes',
      paragraphs: [
        'Parsing is often O(n), but the constant factors matter. Decoding, allocation, string unescaping, interning, source-span storage, tree construction, validation, schema lookup, and cross-thread transfer can dominate the state transition itself.',
        'Common failures include accepting more than the specification allows, rejecting valid edge cases, losing source positions, producing ambiguous output, repairing silently, recursing too deeply, copying slices repeatedly, and mixing syntax parsing with business validation.',
        'The most subtle failure is version drift. File formats and protocols evolve. A parser needs a named compatibility mode, feature flags, schema versioning, and tests for old inputs. Otherwise a "minor" grammar extension can break old clients or make security filters parse a different language from application code.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Layered parser design wins for compilers, API gateways, browser uploads, configuration files, protocol decoders, log ingestion, data import tools, security filters, and editor tooling. These domains need clear failure, bounded resource use, and outputs that downstream code can trust.',
        'It is especially valuable when multiple consumers need the same language: a validator, formatter, highlighter, compiler, linter, and migration tool can share recognition while building different outputs.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'The pattern fails when syntax is treated as the whole problem. Real ingestion also needs schema validation, type conversion, canonicalization, duplicate handling, normalization, security policy, version negotiation, and backpressure above the parser.',
        'It also fails when the layers are too rigid. A parser that refuses to expose source spans cannot support editor diagnostics. A tree builder that requires the whole input cannot support streaming. A permissive mode with no name or audit trail can become a security bug because different system components disagree about what the input means.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary references include RFC 3629 for UTF-8 at https://www.rfc-editor.org/rfc/rfc3629, RFC 4180 for CSV at https://www.rfc-editor.org/rfc/rfc4180, RFC 8259 for JSON at https://www.rfc-editor.org/rfc/rfc8259, Vaughan Pratt Top Down Operator Precedence at https://tdop.github.io/, and Russ Cox on regex engine implementation at https://swtch.com/~rsc/regexp/regexp1.html.',
        'Study UTF-8 Decoder DFA, CSV Parser State Machine, JSON Parser Stack, Pratt Parser Expression AST, Thompson NFA Regex Engine Case Study, Regex Backtracking Catastrophic Case Study, Protobuf Wire Format, Avro Binary Encoding Schema Resolution, HPACK Dynamic Table HTTP/2 Case Study, Tree-sitter Incremental Parsing, and Web Workers next.',
      ],
    },
  ],
};
