// Structured outputs: compile JSON schema into grammar state, token masks,
// prefix-safe streaming, semantic validation, and production rollout gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'json-schema-constrained-decoding-token-mask-case-study',
  title: 'JSON Schema Constrained Decoding Token Mask',
  category: 'AI & ML',
  summary: 'A structured-output case study: compile JSON Schema into grammar state, mask illegal tokens, track required fields, stream valid prefixes, and validate semantics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['schema compile', 'mask engine', 'serve gate'], defaultValue: 'schema compile' },
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

function compileGraph(title) {
  return graphState({
    nodes: [
      { id: 'schema', label: 'schema', x: 0.7, y: 3.8, note: 'JSON' },
      { id: 'norm', label: 'norm', x: 2.2, y: 3.8, note: 'resolve' },
      { id: 'grammar', label: 'grammar', x: 3.8, y: 2.4, note: 'CFG' },
      { id: 'req', label: 'req bits', x: 3.8, y: 5.2, note: 'fields' },
      { id: 'trie', label: 'trie', x: 5.6, y: 2.4, note: 'vocab' },
      { id: 'stack', label: 'stack', x: 5.6, y: 5.2, note: 'state' },
      { id: 'mask', label: 'mask', x: 7.4, y: 3.8, note: 'tokens' },
      { id: 'sample', label: 'sample', x: 9.0, y: 3.8, note: 'legal' },
      { id: 'valid', label: 'parse', x: 10.4, y: 3.8, note: 'JSON' },
    ],
    edges: [
      { id: 'e-schema-norm', from: 'schema', to: 'norm', weight: '$ref' },
      { id: 'e-norm-grammar', from: 'norm', to: 'grammar', weight: 'rules' },
      { id: 'e-norm-req', from: 'norm', to: 'req', weight: 'required' },
      { id: 'e-grammar-trie', from: 'grammar', to: 'trie', weight: 'bytes' },
      { id: 'e-grammar-stack', from: 'grammar', to: 'stack', weight: 'push' },
      { id: 'e-req-stack', from: 'req', to: 'stack', weight: 'seen' },
      { id: 'e-trie-mask', from: 'trie', to: 'mask', weight: 'prefix' },
      { id: 'e-stack-mask', from: 'stack', to: 'mask', weight: 'legal' },
      { id: 'e-mask-sample', from: 'mask', to: 'sample', weight: 'renorm' },
      { id: 'e-sample-valid', from: 'sample', to: 'valid', weight: 'emit' },
    ],
  }, { title });
}

function* schemaCompile() {
  yield {
    state: labelMatrix(
      'Schema fields become parser obligations',
      [
        { id: 'city', label: 'city' },
        { id: 'units', label: 'units' },
        { id: 'days', label: 'days' },
        { id: 'notes', label: 'notes' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'rule', label: 'rule' },
        { id: 'req', label: 'req' },
      ],
      [
        ['string', 'min1', 'yes'],
        ['enum', 'C|F', 'yes'],
        ['int', '1..7', 'yes'],
        ['array', 'max3', 'no'],
      ],
    ),
    highlight: { active: ['city:req', 'units:req', 'days:req'], compare: ['notes:req'], found: ['units:rule'] },
    explanation: 'Read each schema row as an obligation the decoder must remember. Required fields, enum choices, numeric bounds, array limits, and object-closure rules all become parser state that constrains the next token.',
    invariant: 'The schema controls shape; the model still chooses among legal values.',
  };

  yield {
    state: compileGraph('Compile JSON Schema into grammar and required-field state'),
    highlight: { active: ['schema', 'norm', 'grammar', 'req', 'e-schema-norm', 'e-norm-grammar', 'e-norm-req'], found: ['mask'] },
    explanation: 'The serving system should compile the schema before generation. It resolves references, normalizes object rules, creates grammar transitions, and builds required-field bitsets that update as properties appear.',
  };

  yield {
    state: labelMatrix(
      'Required-field bitset',
      [
        { id: 'start', label: 'start' },
        { id: 'city', label: 'city seen' },
        { id: 'units', label: 'units seen' },
        { id: 'days', label: 'days seen' },
        { id: 'done', label: 'close ok' },
      ],
      [
        { id: 'city', label: 'city' },
        { id: 'units', label: 'units' },
        { id: 'days', label: 'days' },
        { id: 'close', label: '}' },
      ],
      [
        ['0', '0', '0', 'mask'],
        ['1', '0', '0', 'mask'],
        ['1', '1', '0', 'mask'],
        ['1', '1', '1', 'allow'],
        ['1', '1', '1', 'done'],
      ],
    ),
    highlight: { active: ['days:close', 'done:close'], compare: ['start:close', 'city:close', 'units:close'] },
    explanation: 'Required properties are naturally represented as bits. The object cannot close until all required bits are set. This is the part that plain JSON mode cannot promise from syntax alone.',
  };

  yield {
    state: labelMatrix(
      'Enum and range constraints',
      [
        { id: 'units', label: 'units' },
        { id: 'days', label: 'days' },
        { id: 'city', label: 'city' },
        { id: 'notes', label: 'notes' },
      ],
      [
        { id: 'legal', label: 'legal' },
        { id: 'mask', label: 'masked' },
        { id: 'still', label: 'risk' },
      ],
      [
        ['C,F', 'K', 'unit'],
        ['1..7', '0,8', 'ask'],
        ['string', 'num', 'false'],
        ['0..3', '4+', 'unsafe'],
      ],
    ),
    highlight: { active: ['units:legal', 'days:legal'], compare: ['city:still', 'notes:still'] },
    explanation: 'Schema constraints reduce invalid values, but not all semantic failures. An enum can prevent Kelvin if only Celsius or Fahrenheit is allowed; it cannot prove the city name is appropriate for the user request.',
  };

  yield {
    state: labelMatrix(
      'Compile artifact',
      [
        { id: 'hash', label: 'schema id' },
        { id: 'rules', label: 'rules' },
        { id: 'bits', label: 'req bits' },
        { id: 'trie', label: 'trie map' },
        { id: 'limits', label: 'limits' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['sha256', 'cache key'],
        ['CFG', 'legal next'],
        ['field mask', 'close gate'],
        ['token ids', 'fast mask'],
        ['depth,size', 'DoS guard'],
      ],
    ),
    highlight: { active: ['hash:stores', 'rules:stores', 'bits:stores', 'trie:stores'], found: ['limits:stores'] },
    explanation: 'A production structured-output feature should cache a compile artifact. Store the schema hash, grammar rules, required-field state, vocabulary mapping, and safety limits so repeated requests do not rebuild the engine.',
  };
}

function* maskEngine() {
  yield {
    state: compileGraph('Mask generation sits in the decode hot path'),
    highlight: { active: ['trie', 'stack', 'mask', 'sample', 'e-trie-mask', 'e-stack-mask', 'e-mask-sample'], compare: ['schema', 'norm'] },
    explanation: 'After compile time, every decode step needs a legal-token mask. This is in the serving hot path, so the mask must be fast enough that structured output does not erase gains from batching, KV cache reuse, and optimized kernels.',
  };

  yield {
    state: labelMatrix(
      'Token mask step',
      [
        { id: 'logits', label: 'logits' },
        { id: 'mask', label: 'mask' },
        { id: 'renorm', label: 'renorm' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['all vocab', 'scores'],
        ['state+trie', 'legal set'],
        ['legal scores', 'probs'],
        ['sample', 'token'],
      ],
    ),
    highlight: { active: ['logits:output', 'mask:output', 'renorm:output', 'emit:output'], compare: ['mask:input'] },
    explanation: 'The order is logits, mask, renormalize, sample. If the legal set is empty, the issue is the schema-tokenization engine or an impossible prefix, not model creativity.',
    invariant: 'Illegal tokens receive probability zero before sampling.',
  };

  yield {
    state: labelMatrix(
      'Context split',
      [
        { id: 'quote', label: 'quote' },
        { id: 'brace', label: 'brace' },
        { id: 'city', label: 'city key' },
        { id: 'str', label: 'str byte' },
        { id: 'close', label: 'close' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'path', label: 'path' },
      ],
      [
        ['indep', 'precheck'],
        ['indep', 'precheck'],
        ['dep', 'stack'],
        ['dep', 'lexer'],
        ['dep', 'req bits'],
      ],
    ),
    highlight: { active: ['quote:path', 'brace:path'], compare: ['city:path', 'close:path'] },
    explanation: 'XGrammar-style systems speed up grammar execution by separating context-independent tokens that can be prechecked from context-dependent tokens that need runtime stack interpretation.',
  };

  yield {
    state: labelMatrix(
      'Persistent stack states',
      [
        { id: 'beam0', label: 'beam0' },
        { id: 'beam1', label: 'beam1' },
        { id: 'beam2', label: 'beam2' },
        { id: 'beam3', label: 'beam3' },
      ],
      [
        { id: 'top', label: 'top' },
        { id: 'req', label: 'req' },
        { id: 'share', label: 'share' },
      ],
      [
        ['object', '101', 'root'],
        ['string', '101', 'root'],
        ['array', '111', 'root'],
        ['object', '001', 'root'],
      ],
    ),
    highlight: { active: ['beam0:share', 'beam1:share', 'beam2:share'], compare: ['beam3:req'] },
    explanation: 'Beam search and sampling variants may carry many grammar states. Persistent stacks share common prefixes instead of copying the whole parser stack at every token.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'schema size', min: 1, max: 100 }, y: { label: 'mask cost', min: 0, max: 100 } },
      series: [
        { id: 'naive', label: 'naive', points: [
          { x: 5, y: 8 }, { x: 20, y: 28 }, { x: 45, y: 58 }, { x: 75, y: 86 }, { x: 100, y: 98 },
        ] },
        { id: 'cached', label: 'cached', points: [
          { x: 5, y: 4 }, { x: 20, y: 8 }, { x: 45, y: 14 }, { x: 75, y: 22 }, { x: 100, y: 32 },
        ] },
      ],
      markers: [
        { id: 'gate', x: 45, y: 20, label: 'SLO' },
      ],
    }),
    highlight: { active: ['cached', 'gate'], compare: ['naive'] },
    explanation: 'Schema complexity has a cost. Cached compile artifacts, vocab indexes, prechecked tokens, and persistent stacks keep mask generation below the decode latency budget.',
  };
}

function* serveGate() {
  yield {
    state: compileGraph('Structured output still needs semantic validation'),
    highlight: { active: ['mask', 'sample', 'valid'], compare: ['schema'], found: ['stack'] },
    explanation: 'This frame is the boundary of the guarantee. A valid parse is not a correct answer: the JSON can match the schema and still contain unsupported facts, unsafe values, stale IDs, or an unauthorized tool argument.',
  };

  yield {
    state: labelMatrix(
      'JSON mode vs schema mode',
      [
        { id: 'json', label: 'JSON mode' },
        { id: 'schema', label: 'schema' },
        { id: 'grammar', label: 'grammar' },
        { id: 'semantic', label: 'semantic' },
      ],
      [
        { id: 'guarantee', label: 'guarantee' },
        { id: 'gap', label: 'gap' },
      ],
      [
        ['valid JSON', 'missing keys'],
        ['shape', 'false value'],
        ['language', 'bad intent'],
        ['policy', 'model drift'],
      ],
    ),
    highlight: { active: ['schema:guarantee', 'grammar:guarantee'], compare: ['json:gap'], found: ['semantic:guarantee'] },
    explanation: 'JSON syntax, schema conformance, grammar conformance, and semantic validity are different gates. Production systems should name which one they enforce rather than treating structured output as one feature.',
  };

  yield {
    state: labelMatrix(
      'Serving validation gate',
      [
        { id: 'parse', label: 'parse' },
        { id: 'schema', label: 'schema' },
        { id: 'policy', label: 'policy' },
        { id: 'ground', label: 'ground' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'fail', label: 'fail' },
        { id: 'act', label: 'act' },
      ],
      [
        ['valid', 'bad JSON', 'retry'],
        ['strict', 'bad key', 'block'],
        ['allowed', 'unsafe', 'block'],
        ['source', 'no cite', 'ask'],
        ['sid', 'missing', 'audit'],
      ],
    ),
    highlight: { active: ['parse:metric', 'schema:metric', 'policy:metric', 'trace:metric'], compare: ['ground:fail'] },
    explanation: 'A robust structured-output stack validates parseability, schema adherence, policy, grounding, and traceability. If any stage fails, the retry or block action should be explicit.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'compile', label: 'compile' },
        { id: 'empty', label: 'empty set' },
        { id: 'stream', label: 'stream' },
        { id: 'token', label: 'tokenizer' },
        { id: 'truth', label: 'truth' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['slow first', 'cache'],
        ['no token', 'debug CFG'],
        ['bad prefix', 'state log'],
        ['split odd', 'byte trie'],
        ['valid lie', 'verify'],
      ],
    ),
    highlight: { active: ['compile:fix', 'empty:fix', 'token:fix'], compare: ['truth:symptom'] },
    explanation: 'The failure ledger should separate compile latency, empty legal-token sets, streaming prefix bugs, tokenizer boundary bugs, and semantic falsehood. They require different fixes.',
  };

  yield {
    state: labelMatrix(
      'Trace fields',
      [
        { id: 'schema', label: 'schema id' },
        { id: 'state', label: 'state id' },
        { id: 'mask', label: 'mask sz' },
        { id: 'choice', label: 'choice' },
        { id: 'valid', label: 'valid' },
        { id: 'repair', label: 'repair' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['sha', 'cache'],
        ['stack', 'replay'],
        ['count', 'cost'],
        ['token', 'debug'],
        ['pass/fail', 'gate'],
        ['reason', 'retry'],
      ],
    ),
    highlight: { active: ['schema:stores', 'state:stores', 'mask:stores', 'valid:stores'], found: ['repair:stores'] },
    explanation: 'Trace schema ID, parser state, legal-token count, chosen token, validation result, and repair reason. That is the minimum ledger for debugging structured output in production.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'schema compile') yield* schemaCompile();
  else if (view === 'mask engine') yield* maskEngine();
  else if (view === 'serve gate') yield* serveGate();
  else throw new InputError('Pick a structured-output view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read schema compile as setup and mask engine as the hot path. A JSON Schema is a machine-readable contract for fields, types, required properties, and allowed values. Active nodes show the contract becoming parser state, required-field bits, vocabulary indexes, and a legal-token mask.',
      {type:'callout', text:'Constrained decoding moves schema compliance from hopeful post-processing into the sampler itself, where illegal next tokens can be removed before they exist.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'LLM tools need typed arguments, not a polite paragraph. A caller may need city, units, and days as parseable JSON before it can execute code. Prompting asks for that shape, but constrained decoding enforces the shape while tokens are being sampled.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is prompt, parse, validate, and retry. That is enough for demos because modern models often follow simple JSON instructions. In production, retries spend tokens, add latency, and can change the answer while repairing syntax.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is prefix-dependent legality. After an object has emitted two required fields, a close brace may still be illegal because a third required field is missing. The decoder must know parser state and schema obligations, not only the last token.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat generation as language recognition in reverse. The schema defines the language of acceptable outputs, and the current prefix has a parser state. The model supplies preferences among legal choices; the grammar decides which next tokens keep the prefix extendable to a valid final object.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Compilation resolves references, turns object rules into grammar transitions, records required fields as bits, and maps vocabulary tokens through a trie. At decode time, model logits arrive for the whole vocabulary. The mask engine zeros illegal logits, renormalizes legal ones, samples a token, and advances parser state.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is a prefix invariant. After every emitted token, the output prefix must be extendable to at least one schema-valid completion. The mask preserves that invariant by allowing only tokens that move to another extendable state, and final acceptance requires closed JSON plus satisfied required fields.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Compile cost grows with schema size, references, enum count, nesting, and vocabulary indexing. Decode cost is paid on every generated token. If a 120-token response pays 0.2 ms of mask work per token, the mask adds 24 ms before model compute and network time.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Tool calling is the main use: weather requests, database filters, workflow commands, and agent actions can require typed fields. Extraction pipelines use it for invoices, support tickets, forms, and compliance records. Streaming APIs use it because each prefix can remain structurally safe.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Constrained decoding proves shape, not truth. A schema-valid object can still name the wrong city, stale product id, unsupported citation, or unauthorized account. Production systems still need authorization, grounding, semantic validation, rate limits, and logs for empty legal-token sets.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Use a schema with city string, units enum C or F, and days integer 1 through 7. After the prefix has units C and days 3, the close brace is still masked if city is missing. Once city Tokyo appears, all three required bits are set and the close brace becomes legal.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: JSON Schema at https://json-schema.org/, RFC 8259 at https://www.rfc-editor.org/rfc/rfc8259, Efficient Guided Generation at https://arxiv.org/abs/2307.09702, XGrammar at https://arxiv.org/abs/2411.15100, llama.cpp grammar docs at https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md, and OpenAI Structured Outputs at https://platform.openai.com/docs/guides/structured-outputs. Study JSON Parser Stack, FSMs, Tries, Tokenization, Softmax, Beam Search, and Guardrail Policy Engines next.',
    ] },
  ],
};
