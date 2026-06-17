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
      heading: 'Why this exists',
      paragraphs: [
        'A JSON parser turns a byte sequence into exactly one typed value: object, array, string, number, boolean, or null. That sounds small, but it is the boundary between text and data. HTTP APIs, configuration files, package metadata, logs, caches, browser storage, model tool calls, and message queues all use JSON because it carries nested structure in a format that many languages can read.',
        'At that boundary, string search is not enough. The program needs a trustworthy answer to three questions: did the text describe legal JSON, what value did it describe, and where did it stop being valid if it failed? A parser gives those answers by separating token recognition from structural validation.',
      ],
    },
    {
      heading: 'The tempting shortcut',
      paragraphs: [
        'The tempting shortcut is to scan for punctuation: count braces, split on commas, look for colons, and trim quotes. This works on the smallest examples and fails as soon as the input becomes realistic. A comma inside a string is not a separator. An escaped quote is not the end of a string. A colon is legal after an object key and meaningless in an array. A closing bracket is legal only when the most recent open container is an array.',
        'Regular expressions and simple split calls also fail because JSON is recursively nested. An object can contain an array, the array can contain objects, and those objects can contain more arrays. The parser must remember the chain of open containers. That memory is not a convenience; it is the data structure required by the grammar.',
      ],
    },
    {
      heading: 'Lexer versus parser',
      paragraphs: [
        'A clean parser has two jobs. The lexer reads characters and emits tokens: left brace, right brace, left bracket, right bracket, colon, comma, string, number, true, false, and null. It owns details such as whitespace, escape sequences, Unicode escapes, number syntax, and source spans.',
        'The parser consumes those tokens and decides whether their order is legal. The lexer can say that {"a" 1} contains a left brace, a string, a number, and a right brace. Only the parser can say that the number is illegal there because an object key must be followed by a colon before a value.',
        'Keeping the two jobs separate improves error messages and implementation quality. A bad string quote is a lexical error. A missing colon is a structural error. Extra data after a complete root value is a document-level parser error.',
      ],
    },
    {
      heading: 'The stack invariant',
      paragraphs: [
        'The core invariant is simple: the top stack frame describes the only container that may receive the next token. Opening { pushes an object frame. Opening [ pushes an array frame. A primitive token becomes the next value in the current frame. A closing delimiter must match the top frame and pop it.',
        'A frame is not just an opening delimiter. It also stores an expectation. An object frame may be waiting for a key, a colon, a value, a comma, or a closing brace. An array frame may be waiting for a value, a comma, or a closing bracket. The expectation is what turns punctuation into grammar.',
        'The root value has a related invariant: a JSON text contains one complete value. Once that value is done and the stack is empty, only whitespace may follow. A second object in {}{} is not part of the same JSON text unless a surrounding protocol says it is JSON Lines or some other stream format.',
      ],
    },
    {
      heading: 'Object frames',
      paragraphs: [
        'An object frame is a small state machine. At the beginning it can accept a string key or a closing brace for an empty object. After a key it must accept a colon. After the colon it must accept a value. After that value it can accept a comma for another member or a closing brace to finish the object.',
        'This is why common mistakes are caught exactly where they happen. In {"a" 1}, the frame has stored the key and is waiting for a colon. In {"a":}, the frame is waiting for a value. In {"a":1 "b":2}, the frame is waiting for a comma or close brace before the next key. Each error is the same kind of violation: the next token is not legal for the current frame state.',
        'A parser also needs a duplicate-key policy. The JSON grammar allows object member names to repeat, but applications often do not want silent overwrites. A parser can preserve all pairs, reject duplicates, or keep the last value. The important point is to choose deliberately and document the behavior.',
      ],
    },
    {
      heading: 'Array and root frames',
      paragraphs: [
        'An array frame is simpler than an object frame because it has no keys and no colons. At the beginning it can accept a value or a closing bracket for an empty array. After a value it can accept a comma or a closing bracket. After a comma it must accept another value.',
        'That state explains trailing comma rejection. In [1,], the comma moves the frame into the waiting-for-value state. A closing bracket is not legal there. Some languages permit trailing commas in their own literals, but JSON does not.',
        'The root frame is not usually stored as a normal stack frame, but the parser still needs equivalent state: no value yet, one value in progress, or root value complete. That state catches empty documents and extra root values.',
      ],
    },
    {
      heading: 'Building the output',
      paragraphs: [
        'A DOM-style parser builds a full in-memory value tree. When it sees an object or array, it creates a container. When a primitive arrives, it attaches the primitive to the current container. When a container closes, the completed value becomes available to its parent. This is convenient for application code because the result behaves like ordinary data.',
        'A streaming parser emits events instead: start object, key, value, end object, start array, and so on. The parser still uses the same stack, but the consumer decides what to store. Streaming is better for very large documents, log processing, and filtering because the program does not need to allocate the whole tree.',
        'The output strategy changes memory use, not grammar. Both forms must obey the same token expectations, depth limits, root-value rule, and error reporting discipline.',
      ],
    },
    {
      heading: 'Error reporting',
      paragraphs: [
        'Good JSON errors name the actual token, the expected token or token class, and the source position. "Unexpected token" is much less useful than "expected colon after object key at byte 6." The stack gives the parser enough context to report that kind of message.',
        'Error spans should come from the lexer. The lexer knows where a token began and ended, and it can report line and column information if it tracks newlines. The parser should preserve those spans so application logs can point to the exact failure.',
        'Do not recover casually inside a strict parser. JSON is commonly used for security boundaries and machine protocols. If the document is invalid, the safer default is to reject it clearly rather than guess what the sender meant.',
      ],
    },
    {
      heading: 'Cost and limits',
      paragraphs: [
        'The parsing pass is O(n) in the input length. A streaming parser needs O(depth) stack memory plus whatever the consumer stores. A DOM-style parser needs O(document size) memory because it materializes the full value tree.',
        'Production parsers also need defensive limits: maximum bytes, maximum nesting depth, maximum string length, number range policy, Unicode validation, and timeout or cancellation behavior in hostile environments. A tiny document with thousands of nested arrays can break a recursive parser even though the byte count is small.',
        'In JavaScript, the built-in JSON.parse is fast and strict for ordinary use. A custom parser is useful when you need streaming events, custom diagnostics, duplicate-key rejection, incremental parsing, educational tracing, or integration with a constrained decoder. It is not usually worth replacing the native parser for normal application payloads.',
      ],
    },
    {
      heading: 'Worked cases',
      paragraphs: [
        'For {"a":[1,true]}, the parser pushes an object frame at {, reads key "a", consumes :, pushes an array frame at [, appends 1, consumes a comma, appends true, pops the array at ], attaches that array as the value for key a, and pops the object at }. The stack is empty, so the root value is complete.',
        'For {"a" 1}, tokenization succeeds. The parser fails when the number appears because the object frame expected a colon after the key. For [1,], the parser fails at the closing bracket because the array frame expected another value after the comma.',
        'For {}{}, the first object is a valid complete root. The second { is illegal in plain JSON because the root is already done. A streaming container format must define its own framing if it wants multiple JSON values in one byte stream.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'The same stack idea appears beyond JSON. XML, HTML, programming-language blocks, markdown containers, expression parentheses, template syntax, and protocol envelopes all need a memory of open structure. Once a format has recursive nesting, a stack is usually close by.',
        'In AI systems, JSON parsing also sits behind tool calling and structured output. A model may produce text that looks like JSON, but the runtime still needs a strict parser before it executes a tool. The parser proves shape, not truth; schema validation and authorization checks come next.',
      ],
    },
    {
      heading: 'Common failure modes',
      paragraphs: [
        'The first failure is confusing JSON with JavaScript object literal syntax. JSON has double-quoted strings, no comments, no trailing commas, no undefined, and one root value. The second failure is treating syntactic validity as business validity. {"amount":-1} can be valid JSON and still invalid for a payment API.',
        'The third failure is ignoring resource limits. Attackers can send deep nesting, huge strings, absurd numbers, or duplicate keys that different components interpret differently. A parser should reject invalid structure, then a validator should enforce the application contract.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RFC 8259, The JavaScript Object Notation Data Interchange Format, at https://www.rfc-editor.org/rfc/rfc8259. Study Stack, Finite State Machines, CSV Parser State Machine, UTF-8 Decoder DFA, Pratt Parser Expression AST, Parser Design Patterns Primer, JSON-RPC Protocol Case Study, JSON Schema Constrained Decoding Token Mask, Constrained Decoding, and Schema Registry Case Study next.',
      ],
    },
  ],
};
