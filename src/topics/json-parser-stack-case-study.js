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
    { heading: 'How to read the animation', paragraphs: [
      'Read the token-stack view from bytes to lexer to parser to stack. Active cells show the token being checked, and found cells show structure that is now valid. The top stack frame is the current promise about what token may appear next.',
      {type:'callout', text:'JSON parsing is simple only at the token layer; correctness comes from stack frames that remember the active container and the next legal token.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'JSON is a serialization format: it turns one structured value into text and back again. APIs, config files, message queues, browser storage, and tool calls all use it because the grammar is small. A parser is the boundary that turns untrusted text into typed values.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to split text on commas and colons, then trim quotes. That works for a tiny flat object. It fails when a comma appears inside a string or when an object contains another object.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is unbounded nesting. A parser may be inside an object, then an array, then another object, with no fixed limit from the grammar. A counter tracks depth, but it does not remember whether the next closing token should be a bracket or a brace.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Use a stack of frames. A stack is last-in, first-out, so the most recently opened container is the first one that must close. Each frame stores both the container type and the next legal token class.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The lexer turns characters into tokens such as begin object, string, colon, number, comma, and end array. The parser reads each token and checks it against the top stack frame. Opening tokens push frames, closing tokens pop matching frames, and values advance the current expectation.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness follows from two invariants. The stack-type invariant says the top frame is always the innermost open container. The expectation invariant says the top frame lists the token kinds that can legally appear next. Every accepted token preserves both invariants, and the input is valid only when the root value is complete and the stack is empty.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Parsing is O(n) because each character is scanned once and each token is processed once. Stack memory is O(d), where d is maximum nesting depth. A 20000-character input can still contain 10000 nested brackets, so a production parser needs a depth cap.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'HTTP clients parse response bodies before business logic reads fields. Config loaders parse package and service settings before startup. Structured-output decoders for language models use the same parser state to mask tokens that would break JSON grammar.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'A JSON parser proves syntax, not meaning. A profile with age -5 can be valid JSON and invalid application data. A large integer can parse successfully and still lose precision in JavaScript Number. Duplicate keys are also a policy problem, not a grammar problem.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Trace a root object whose key a maps to an array containing 1 and true. Begin object pushes an object frame, key a makes it wait for colon, colon makes it wait for value, and begin array pushes an array frame. Number 1 and true advance the array frame, end array pops it, and end object leaves the stack empty.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: RFC 8259 at https://www.rfc-editor.org/rfc/rfc8259, ECMA-404 at https://www.ecma-international.org/publications-and-standards/standards/ecma-404/, MDN JSON.parse at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse, and Douglas Crockford json2.js at https://github.com/douglascrockford/JSON-js. Study Stack, Finite-State Machine, Trie, Recursive Descent Parser, JSON Schema, JSON-RPC Protocol, and Structured Output Token Masks next.',
    ] },
  ],
};
