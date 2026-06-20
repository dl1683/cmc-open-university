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
      heading: 'How to read the animation',
      paragraphs: [
        'The "token stack" view traces a lexer-plus-stack parser through a small JSON document. Active nodes are the pipeline stage currently processing a token. Found nodes mark a complete, valid result. The graph edges show data flow: bytes enter the lexer, tokens enter the parser, the parser pushes and pops stack frames, and completed values reach the emit node.',
        'The "structure errors" view shows what happens when a token violates the current frame expectation. Removed nodes mark the output path that error cases never reach. Watch the error node light up -- it means the stack detected a structural violation that pure tokenization would miss.',
        {
          type: 'note',
          text: 'The matrix views show token-by-token traces. Each row is one token; the columns show what kind of token the lexer produced and what action the parser took. Highlighted cells in the "parser action" column are the stack operations -- push, pop, or an expectation check.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JSON is the wire format for most of the internet. Every HTTP API response, every npm package.json, every VS Code settings file, every browser localStorage blob, every LLM tool-call payload, and every Kubernetes manifest is JSON. RFC 8259 defines the grammar in under four pages, yet a correct parser needs machinery that the simplicity of the format hides.',
        'The parser is the boundary between untrusted bytes and typed program values. On one side: a flat character stream that might contain anything. On the other side: a structured object, array, string, number, boolean, or null that application code can use safely. The parser must answer three questions for every input: is it valid JSON, what value does it represent, and if it fails, where exactly does it fail?',
        {
          type: 'quote',
          text: 'A JSON text is a serialized value. Note that certain previous specifications of JSON constrained a JSON text to be an object or an array. Implementations that generate only objects or arrays where a JSON text is called for will be interoperable in the sense that all implementations will accept these as conforming JSON texts.',
          attribution: 'RFC 8259, Section 2 (2017)',
        },
        'The word "serialized" is the key. JSON is not a programming language or a database query. It is a serialization format: one value in, one value out. The parser must enforce that contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is string manipulation. Count braces to find object boundaries. Split on commas to get members. Look for colons to separate keys from values. Trim quotes to extract strings. This works on {"name":"Alice"} and breaks almost immediately on real data.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Naive approach: split on commas, split on colons\nconst bad = \'{"msg":"hello, world","n":3}\';\nbad.split(",");\n// => [\'{"msg":"hello\', \' world"\', \'"n":3}\']\n// The comma inside the string tore the value apart.',
        },
        'The comma inside "hello, world" is not a separator -- it is part of a string value. No amount of splitting can distinguish structural commas from string content without tracking whether the parser is inside a string. Escaped quotes (\\") make it worse: a backslash before a quote means the string continues, but a double backslash (\\\\) followed by a quote means the string ends and the quote is structural.',
        'Regular expressions cannot solve this either. JSON is a context-free language, not a regular language. The grammar allows objects inside arrays inside objects to arbitrary depth. A regular expression has no memory of how many containers are open, so it cannot match a closing bracket to the correct opening bracket.',
        {
          type: 'note',
          text: 'The pumping lemma for regular languages proves this formally: no finite automaton can track unbounded nesting. The language {^n }^n (n open braces followed by n close braces) is the textbook counterexample. JSON nesting is exactly this problem.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is nesting. Consider this 58-byte input:',
        {
          type: 'code',
          language: 'json',
          text: '{"a":{"b":[1,{"c":true},[null,{"d":"e"}]]},"f":2}',
        },
        'At the point where the parser reads "e", it is inside: the root object, the value of key "a" (an object), the value of key "b" (an array), the second element of that array (another array), the second element of that inner array (an object), and the value of key "d" (a string). That is six levels of nesting. The parser must remember all six, in order, because each closing delimiter must match the most recent opening delimiter.',
        'A brace counter is not enough. It tracks depth but not type. If the count says depth 3, the parser still does not know whether the next closing delimiter should be ] or }. A [ closed by } is invalid JSON, but a brace counter that does not track types would accept it. The parser needs a stack that records both depth and the type of each open container.',
        {
          type: 'table',
          headers: ['Approach', 'Handles strings?', 'Handles nesting?', 'Handles type matching?', 'Handles expectations?'],
          rows: [
            ['split on commas', 'No', 'No', 'No', 'No'],
            ['regex', 'Partially', 'No', 'No', 'No'],
            ['brace counter', 'No', 'Depth only', 'No', 'No'],
            ['typed stack', 'With lexer', 'Yes', 'Yes', 'Yes'],
          ],
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The top of the stack is a contract. It says exactly what token may legally appear next, what type of container is open, and what the parser should do when the token arrives. Every token either satisfies the contract and advances it, or violates the contract and produces a precise error.',
        'A stack frame is not just "object" or "array." It is a small state machine carrying an expectation: object-waiting-for-key, object-waiting-for-colon, object-waiting-for-value, object-waiting-for-comma-or-close, array-waiting-for-value, array-waiting-for-comma-or-close. The expectation is what makes punctuation grammatical rather than arbitrary.',
        {
          type: 'diagram',
          label: 'Object frame state machine',
          text: [
            '  Object frame transitions:',
            '',
            '    +---> WANT_KEY ---string---> WANT_COLON ---:---> WANT_VALUE',
            '    |                    |                                |',
            '    |                    } (empty)                   any value',
            '    |                    |                                |',
            '    |                    v                                v',
            '    |                  POP                      WANT_COMMA_OR_CLOSE',
            '    |                                               /          \\',
            '    +-------------------,------ COMMA -----<-------+            }',
            '                                                                |',
            '                                                               POP',
          ].join('\n'),
        },
        'This state machine has five states but only one is active at any moment. The parser never searches, never backtracks, and never guesses. It reads the next token, checks it against the current expectation, advances the state, and moves on. One token, one comparison, one transition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The parser has two cooperating modules: a lexer and a stack driver. The lexer consumes characters and emits typed tokens. The stack driver consumes tokens and either advances the parse or rejects the input.',
        {
          type: 'table',
          headers: ['Lexer token', 'Token kind', 'Stack driver action'],
          rows: [
            ['{', 'begin-object', 'Push object frame (state: WANT_KEY)'],
            ['}', 'end-object', 'Check top is object frame, pop it'],
            ['[', 'begin-array', 'Push array frame (state: WANT_VALUE)'],
            [']', 'end-array', 'Check top is array frame, pop it'],
            [':', 'colon', 'Check object frame is in WANT_COLON, advance to WANT_VALUE'],
            [',', 'comma', 'Check frame is in WANT_COMMA_OR_CLOSE, advance to WANT_KEY or WANT_VALUE'],
            ['"..."', 'string', 'Use as key or value depending on frame state'],
            ['42, -3.14, 1e10', 'number', 'Deliver as value to current frame'],
            ['true, false, null', 'literal', 'Deliver as value to current frame'],
          ],
        },
        'The lexer handles character-level concerns: skipping whitespace (space, tab, newline, carriage return -- and only those four), recognizing the exact syntax of strings (double-quoted, with specific escape sequences: \\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t, \\uXXXX), validating number syntax (optional minus, integer part with no leading zeros except bare 0, optional fraction, optional exponent), and matching the three literals character by character.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Lexer core: classify the next token from the current character',
            'function nextToken(src, pos) {',
            '  while (pos < src.length && " \\t\\n\\r".includes(src[pos])) pos++;',
            '  if (pos >= src.length) return { kind: "eof", pos };',
            '  const ch = src[pos];',
            '  if (ch === "{") return { kind: "begin-object", pos: pos + 1 };',
            '  if (ch === "}") return { kind: "end-object", pos: pos + 1 };',
            '  if (ch === "[") return { kind: "begin-array", pos: pos + 1 };',
            '  if (ch === "]") return { kind: "end-array", pos: pos + 1 };',
            '  if (ch === ":") return { kind: "colon", pos: pos + 1 };',
            '  if (ch === ",") return { kind: "comma", pos: pos + 1 };',
            '  if (ch === \'"\') return readString(src, pos);',
            '  if (ch === "-" || (ch >= "0" && ch <= "9")) return readNumber(src, pos);',
            '  if (src.startsWith("true", pos)) return { kind: "literal", value: true, pos: pos + 4 };',
            '  if (src.startsWith("false", pos)) return { kind: "literal", value: false, pos: pos + 5 };',
            '  if (src.startsWith("null", pos)) return { kind: "literal", value: null, pos: pos + 4 };',
            '  throw new SyntaxError(`Unexpected character ${ch} at position ${pos}`);',
            '}',
          ].join('\n'),
        },
        'The stack driver maintains an array of frames. Each frame records the container type (object or array) and the current expectation state. When a token arrives, the driver checks it against the top frame. If the token matches the expectation, the driver updates the frame state and possibly pushes or pops. If the token does not match, the driver reports the expected token kinds and the actual token, along with the byte position from the lexer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two invariants maintained across every token.',
        {
          type: 'bullets',
          items: [
            'Stack-type invariant: the top frame is always the innermost open container. Every push adds a new container. Every pop removes exactly the matching container. A ] can only pop an array frame; a } can only pop an object frame. Mismatches are rejected before the pop.',
            'Expectation invariant: the frame state tracks what token kinds are legal next. After a key in an object, only a colon is legal. After a comma in an array, only a value is legal. The parser never needs to look ahead, search backward, or guess.',
          ],
        },
        'Together these invariants guarantee: (1) every accepted input has balanced, correctly typed nesting; (2) every rejected input fails at the exact token that violated the grammar; and (3) the parser processes each token in O(1) time because the decision depends only on the top frame.',
        'The proof is by induction on token count. Before the first token, the stack is empty and the parser expects a value. After each token, the stack and expectations are consistent with the grammar prefix consumed so far. After the last token, the stack must be empty (all containers closed) and the root value must be complete.',
        {
          type: 'note',
          text: 'This is a shift-reduce parser specialized for a single grammar. "Shift" reads the next token. "Reduce" completes a container when its closing delimiter arrives. JSON is simple enough that the parser never needs a lookahead buffer, a parse table, or ambiguity resolution. One token of input determines the action uniquely.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the input {"a":[1,true]} token by token. The stack column shows frames from bottom to top.',
        {
          type: 'table',
          headers: ['Step', 'Token', 'Kind', 'Stack (bottom-to-top)', 'Expectation after'],
          rows: [
            ['1', '{', 'begin-object', 'OBJ', 'key or }'],
            ['2', '"a"', 'string', 'OBJ', 'colon'],
            ['3', ':', 'colon', 'OBJ', 'value'],
            ['4', '[', 'begin-array', 'OBJ > ARR', 'value or ]'],
            ['5', '1', 'number', 'OBJ > ARR', 'comma or ]'],
            ['6', ',', 'comma', 'OBJ > ARR', 'value'],
            ['7', 'true', 'literal', 'OBJ > ARR', 'comma or ]'],
            ['8', ']', 'end-array', 'OBJ', 'comma or }'],
            ['9', '}', 'end-object', '(empty)', 'EOF only'],
          ],
        },
        'At step 4, the array bracket pushes a new frame on top of the object frame. The object frame pauses -- it was waiting for a value, and the array is that value. At step 8, the array bracket pops the array frame, and the completed array becomes the value for key "a" in the object frame below. At step 9, the object bracket pops the object frame, and the stack is empty. Any further non-whitespace token would be an error.',
        'Now trace a failing input: {"a" 1}.',
        {
          type: 'table',
          headers: ['Step', 'Token', 'Kind', 'Stack', 'Result'],
          rows: [
            ['1', '{', 'begin-object', 'OBJ', 'OK, expect key or }'],
            ['2', '"a"', 'string', 'OBJ', 'OK, key stored, expect colon'],
            ['3', '1', 'number', 'OBJ', 'ERROR: expected colon, got number at byte 5'],
          ],
        },
        'The lexer has no problem -- { and "a" and 1 and } are all valid tokens. The error is structural: the object frame is in the WANT_COLON state, and a number is not a colon. The error message can name the exact position, the expected token kind, and the actual token kind because the frame state carries that information.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Parsing is O(n) in input length. Each character is examined at most once by the lexer. Each token is examined once by the stack driver. The stack grows to the maximum nesting depth d, so memory for the stack alone is O(d).',
        {
          type: 'table',
          headers: ['Resource', 'DOM parser', 'Streaming parser', 'Notes'],
          rows: [
            ['Time', 'O(n)', 'O(n)', 'One pass, no backtracking'],
            ['Stack memory', 'O(d)', 'O(d)', 'd = max nesting depth'],
            ['Output memory', 'O(n)', 'O(1) amortized', 'DOM stores full tree; streaming emits events'],
            ['Strings', 'Copy on extract', 'Copy on extract', 'Escape processing requires a new buffer'],
            ['Numbers', 'Parse to float', 'Parse to float', 'IEEE 754 double: 53-bit integer precision'],
          ],
        },
        'The constant factors matter in practice. V8 JSON.parse is implemented in C++ and uses SIMD to skip whitespace and scan strings. A hand-written JavaScript parser is typically 3-10x slower for bulk parsing. The custom parser wins when the application needs streaming, partial parsing, custom error recovery, or integration with constrained decoding (forcing LLM output to match a JSON schema token by token).',
        {
          type: 'note',
          text: 'Depth limits are not optional. The input [[[[[[...]]]]]] with 10,000 nesting levels is only 20,000 bytes but creates 10,000 stack frames. A recursive descent parser would overflow the call stack. An explicit stack parser survives but should still reject pathological depth. Chrome V8 caps JSON.parse nesting at 200,000 frames; Python json.loads defaults to 100.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'HTTP API boundaries: every REST response is parsed by the client. The parser is the trust boundary between the server and application logic. Invalid JSON must be rejected before any field is read.',
            'Configuration files: package.json, tsconfig.json, .eslintrc.json, VS Code settings. These are parsed once at startup, so DOM parsing is appropriate. Error quality matters because humans edit these files by hand.',
            'Log pipelines: structured logging emits one JSON object per line (JSON Lines / NDJSON). A streaming parser processes each line independently, keeping memory proportional to one object, not the full log.',
            'LLM tool calls: when a language model emits a function_call argument as JSON, the runtime parses it before executing the tool. A partial or malformed response must produce a clear parse error, not a silent misinterpretation. Constrained decoding uses the parser stack mid-parse to restrict which tokens the model may emit next.',
            'Browser storage: localStorage.getItem returns a string. JSON.parse converts it to structured data. The parse can fail if the stored string was corrupted, truncated by a quota limit, or written by an older version of the application with a different schema.',
            'Message queues: Kafka, RabbitMQ, and SQS messages are often JSON. The consumer parses each message independently. A poison message (invalid JSON) must be caught and dead-lettered, not silently dropped or half-processed.',
          ],
        },
        'The stack pattern itself generalizes beyond JSON. XML and HTML parsers use tag stacks. Programming language parsers use scope stacks. Template engines use block stacks. Parenthesized expression parsers use operator stacks. Any format with recursive nesting needs a memory of open containers, and a stack is the minimal data structure that provides it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The parser proves syntax, not semantics. {"age": -5} is valid JSON and nonsense for a user profile. {"amount": 99999999999999999} is valid JSON but loses precision when parsed to a JavaScript number (IEEE 754 doubles have 53 bits of integer precision; this value rounds). The parser cannot catch these problems because they depend on the application domain, not the grammar.',
        {
          type: 'table',
          headers: ['Trap', 'Example', 'Why the parser misses it'],
          rows: [
            ['Precision loss', '{"id": 9007199254740993}', 'Parses to 9007199254740992 (lost last digit) -- valid JSON, wrong value'],
            ['Duplicate keys', '{"a":1, "a":2}', 'RFC 8259 says names SHOULD be unique but does not forbid duplicates'],
            ['Billion laughs', '{"a":"x"} repeated 10M times in array', 'Valid JSON, but allocates gigabytes of DOM nodes'],
            ['Type confusion', '{"enabled": "true"}', 'String "true" is not boolean true -- the parser accepts both'],
            ['Encoding mismatch', 'UTF-16 BOM + ASCII body', 'RFC 8259 requires UTF-8 for closed ecosystems; many parsers accept others'],
          ],
        },
        {
          type: 'note',
          text: 'The duplicate-key problem is a real security issue. If a proxy parses {"admin":false,"admin":true} and keeps the first value, but the backend keeps the last, the proxy thinks the request is unprivileged while the backend grants admin access. RFC 8259 warns about this but leaves the behavior implementation-defined.',
        },
        'JSON also lacks features that real applications need: comments (developers want them in config files), trailing commas (every merge conflict in a package.json dependency list), dates (no native date type -- ISO 8601 strings are a convention, not a grammar rule), binary data (must be Base64-encoded into a string), and streaming framing (JSON Lines and NDJSON are conventions layered on top, not part of RFC 8259). These gaps are not parser bugs -- they are deliberate design constraints that keep the grammar simple enough to parse in one pass with one stack.',
      ],
    },
    {
      heading: 'The lexer in detail',
      paragraphs: [
        'The lexer deserves separate attention because string and number scanning hide the most subtle bugs.',
        'JSON strings must be double-quoted. The lexer scans forward from the opening quote, copying characters to an output buffer. Most characters pass through directly. A backslash starts an escape sequence: the next character must be one of " \\ / b f n r t or u. The \\u escape requires exactly four hexadecimal digits and produces a Unicode code point. Surrogate pairs (\\uD800-\\uDBFF followed by \\uDC00-\\uDFFF) encode characters above U+FFFF.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// String scanning with escape handling',
            'function readString(src, pos) {',
            '  pos++; // skip opening quote',
            '  let value = "";',
            '  while (pos < src.length) {',
            '    const ch = src[pos];',
            '    if (ch === \'"\') return { kind: "string", value, pos: pos + 1 };',
            '    if (ch === "\\\\") {',
            '      pos++;',
            '      const esc = src[pos];',
            '      if (esc === \'"\') value += \'"\';',
            '      else if (esc === "\\\\") value += "\\\\";',
            '      else if (esc === "/") value += "/";',
            '      else if (esc === "b") value += "\\b";',
            '      else if (esc === "f") value += "\\f";',
            '      else if (esc === "n") value += "\\n";',
            '      else if (esc === "r") value += "\\r";',
            '      else if (esc === "t") value += "\\t";',
            '      else if (esc === "u") {',
            '        const hex = src.slice(pos + 1, pos + 5);',
            '        value += String.fromCharCode(parseInt(hex, 16));',
            '        pos += 4;',
            '      } else throw new SyntaxError(`Bad escape \\\\${esc} at ${pos}`);',
            '    } else if (ch.charCodeAt(0) < 0x20) {',
            '      throw new SyntaxError(`Control character at ${pos}`);',
            '    } else { value += ch; }',
            '    pos++;',
            '  }',
            '  throw new SyntaxError("Unterminated string");',
            '}',
          ].join('\n'),
        },
        'JSON numbers follow a strict grammar: optional minus, then either a lone zero or a nonzero digit followed by more digits, then an optional decimal point with one or more digits, then an optional exponent (e or E, optional sign, one or more digits). Leading zeros like 007 are invalid. Bare decimal points like .5 are invalid. Plus signs like +3 are invalid. These restrictions are tighter than JavaScript number literals.',
        {
          type: 'diagram',
          label: 'JSON number grammar railroad',
          text: [
            '  JSON number grammar:',
            '',
            '  [-] --> (0 | [1-9][0-9]*) --> [. [0-9]+] --> [(e|E) [+|-] [0-9]+]',
            '',
            '  Valid:   0, -0, 1, -1, 3.14, -0.5, 1e10, 2.5E-3, 1E+0',
            '  Invalid: +1, .5, 007, 1., 1e, Infinity, NaN, 0x1F',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Implementation choices',
      paragraphs: [
        'There are two main approaches to the parser itself, and two main approaches to the output.',
        {
          type: 'table',
          headers: ['Parser style', 'Mechanism', 'Strength', 'Weakness'],
          rows: [
            ['Recursive descent', 'parseValue() calls parseObject() calls parseValue() recursively', 'Code mirrors the grammar directly; easy to write and read', 'Nesting depth limited by the call stack (typically 10,000-30,000 frames); hard to add a depth cap cleanly'],
            ['Explicit stack loop', 'A while loop with a manually managed frame array', 'Depth cap is a one-line check; cannot overflow the call stack', 'More bookkeeping; the state machine must be written out explicitly'],
          ],
        },
        {
          type: 'table',
          headers: ['Output style', 'Memory', 'API shape', 'Best for'],
          rows: [
            ['DOM tree', 'O(n) -- full value materialized', 'Returns the complete value; caller uses it like native data', 'Config files, API responses, small-to-medium documents'],
            ['SAX/event stream', 'O(d) -- only the stack', 'Emits events: startObject, key, value, endObject, etc.', 'Log processing, huge documents, filtering, constrained decoding'],
          ],
        },
        'Most applications use DOM parsing (JSON.parse in JavaScript, json.loads in Python, serde_json::from_str in Rust). Streaming parsing matters in three cases: the document is too large to fit in memory, the application only needs a few fields from a large object, or the parser is being used mid-generation to constrain what an LLM may emit next.',
        {
          type: 'note',
          text: 'Constrained decoding is the most interesting modern use of streaming JSON parsing. The parser maintains its stack state after every token. A token mask generator asks the stack what token kinds are legal next, and the LLM sampling step only allows tokens that would produce one of those kinds. The result is that every generated sequence is guaranteed to be valid JSON matching a given schema -- no post-hoc retry needed.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: RFC 8259, "The JavaScript Object Notation (JSON) Data Interchange Format" (2017) -- the normative grammar and interoperability rules. Available at https://www.rfc-editor.org/rfc/rfc8259.',
            'Implementation reference: Douglas Crockford\'s original json2.js parser, which shipped the recursive descent approach that most JavaScript parsers still follow. The ECMA-404 standard formalizes the same grammar.',
            'Security reference: "An Exploration of JSON Interoperability Vulnerabilities" by Bishop Fox (2017), documenting how different parsers handle duplicate keys, large numbers, and encoding variations differently -- leading to real security bypasses.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Stack', 'The frame array is a stack; push, pop, and top-of-stack are the only operations'],
            ['Prerequisite', 'Finite State Machines', 'Each frame type is a small FSM; the lexer is also an FSM'],
            ['Sibling', 'CSV Parser State Machine', 'Same lexer-plus-state-machine pattern for a simpler grammar with different traps (quoting, newlines)'],
            ['Extension', 'Pratt Parser Expression AST', 'Extends the stack idea to handle operator precedence in expression languages'],
            ['Extension', 'JSON Schema Constrained Decoding Token Mask', 'Uses the JSON parser stack mid-parse to restrict LLM token generation'],
            ['Production case', 'JSON-RPC Protocol Case Study', 'JSON parsing as the first stage of a request/response protocol with batching'],
          ],
        },
      ],
    },
  ],
};

