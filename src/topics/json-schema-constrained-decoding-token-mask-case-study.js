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
    {
      heading: 'Why this exists',
      paragraphs: [
        'JSON is the boundary where many LLM systems stop being chat and start acting like software. Tool calls, extraction jobs, workflow commands, agent plans, and typed API requests all need values in predictable fields. If the output is malformed, the caller either retries, repairs, drops the request, or lets a bad argument reach another system.',
        'JSON Schema constrained decoding exists because instruction-following is not the same as enforcement. A prompt can ask for valid JSON, but the sampler can still choose a quote, comma, key, or value that makes the object unparsable or incomplete. A constrained decoder turns the schema into a decode-time contract: at each step, illegal tokens receive probability zero before sampling.',
      ],
    },
    {
      heading: 'The naive approach and wall',
      paragraphs: [
        'The reasonable first attempt is prompt-and-parse. Ask the model for JSON, parse the response, retry if parsing fails, and maybe run a repair prompt. This works well enough for demos and low-volume scripts because many modern models usually follow simple formatting instructions.',
        'The wall appears in production. Retries add latency and cost. Repair prompts can change meaning while fixing syntax. Streaming becomes awkward because a client can receive an invalid prefix before the final repair. More important, parse success is a late signal: the model has already spent tokens on an output that the system might reject. A tool-calling route with strict latency and audit requirements needs invalid structure prevented during generation, not cleaned up after failure.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to treat output generation as language recognition in reverse. A JSON Schema describes a set of acceptable outputs. The decoder maintains parser state for the prefix already emitted, computes which tokens keep that prefix extendable to a valid object, masks everything else, and samples only from the legal set.',
        'The model still chooses among legal options. The schema does not decide whether the city should be Boston or Tokyo. It decides that the next token must be a legal key, string byte, enum value, number fragment, comma, bracket, or close brace for the current parser state. This split is the key: the model supplies content probabilities, and the grammar supplies structural permission.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The schema-compile view shows that constrained decoding is not a prompt trick. The system first resolves references, normalizes rules, creates grammar transitions, records required-field bits, maps vocabulary tokens into grammar actions, and stores safety limits. The schema hash becomes a cache key so repeated requests do not rebuild the same machinery.',
        'The mask-engine view shows the hot path. Logits arrive from the model. Parser state and token-prefix indexes produce a legal-token mask. The engine renormalizes probabilities over the legal set and emits one token. The serve-gate view shows the limit of the guarantee: valid parse and valid schema are early gates, not proof that the argument is true, authorized, grounded, or safe to execute.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'Compilation turns schema features into runtime state. Object properties become grammar branches. Required fields become bitsets. Enums become a small set of allowed string paths. Arrays need item rules and length counters. Numeric ranges need lexical and semantic checks. Additional-property rules decide whether unseen keys are allowed. Depth and size limits protect the serving path from schemas or outputs that would make the mask engine too slow.',
        'Runtime decoding repeats a short loop. First, the model produces logits for the whole vocabulary. Second, the grammar engine reads the current parser stack, required-field bits, array counters, and string or number lexer state. Third, a token trie maps vocabulary tokens to byte prefixes and grammar actions. Fourth, illegal logits are masked, the remaining probabilities are renormalized, and the sampler chooses one legal token. Finally, the parser state advances and the loop repeats.',
        'Required fields show why this is stronger than JSON mode. A plain JSON generator can close an object after producing city and units while forgetting days. A constrained decoder can keep the close brace masked until the required-bit set says city, units, and days have all appeared. The object can still contain a wrong city, but it cannot close while missing a required field.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof sketch is a prefix invariant. After every emitted token, the current byte string is a prefix of at least one output allowed by the compiled schema language. The invariant is true before generation because the empty string is a valid prefix. Each step preserves it because the mask only allows tokens whose bytes can advance the parser to another extendable state.',
        'When generation ends, the final state must satisfy both the grammar and the stored obligations such as required fields, closed arrays, closed objects, and completed strings or numbers. If the legal set becomes empty, the invariant has been broken by the compiler, tokenizer mapping, stream boundary, or a schema that cannot be satisfied under the current prefix. That is a systems bug to log, not a place to ask the model to be more creative.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost has two parts. Compile time grows with schema size, references, enum expansion, nesting, and the amount of vocabulary indexing needed. Decode time pays a mask cost on every generated token. If the mask engine is slow, structured output can erase gains from batching, KV cache reuse, and optimized attention kernels.',
        'Systems reduce the tax with cached compile artifacts, token tries, precomputed tables for context-independent tokens, persistent parser stacks for beams, and careful overlap with inference execution. Efficient guided generation work frames many constraints as state transitions plus vocabulary indexes. XGrammar extends the idea for context-free grammars by separating tokens that can be prechecked from tokens that need runtime stack interpretation.',
        'The tradeoff is strictness. A tight schema removes malformed output and narrows downstream validation, but it can also make useful answers impossible if the schema is wrong, underspecified, or too brittle. A loose schema is easier for the model but pushes risk back to validators. Production systems should version schemas and track empty-mask failures, retry causes, validation failures, and repair rates.',
      ],
    },
    {
      heading: 'Complete case',
      paragraphs: [
        'Suppose a weather tool requires an object with city as a string, units as enum C or F, and days as an integer from 1 through 7. The compiler creates object rules, required bits for city, units, and days, enum transitions for the units value, number-state checks for days, and an object-close gate that stays masked until all required bits are set.',
        'During decoding, the model can choose Boston or Tokyo for city, but it cannot omit days, invent unit K, close the object early, or emit an array where the tool expects an object. The downstream tool still needs semantic validation. If the user asked for Tokyo and the model emits Boston, the payload is structured but wrong. Constrained decoding gives the caller a parseable object; policy, grounding, and authorization decide whether that object should execute.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This technique wins when invalid structure is expensive: tool calls, typed extraction, workflow state transitions, data-cleaning pipelines, form filling, agent action plans, and APIs that need stable contracts. It is also useful for streaming because each prefix can remain syntactically safe rather than waiting for a final repair pass.',
        'It is a natural companion to schemas in larger systems. JSON Schema Parser Stack topics explain parsing. Trie and finite-state machine topics explain the indexing idea. Speculative decoding and prefix caching explain why the mask engine must be cheap enough to live beside optimized inference code.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Constrained decoding does not prove truth. A valid object can contain a hallucinated city, stale product id, unauthorized account number, unsupported citation, unsafe tool argument, or policy-violating value that still matches the schema. It also does not remove the need for rate limits, depth limits, tokenizer tests, schema review, and semantic validators.',
        'It can fail operationally through tokenizer boundary bugs, malformed grammar compilation, legal sets that are too large to compute cheaply, schemas that allow dangerous strings, and streaming implementations that expose prefixes without enough context. Treat parse validity, schema validity, policy validity, grounding, and traceability as separate gates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Efficient Guided Generation for Large Language Models at https://arxiv.org/abs/2307.09702, XGrammar at https://arxiv.org/abs/2411.15100, XGrammar project page at https://catalyst.cs.cmu.edu/projects/xgrammar.html, OpenAI Structured Outputs documentation at https://developers.openai.com/api/docs/guides/structured-outputs, llama.cpp GBNF grammar guide at https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md, and JSON Schema at https://json-schema.org/.',
        'Study next by layer. For language machinery, read Parser Design Patterns Primer, Finite-State Machine, Trie (Prefix Tree), Tokenization (BPE), and JSON Parser Stack Case Study. For inference behavior, read Softmax and Temperature, Beam Search vs Greedy, Speculative Decoding, and Prefix Caching. For safety boundaries, read LLM Guardrail Policy Engine, Prompt Injection Threat Model, RAG Claim Verification Support Ledger, and Model Context Protocol Case Study.',
      ],
    },
  ],
};
