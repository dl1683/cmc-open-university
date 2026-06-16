// JSON parsing: a tokenizer plus a nesting stack for objects, arrays, keys,
// values, separators, and structural errors.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'json-parser-stack-case-study',
  title: 'JSON Parser Stack Case Study',
  category: 'Concepts',
  summary: 'JSON parsing combines a lexical scanner with a stack: objects and arrays push frames, commas and colons check expected positions, and closing delimiters pop.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token stack', 'structure errors'], defaultValue: 'token stack' },
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

function jsonGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'bytes', label: 'text', x: 0.7, y: 4.0, note: notes.bytes ?? 'UTF-8' },
      { id: 'lexer', label: 'lexer', x: 2.5, y: 4.0, note: notes.lexer ?? 'tokens' },
      { id: 'parser', label: 'parser', x: 4.3, y: 4.0, note: notes.parser ?? 'expect' },
      { id: 'stack', label: 'stack', x: 6.2, y: 2.5, note: notes.stack ?? 'frames' },
      { id: 'value', label: 'value', x: 6.2, y: 5.6, note: notes.value ?? 'node' },
      { id: 'emit', label: 'emit', x: 8.2, y: 4.0, note: notes.emit ?? 'JSON' },
      { id: 'error', label: 'error', x: 8.2, y: 6.6, note: notes.error ?? 'span' },
    ],
    edges: [
      { id: 'e-bytes-lexer', from: 'bytes', to: 'lexer', weight: '' },
      { id: 'e-lexer-parser', from: 'lexer', to: 'parser', weight: '' },
      { id: 'e-parser-stack', from: 'parser', to: 'stack', weight: '' },
      { id: 'e-parser-value', from: 'parser', to: 'value', weight: '' },
      { id: 'e-stack-emit', from: 'stack', to: 'emit', weight: '' },
      { id: 'e-value-emit', from: 'value', to: 'emit', weight: '' },
      { id: 'e-parser-error', from: 'parser', to: 'error', weight: '' },
    ],
  }, { title });
}

function* tokenStack() {
  yield {
    state: jsonGraph('JSON needs a lexer and a nesting stack'),
    highlight: { active: ['bytes', 'lexer', 'parser', 'stack'], found: ['emit'] },
    explanation: 'JSON has simple tokens, but nesting is unbounded. A lexer can recognize strings, numbers, literals, and punctuation; the parser needs a stack to remember which objects and arrays are currently open.',
    invariant: 'Balanced nesting is not finite-state; the parser needs stack memory.',
  };

  yield {
    state: labelMatrix(
      'Tokenizing {\"a\":[1,true]}',
      [
        { id: 't0', label: '{' },
        { id: 't1', label: '\"a\"' },
        { id: 't2', label: ':' },
        { id: 't3', label: '[' },
        { id: 't4', label: '1' },
        { id: 't5', label: 'true' },
        { id: 't6', label: ']' },
        { id: 't7', label: '}' },
      ],
      [
        { id: 'kind', label: 'token kind' },
        { id: 'parser', label: 'parser action' },
      ],
      [
        ['begin object', 'push object'],
        ['string', 'read key'],
        ['colon', 'expect value'],
        ['begin array', 'push array'],
        ['number', 'append value'],
        ['literal', 'append value'],
        ['end array', 'pop array'],
        ['end object', 'pop object'],
      ],
    ),
    highlight: { active: ['t0:parser', 't3:parser', 't6:parser', 't7:parser'], found: ['t5:kind'] },
    explanation: 'The structural tokens manipulate the stack. Primitive tokens become values in the current container. The parser always knows what token kind is legal next from the top frame.',
  };

  yield {
    state: jsonGraph('Object frames expect key, colon, value, or comma', { stack: 'object', parser: 'key?', value: 'member' }),
    highlight: { active: ['parser', 'stack', 'value', 'e-parser-stack'], found: ['emit'] },
    explanation: 'An object frame is not just an open brace. It carries an expectation: maybe a key, maybe a colon after a key, maybe a value, maybe a comma or close brace after a member.',
  };

  yield {
    state: labelMatrix(
      'Parser frame expectations',
      [
        { id: 'objkey', label: 'object: key' },
        { id: 'objcolon', label: 'object: colon' },
        { id: 'objvalue', label: 'object: value' },
        { id: 'arrayval', label: 'array: value' },
        { id: 'after', label: 'after value' },
      ],
      [
        { id: 'valid', label: 'valid next' },
        { id: 'invalid', label: 'invalid next' },
      ],
      [
        ['string or }', 'number'],
        [':', ','],
        ['any value', '}'],
        ['value or ]', ':'],
        [', or close', 'another value'],
      ],
    ),
    highlight: { active: ['objkey:valid', 'arrayval:valid'], compare: ['after:invalid'] },
    explanation: 'The stack stores a frame type plus an expectation. That expectation is what catches a missing colon, trailing comma, or unexpected value at the exact token.',
  };

  yield {
    state: jsonGraph('When the stack empties, one complete JSON value is done', { stack: 'empty', value: 'root', emit: 'done' }),
    highlight: { active: ['stack', 'value', 'emit', 'e-value-emit'], found: ['parser'] },
    explanation: 'A JSON text is one complete value. After the root value is finished, only whitespace may follow. Extra tokens are an error, not a second hidden document.',
  };
}

function* structureErrors() {
  yield {
    state: jsonGraph('A missing colon is a parser-state error', { bytes: '{\"a\" 1}', parser: 'wanted :', error: 'at 1' }),
    highlight: { active: ['lexer', 'parser', 'error', 'e-parser-error'], removed: ['emit'] },
    explanation: 'After an object key, the object frame expects a colon. Seeing a number next is not a lexical problem; it is a structural parser error.',
    invariant: 'Good parser errors name the expected token and the source position.',
  };

  yield {
    state: labelMatrix(
      'Common JSON structure errors',
      [
        { id: 'colon', label: '{\"a\" 1}' },
        { id: 'trail', label: '[1,]' },
        { id: 'single', label: "{'a':1}" },
        { id: 'extra', label: '{}{}' },
        { id: 'unclosed', label: '[1,2' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'frame', label: 'where caught' },
      ],
      [
        ['missing colon', 'object frame'],
        ['trailing comma', 'array frame'],
        ['bad string quotes', 'lexer'],
        ['extra root value', 'root done'],
        ['unclosed array', 'EOF with stack'],
      ],
    ),
    highlight: { active: ['colon:frame', 'trail:frame'], removed: ['single:problem'] },
    explanation: 'JSON is deliberately stricter than JavaScript object literal syntax. Single quotes, comments, trailing commas, and multiple root values are not valid JSON.',
  };

  yield {
    state: jsonGraph('Deep nesting is a stack and resource concern', { bytes: '[[[[', stack: 'grows', parser: 'depth cap', error: 'too deep' }),
    highlight: { active: ['bytes', 'parser', 'stack'], compare: ['error'] },
    explanation: 'A correct parser should enforce depth and size limits. Otherwise a tiny input can create a huge recursive call stack, large allocation pressure, or expensive error handling.',
  };

  yield {
    state: labelMatrix(
      'Parser implementation choices',
      [
        { id: 'recursive', label: 'recursive descent' },
        { id: 'iter', label: 'explicit stack' },
        { id: 'dom', label: 'DOM tree' },
        { id: 'sax', label: 'event stream' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple code', 'call-stack depth'],
        ['depth cap easy', 'more bookkeeping'],
        ['easy random access', 'memory heavy'],
        ['low memory', 'stateful consumer'],
      ],
    ),
    highlight: { active: ['iter:strength', 'sax:strength'], compare: ['dom:risk'] },
    explanation: 'JSON parsing is not only about accepting syntax. The output shape matters: a full object tree is convenient, while an event stream is better for huge documents.',
  };

  yield {
    state: jsonGraph('The parser hands structured values to application code', { lexer: 'valid', parser: 'stack ok', value: 'tree/event', emit: 'app' }),
    highlight: { found: ['emit'], active: ['lexer', 'parser', 'stack', 'value'], removed: ['error'] },
    explanation: 'Once JSON is parsed, application logic should work with typed values instead of string search. The parser is the boundary that turns bytes into structure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token stack') yield* tokenStack();
  else if (view === 'structure errors') yield* structureErrors();
  else throw new InputError('Pick a JSON parser view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A JSON parser turns text into structured values: objects, arrays, strings, numbers, booleans, and null. The scanner recognizes tokens. The parser validates nesting, separators, object keys, colons, commas, and root-value completion. A finite-state scanner is enough for token shapes, but nested arrays and objects require a stack.',
        'The distinction is important because many bugs come from treating JSON as string matching. A JSON text is one value with strict grammar rules, not arbitrary JavaScript syntax and not a sequence of independent objects unless a separate framing format says so.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The lexer reads UTF-8 text and emits tokens: braces, brackets, colon, comma, strings, numbers, true, false, and null. The parser keeps a stack of object and array frames. Each frame stores what it expects next: a key, colon, value, comma, or closing delimiter. Opening braces and brackets push frames; closing delimiters pop them.',
        'A JSON object member must be string, colon, value. An array item is a value separated by commas. After the root value is complete, only whitespace may follow. These rules let a parser catch errors at the point they become impossible to repair.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For {\"a\":[1,true]}, the parser pushes an object frame, reads key \"a\", consumes colon, pushes an array frame, appends number 1, appends true after a comma, pops the array at ], attaches it as the value for key a, and pops the object at }. The stack is then empty and the root value is complete.',
        'For {\"a\" 1}, the lexer can recognize every token, but the parser rejects the number because the object frame expected a colon after the key. That is a structural error, not a tokenization error.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parsing is O(n) over the input. Memory is O(depth) for a streaming event parser plus output buffering chosen by the caller, or O(document size) for a full in-memory tree. Practical parsers also need number-range policy, string escape handling, duplicate-key policy, depth limits, byte limits, and source spans for useful diagnostics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8259, The JavaScript Object Notation Data Interchange Format, at https://www.rfc-editor.org/rfc/rfc8259. Study UTF-8 Decoder DFA, CSV Parser State Machine, Parser Design Patterns Primer, Finite State Machines, Stack, Pratt Parser Expression AST, JSON-RPC Protocol Case Study, Constrained Decoding, JSON Schema Constrained Decoding Token Mask, and Schema Registry Case Study next.',
      ],
    },
  ],
};
