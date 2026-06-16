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
      heading: 'What it is',
      paragraphs: [
        'Parser design is the discipline of turning raw input into one explicit meaning. The shape repeats across formats: bytes are decoded, characters become tokens, tokens update parser state, parser state emits structured output, and every failure gets a location and an expected-next-token story.',
        'The primer ties together UTF-8, CSV, JSON, Pratt parsing, regex automata, Protobuf, Avro, and HPACK. Those formats differ, but the implementation questions are the same: what language is valid, what memory does the parser need, what output does the caller want, and what limits keep bad inputs from consuming the machine?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A byte decoder validates the lowest layer. A lexer converts character runs or byte patterns into tokens. A structural parser applies grammar rules. Some grammars fit in a finite state machine, some require a stack, and programming-language expressions often build trees. The output can be events, row batches, typed values, or AST nodes.',
        'Good parsers keep source spans. That metadata costs memory, but it changes failure from "parse error" into "expected colon after key at line 12, column 8." Spans also power editor refactors, diagnostics, source maps, and security logs.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A browser uploads a large CSV file. The byte decoder validates UTF-8. The CSV state machine keeps quoted-field state across chunks. It emits row batches to a worker pipeline. The worker reports malformed quote errors with byte offsets and row numbers. The main thread stays responsive because the parser preserves streaming state instead of loading everything into one giant string.',
        'A JSON API gateway has a different shape. It validates UTF-8, tokenizes JSON, keeps an object/array stack, enforces depth and byte limits, and emits a typed value for schema validation. The same parser architecture appears, but the state structure and output shape change.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parsing is often linear in input size, but linear work can still dominate latency. Allocation, string unescaping, source spans, tree construction, validation, and cross-thread transfer are usually more expensive than the state transition itself. Production parsers must budget memory, depth, field count, time, and error volume.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include RFC 3629 for UTF-8 at https://www.rfc-editor.org/rfc/rfc3629, RFC 4180 for CSV at https://www.rfc-editor.org/rfc/rfc4180, RFC 8259 for JSON at https://www.rfc-editor.org/rfc/rfc8259, Vaughan Pratt Top Down Operator Precedence at https://tdop.github.io/, and Russ Cox on regex engine implementation at https://swtch.com/~rsc/regexp/regexp1.html. Study UTF-8 Decoder DFA, CSV Parser State Machine, JSON Parser Stack, Pratt Parser Expression AST, Thompson NFA Regex Engine Case Study, Regex Backtracking & ReDoS Case Study, Protobuf Wire Format, Avro Binary Encoding, HPACK Dynamic Table HTTP/2 Case Study, and Web Workers next.',
      ],
    },
  ],
};
