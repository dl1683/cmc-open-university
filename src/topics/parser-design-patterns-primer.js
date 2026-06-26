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
  const pipelineStages = ['bytes', 'decode', 'lexer', 'parser'];
  const destination = 'output';
  yield {
    state: parserGraph('A parser is a pipeline, not one giant if statement'),
    highlight: { active: pipelineStages, found: [destination] },
    explanation: `Most parsers become simpler when split into ${pipelineStages.length} core stages (${pipelineStages.join(' → ')} → ${destination}), plus state management and diagnostics.`,
    invariant: 'Keep each layer responsible for one kind of meaning.',
  };

  const layerRows = [
    { id: 'decode', label: 'decode' },
    { id: 'lex', label: 'lex' },
    { id: 'parse', label: 'parse' },
    { id: 'build', label: 'build' },
    { id: 'diag', label: 'diagnose' },
  ];
  const ioCols = [
    { id: 'input', label: 'input' },
    { id: 'output', label: 'output' },
  ];
  const layerIO = [
    ['bytes', 'characters/code points'],
    ['characters', 'tokens'],
    ['tokens', 'structure'],
    ['structure', 'tree/events/values'],
    ['source positions', 'actionable errors'],
  ];
  yield {
    state: labelMatrix('Layer responsibilities', layerRows, ioCols, layerIO),
    highlight: { active: ['decode:output', 'parse:output'], found: ['diag:output'] },
    explanation: `Each of the ${layerRows.length} layers (${layerRows.map(r => r.label).join(', ')}) maps ${ioCols[0].label} to ${ioCols[1].label} — for example, ${layerIO[0][0]} become ${layerIO[0][1]}. Separation makes failures explainable: a UTF-8 decoder should not know JSON grammar.`,
  };

  const memModels = [
    { id: 'fsm', label: 'finite state' },
    { id: 'stack', label: 'stack' },
    { id: 'tree', label: 'tree' },
    { id: 'table', label: 'table' },
  ];
  const memCols = [
    { id: 'fits', label: 'fits' },
    { id: 'example', label: 'example' },
  ];
  const memExamples = [
    ['bounded modes', 'CSV quotes'],
    ['nested structure', 'JSON arrays'],
    ['semantic structure', 'expression AST'],
    ['operator policy', 'Pratt parselets'],
  ];
  yield {
    state: labelMatrix('Which memory model fits?', memModels, memCols, memExamples),
    highlight: { active: ['fsm:example', 'stack:example', 'tree:example'], compare: ['table:fits'] },
    explanation: `The grammar determines which of ${memModels.length} memory models to use: ${memModels.map(m => m.label).join(', ')}. For example, a ${memModels[0].label} machine ${memCols[0].label} ${memExamples[0][0]} (${memExamples[0][1]}), while a ${memModels[1].label} handles ${memExamples[1][0]} (${memExamples[1][1]}).`,
  };

  const binaryNotes = { bytes: 'wire', decode: 'varint', lexer: 'field tag', parser: 'schema', state: 'reader', output: 'record' };
  const binaryActive = ['bytes', 'decode', 'parser', 'state'];
  yield {
    state: parserGraph('Binary formats use the same discipline', binaryNotes),
    highlight: { active: binaryActive, found: ['output'] },
    explanation: `The pattern is not only for text. Protobuf and Avro still pass through ${binaryActive.length} active stages — ${binaryActive.map(s => `${s} (${binaryNotes[s]})`).join(', ')} — and emit typed ${binaryNotes.output}s.`,
  };

  const contractRows = [
    { id: 'valid', label: 'valid input' },
    { id: 'invalid', label: 'invalid input' },
    { id: 'partial', label: 'partial input' },
    { id: 'huge', label: 'huge input' },
  ];
  const contractCols = [
    { id: 'must', label: 'must do' },
    { id: 'avoid', label: 'avoid' },
  ];
  const contractRules = [
    ['emit one meaning', 'ambiguous output'],
    ['reject with location', 'silent repair'],
    ['resume or wait', 'lose state'],
    ['bound memory', 'load everything blindly'],
  ];
  yield {
    state: labelMatrix('The parser contract', contractRows, contractCols, contractRules),
    highlight: { active: ['invalid:must', 'partial:must'], compare: ['huge:avoid'] },
    explanation: `A production parser covers ${contractRows.length} input classes (${contractRows.map(r => r.label).join(', ')}). For each, it "${contractCols[0].label}" one thing and "${contractCols[1].label}" another — for instance, ${contractRows[1].label} ${contractCols[0].label}: ${contractRules[1][0]}, ${contractCols[1].label}: ${contractRules[1][1]}.`,
  };
}

function* streamingVersusTree() {
  const outputNotes = { state: 'stack', output: 'events/tree' };
  const outputActive = ['parser', 'state', 'output', 'e-state-output'];
  yield {
    state: parserGraph('The same parser can emit events or build a tree', outputNotes),
    highlight: { active: outputActive, found: ['errors'] },
    explanation: `Output shape is a design choice — the ${outputNotes.state} drives state while the output node produces ${outputNotes.output}. A SAX-style stream emits events as input arrives; a DOM-style parser builds a full tree; a compiler parser builds an AST with source spans. This step highlights ${outputActive.length} active elements.`,
    invariant: 'Choose output shape from the downstream workflow, not from parser convenience alone.',
  };

  const shapeRows = [
    { id: 'events', label: 'event stream' },
    { id: 'rows', label: 'row batches' },
    { id: 'tree', label: 'full tree' },
    { id: 'ast', label: 'AST' },
  ];
  const shapeCols = [
    { id: 'strength', label: 'strength' },
    { id: 'cost', label: 'cost' },
  ];
  const shapeTradeoffs = [
    ['low memory', 'consumer must track state'],
    ['pipeline friendly', 'batch sizing'],
    ['random access', 'memory heavy'],
    ['analysis/refactor', 'more node types'],
  ];
  yield {
    state: labelMatrix('Output shapes', shapeRows, shapeCols, shapeTradeoffs),
    highlight: { active: ['events:strength', 'rows:strength'], compare: ['tree:cost'] },
    explanation: `There are ${shapeRows.length} output shapes — ${shapeRows.map(r => r.label).join(', ')} — each with a ${shapeCols[0].label} and a ${shapeCols[1].label}. CSV ingestion usually wants ${shapeRows[1].label} (${shapeTradeoffs[1][0]}), while editors want a ${shapeRows[2].label} despite the cost: ${shapeTradeoffs[2][1]}.`,
  };

  const guardRows = [
    { id: 'bytes', label: 'byte limit' },
    { id: 'depth', label: 'depth limit' },
    { id: 'field', label: 'field limit' },
    { id: 'time', label: 'time budget' },
  ];
  const guardCols = [
    { id: 'protects', label: 'protects' },
    { id: 'failure', label: 'failure if missing' },
  ];
  const guardValues = [
    ['memory', 'giant payload'],
    ['stack/recursion', 'deep nesting'],
    ['row shape', 'wide records'],
    ['latency', 'UI freeze or timeout'],
  ];
  yield {
    state: labelMatrix('Resource guards', guardRows, guardCols, guardValues),
    highlight: { active: ['bytes:protects', 'depth:protects'], found: ['time:failure'] },
    explanation: `Parsers are attack surfaces. ${guardRows.length} resource guards — ${guardRows.map(r => r.label).join(', ')} — each ${guardCols[0].label} a resource (e.g. ${guardRows[0].label} ${guardCols[0].label} ${guardValues[0][0]}) and causes a specific ${guardCols[1].label} when absent (e.g. ${guardValues[0][1]}).`,
  };

  const diagNotes = { lexer: 'token span', parser: 'expected', errors: 'line/col' };
  const diagActive = ['lexer', 'parser', 'errors', 'e-parser-errors'];
  yield {
    state: parserGraph('Good diagnostics carry source spans through every layer', diagNotes),
    highlight: { active: diagActive, compare: ['output'] },
    explanation: `Diagnostics require bookkeeping across ${diagActive.length} highlighted elements. The lexer carries a ${diagNotes.lexer}, the parser knows what it ${diagNotes.parser}, and errors resolve to ${diagNotes.errors}. If spans survive, the parser can say "expected colon after key at line 12, column 8" instead of just "failed."`,
  };

  const checklistRows = [
    { id: 'language', label: 'language' },
    { id: 'states', label: 'states' },
    { id: 'output', label: 'output' },
    { id: 'limits', label: 'limits' },
    { id: 'errors', label: 'errors' },
  ];
  const checklistCols = [
    { id: 'question', label: 'question' },
    { id: 'artifact', label: 'artifact' },
  ];
  const checklistEntries = [
    ['what is valid?', 'grammar/spec'],
    ['what memory?', 'FSM/stack/tree'],
    ['who consumes it?', 'events/tree/rows'],
    ['what can grow?', 'caps and budgets'],
    ['what helps repair?', 'source spans'],
  ];
  yield {
    state: labelMatrix('Complete design checklist', checklistRows, checklistCols, checklistEntries),
    highlight: { active: ['states:artifact', 'output:artifact'], found: ['errors:artifact'] },
    explanation: `This ${checklistRows.length}-item checklist answers one ${checklistCols[0].label} per row and names the ${checklistCols[1].label}: ${checklistRows.map((r, i) => `${r.label} → ${checklistEntries[i][1]}`).join(', ')}. It is the reusable primer for any parser design.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph from left to right as a pipeline. Active nodes show the layer currently owning the input, and the safe inference is that each layer should emit one narrower kind of meaning than it received.',
        {type: 'image', src: './assets/gifs/parser-design-patterns-primer.gif', alt: 'Animated walkthrough of the parser design patterns primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the streaming view, the output node can mean events, row batches, a tree, or typed records. The important signal is not the shape alone; it is which state must survive across chunks, failures, and diagnostics.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A parser turns raw input into a structured meaning that later code can trust. The input may be bytes from a file, characters from source code, fields from a protocol, or chunks from a network stream.',
        { type: 'callout', text: 'Parser design is boundary design: each layer owns one kind of meaning and one kind of failure.' },
        'Parser design exists because malformed input is normal. A useful parser must accept valid input, reject invalid input with a location, bound memory and time, and leave downstream code with one explicit interpretation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious implementation is one large loop with many branches. Read a character, update a flag, append to an output buffer, maybe build an object, and throw an error when something looks wrong.',
        'This works for a toy CSV reader or a tiny expression language. It feels fast because all state is in one place and the first examples do not force the code to explain exactly which rule failed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is responsibility collapse. A tangled parser cannot tell whether a failure came from invalid bytes, tokenization, grammar structure, semantic validation, resource limits, or output construction.',
        'Streaming makes the wall harder. If a UTF-8 code point, quoted CSV field, JSON string escape, or nested object is split across chunks, the parser must resume from precise state rather than restart or guess.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate kinds of meaning. A decoder validates bytes, a lexer groups characters into tokens, a parser recognizes structure, a builder emits the chosen output, and diagnostics carry source spans across the whole path.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg',
          alt: 'Abstract syntax tree for a small Euclidean algorithm program',
          caption: 'An AST is one possible parser output: syntax made navigable for later analysis and transformation. Source: Wikimedia Commons.',
        },
        'The state model follows the grammar. Bounded modes fit a finite-state machine, nested structures need a stack, and expressions need precedence rules or parse tables that decide how operators bind.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, decoding maps bytes to valid primitive symbols. For text this may be UTF-8 code points; for binary formats it may be varints, fixed-width integers, lengths, tags, checksums, or frame boundaries.',
        'Second, lexical or low-level scanning groups primitives into units the grammar can use. Tokens can be identifiers, strings, numbers, braces, commas, field tags, row separators, or protocol records.',
        'Third, parser state consumes those units according to a grammar. The output layer then emits events, row batches, a full tree, an abstract syntax tree, typed records, or errors with source spans.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that parser state explains every token consumed so far. A stack frame, finite-state mode, or parse table entry records what construct is open and which inputs are legal next.',
        'When a token violates the current state, the parser can reject at the exact span that made the input impossible. This is why explicit state beats ad hoc splitting for languages, data formats, and protocols that must fail safely.',
        'Layering also makes testing sharper. A UTF-8 decoder can be tested without JSON rules, and a JSON parser can be tested with already-tokenized input, so failures point to the layer that owns them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Many parsers are O(n) in input length, but the constant factors decide production behavior. Decoding, escaping, allocation, token objects, source-span storage, schema lookup, and tree construction can dominate the state transition itself.',
        'Streaming reduces peak memory because the parser can emit output before the whole input is loaded. A tree parser spends more memory to provide random access and later analysis, while an event parser pushes some state burden onto the consumer.',
        'Resource limits are part of the cost model. Byte limits, depth limits, token-length limits, error limits, recursion limits, and time budgets prevent valid grammar machinery from becoming an allocation or latency attack.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compilers use parsers to turn source text into syntax trees with spans. Formatters, linters, refactoring tools, and type checkers all depend on the tree preserving enough structure to explain and transform code.',
        'Data systems use parsers for CSV, JSON, Avro, Protobuf, SQL, logs, and configuration files. Gateways and import tools need bounded memory, useful diagnostics, compatibility modes, and streaming backpressure.',
        'Editors use incremental parsers because a single keystroke should not reparse a full project. The parser retains trees, invalidation ranges, and grammar state so only affected regions are rebuilt.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Layered parsing fails when the wrong layer owns a rule. If business validation is mixed into syntax recognition, a parser may reject structurally valid input that another caller needed to inspect.',
        'It also fails when permissive behavior is unnamed. Silent repair, comments in strict JSON, duplicate-key coercion, or partial recovery can become security bugs when different components parse different languages.',
        'Regular-expression shortcuts can fail badly on hostile input. Backtracking regex engines can turn a small string into exponential work, so protocol boundaries often need bounded regexes, DFA-style tokenizers, or explicit state machines.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Parse the JSON text {"a":[1,2]}. The decoder validates 11 bytes, the tokenizer emits left brace, string token a, colon, left bracket, number 1, comma, number 2, right bracket, and right brace.',
        'The parser starts with an empty stack. It pushes object after {, records that the next legal token is a key or }, consumes key a and colon, then pushes array after [ and accepts values separated by commas until ].',
        'The result can be an event stream such as startObject, key a, startArray, number 1, number 2, endArray, endObject. If the closing ] were missing, the stack would still contain an open array, so the error can say that an array close was expected at the current byte span.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references include RFC 3629 for UTF-8 at https://www.rfc-editor.org/rfc/rfc3629, RFC 4180 for CSV at https://www.rfc-editor.org/rfc/rfc4180, RFC 8259 for JSON at https://www.rfc-editor.org/rfc/rfc8259, Vaughan Pratt Top Down Operator Precedence at https://tdop.github.io/, and Russ Cox on regex engines at https://swtch.com/~rsc/regexp/regexp1.html.',
        'Study UTF-8 Decoder DFA, CSV Parser State Machine, JSON Parser Stack, Pratt Parser Expression AST, Thompson NFA Regex Engine, Regex Backtracking Catastrophic Case Study, Protobuf Wire Format, Avro Binary Encoding Schema Resolution, and Tree-sitter Incremental Parsing next.',
      ],
    },
  ],
};
