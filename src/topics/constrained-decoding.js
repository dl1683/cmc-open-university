// Constrained decoding: turn format rules into token masks so an LLM can only
// emit tokens that keep the output valid.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'constrained-decoding',
  title: 'Constrained Decoding',
  category: 'AI & ML',
  summary: 'Guarantee JSON, regex, or grammar structure by masking invalid next tokens during generation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['json schema', 'grammar mask'], defaultValue: 'json schema' },
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

function automaton(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'start', x: 0.6, y: 3.8, note: 'empty' },
      { id: 'open', label: '{', x: 2.0, y: 3.8, note: 'object' },
      { id: 'key', label: '"city"', x: 3.7, y: 2.4, note: 'key' },
      { id: 'colon', label: ':', x: 5.0, y: 2.4, note: 'separator' },
      { id: 'value', label: '"Paris"', x: 6.7, y: 2.4, note: 'value' },
      { id: 'comma', label: ',', x: 5.0, y: 5.1, note: 'next field' },
      { id: 'close', label: '}', x: 8.3, y: 3.8, note: 'valid JSON' },
    ],
    edges: [
      { id: 'e-start-open', from: 'start', to: 'open', weight: 'only {' },
      { id: 'e-open-key', from: 'open', to: 'key', weight: 'required key' },
      { id: 'e-key-colon', from: 'key', to: 'colon', weight: ':' },
      { id: 'e-colon-value', from: 'colon', to: 'value', weight: 'string' },
      { id: 'e-value-comma', from: 'value', to: 'comma', weight: 'optional more' },
      { id: 'e-value-close', from: 'value', to: 'close', weight: 'finish' },
      { id: 'e-comma-key', from: 'comma', to: 'key', weight: 'next key' },
    ],
  }, { title });
}

function* jsonSchema() {
  const automatonNodes = 7;
  const automatonEdges = 7;
  const grammarStates = 4;
  const vocabTokens = 4;
  const buildSteps = 4;
  const constraintDomains = 4;

  yield {
    state: automaton('A schema becomes a next-token state machine'),
    highlight: { active: ['start', 'e-start-open', 'open'], compare: ['key', 'colon', 'value', 'close'] },
    explanation: `A JSON schema can be compiled into a state machine with ${automatonNodes} nodes and ${automatonEdges} transitions. At the start of an object, "{" is legal and almost everything else is illegal. The model still ranks possible text; the decoder enforces which tokens keep the partial output parseable.`,
  };

  yield {
    state: labelMatrix(
      'At each state, invalid tokens are masked out',
      [
        { id: 's0', label: 'start' },
        { id: 's1', label: 'after {' },
        { id: 's2', label: 'after key' },
        { id: 's3', label: 'after value' },
      ],
      [
        { id: 'open', label: '{' },
        { id: 'city', label: '"city"' },
        { id: 'colon', label: ':' },
        { id: 'close', label: '}' },
      ],
      [
        ['allow', 'mask', 'mask', 'mask'],
        ['mask', 'allow', 'mask', 'mask'],
        ['mask', 'mask', 'allow', 'mask'],
        ['mask', 'mask', 'mask', 'allow'],
      ],
    ),
    highlight: { active: ['s0:open', 's1:city', 's2:colon', 's3:close'], removed: ['s0:city', 's1:close'] },
    explanation: `The decoder converts ${grammarStates} grammar states into a vocabulary mask over ${vocabTokens} candidate tokens. Illegal tokens get probability zero before sampling, then the legal probabilities are renormalized. Structure is guaranteed because invalid continuations never enter the sample set.`,
    invariant: `The model ranks legal continuations across ${vocabTokens} tokens; the constraint system defines legality through ${automatonNodes} automaton states.`,
  };

  yield {
    state: labelMatrix(
      'The JSON object is built one legal token at a time',
      [
        { id: 'step1', label: 'step 1' },
        { id: 'step2', label: 'step 2' },
        { id: 'step3', label: 'step 3' },
        { id: 'step4', label: 'step 4' },
      ],
      [
        { id: 'token', label: 'chosen token' },
        { id: 'state', label: 'new state' },
        { id: 'why', label: 'why valid' },
      ],
      [
        ['{', 'object opened', 'only legal start'],
        ['"city"', 'field selected', 'required property'],
        ['"Paris"', 'value accepted', 'string type'],
        ['}', 'object closed', 'required fields done'],
      ],
    ),
    highlight: { found: ['step1:token', 'step2:token', 'step3:token', 'step4:token'] },
    explanation: `The output is built across ${buildSteps} steps, never repaired after generation. It is never allowed to leave the grammar. That distinction matters for APIs: the caller can parse the result without a retry loop for malformed JSON.`,
  };

  yield {
    state: labelMatrix(
      'Where constraints help',
      [
        { id: 'tool', label: 'tool call' },
        { id: 'json', label: 'JSON API' },
        { id: 'sql', label: 'SQL subset' },
        { id: 'regex', label: 'regex field' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'risk', label: 'remaining risk' },
      ],
      [
        ['function signature', 'wrong argument value'],
        ['schema', 'unsupported claim'],
        ['grammar', 'semantic bug or injection'],
        ['regular language', 'format valid but meaningless'],
      ],
    ),
    highlight: { active: ['tool:constraint', 'json:constraint', 'sql:constraint'], compare: ['tool:risk', 'sql:risk'] },
    explanation: `Constrained decoding guarantees shape across ${constraintDomains} domains, not truth. It can make a tool call parseable, but it cannot prove the chosen city, price, SQL predicate, or citation is correct.`,
  };
}

function* grammarMask() {
  const engineTypes = 4;
  const automatonNodes = 7;
  const automatonEdges = 7;
  const decodePipelineSteps = 4;
  const tradeoffCount = 4;

  yield {
    state: labelMatrix(
      'Grammar engines avoid scanning the whole vocabulary naively',
      [
        { id: 'naive', label: 'naive mask' },
        { id: 'trie', label: 'vocab trie' },
        { id: 'fsm', label: 'finite-state mask' },
        { id: 'stack', label: 'CFG stack' },
      ],
      [
        { id: 'method', label: 'method' },
        { id: 'cost', label: 'cost pressure' },
      ],
      [
        ['test every token', 'expensive at large vocab'],
        ['share token prefixes', 'fast prefix pruning'],
        ['precompute transitions', 'cheap regex constraints'],
        ['track nested grammar', 'harder but expressive'],
      ],
    ),
    highlight: { active: ['trie:method', 'fsm:method', 'stack:method'], compare: ['naive:cost'] },
    explanation: `The core systems problem is not the idea of masking. Across ${engineTypes} engine types, it is making masks cheap enough that structure does not dominate decode time. Vocab tries, finite-state transitions, and grammar stacks sit directly in the generation hot path.`,
  };

  yield {
    state: automaton('A regex-like constraint is a small automaton'),
    highlight: { active: ['open', 'key', 'colon', 'e-open-key', 'e-key-colon'], found: ['value'] },
    explanation: `For regular constraints, the allowed-next-token set follows a finite-state transition across ${automatonNodes} nodes and ${automatonEdges} edges. This connects directly to Finite-State Machine and Trie (Prefix Tree): the decoder is walking an automaton over token strings.`,
  };

  yield {
    state: labelMatrix(
      'Mask then sample',
      [
        { id: 'model', label: 'model logits' },
        { id: 'mask', label: 'grammar mask' },
        { id: 'softmax', label: 'renormalize' },
        { id: 'sample', label: 'choose token' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'dependency', label: 'depends on' },
      ],
      [
        ['score every token', 'Transformer Block'],
        ['drop illegal tokens', 'current grammar state'],
        ['probabilities over legal set', 'Softmax & Temperature'],
        ['pick next token', 'sampling or Beam Search vs Greedy'],
      ],
    ),
    highlight: { found: ['model:job', 'mask:job', 'softmax:job', 'sample:job'] },
    explanation: `The order across ${decodePipelineSteps} pipeline steps is important: model logits, structural mask, renormalization, then sampling. If the legal set is empty, the system has a grammar or tokenization bug, not a model-quality problem.`,
  };

  yield {
    state: labelMatrix(
      'Engineering tradeoffs',
      [
        { id: 'latency', label: 'latency' },
        { id: 'tokenization', label: 'tokenization' },
        { id: 'stream', label: 'streaming' },
        { id: 'safety', label: 'safety' },
      ],
      [
        { id: 'challenge', label: 'challenge' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['mask computation can bottleneck', 'cache and precheck'],
        ['tokens split strings oddly', 'compile over token bytes'],
        ['partial output must remain valid prefix', 'prefix-closed states'],
        ['valid shape can still be unsafe', 'validate semantics too'],
      ],
    ),
    highlight: { active: ['latency:discipline', 'tokenization:discipline', 'safety:discipline'] },
    explanation: `Structured generation is a runtime feature with ${tradeoffCount} engineering tradeoffs, not just a prompting style. The constraint engine must be fast, tokenization-aware, stream-friendly, and paired with semantic validation.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'json schema') yield* jsonSchema();
  else if (view === 'grammar mask') yield* grammarMask();
  else throw new InputError('Pick a constrained decoding view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "json schema" view shows a state machine compiled from a JSON object schema. Each node is a grammar state (start, open brace, key, colon, value, close brace). Edges show which tokens are legal transitions. The mask matrix shows which tokens are allowed or masked at each state. The step-by-step table traces one JSON object being built token by token, with each row showing the chosen token, the new state, and why the token is valid.',
        {type: 'callout', text: 'Constrained decoding works by splitting generation into model scoring and grammar legality, then sampling only tokens that preserve a valid prefix.'},
        'The "grammar mask" view compares four engine strategies for computing token masks efficiently: naive scanning, vocabulary tries, finite-state transitions, and context-free grammar stacks. It then shows the same automaton from the first view and traces the decode pipeline: model logits, grammar mask, renormalization, and token selection.',
        'At each frame, ask what changed, why that token is legal given the current grammar state, and what would happen if an illegal token were allowed through.',
        {type: 'image', src: './assets/gifs/constrained-decoding.gif', alt: 'Animated walkthrough of the constrained decoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Constrained decoding exists because many language-model systems need output that software can parse on the first try. Tool calls need valid arguments. Extraction APIs need JSON objects with required fields. Agents need commands from a known action language. Database assistants may need a restricted SQL subset. A prompt that says "return valid JSON" is a request to the model. A constrained decoder is an enforcement mechanism in the generation loop.',
        'The idea is simple: the model still scores possible next tokens, but the decoder removes tokens that would make the partial output violate a schema, grammar, regular expression, or parser state. The remaining legal tokens are renormalized and sampled or selected. Instead of generating free text and hoping a repair prompt can fix broken structure later, the system prevents malformed structure from being emitted in the first place.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is prompt discipline plus retry. Tell the model the format, parse the answer, and if parsing fails, ask it to fix the output. This can work for demos, but it is weak infrastructure. It adds latency, creates retry storms under load, and still fails in edge cases. It also blurs responsibility: the model is being asked to remember syntax, obey instructions, solve the task, and repair its own mistakes, all at once.',
        'A second naive approach is post-processing. Generate unconstrained text, strip markdown fences, patch missing braces, fill missing fields, or run a best-effort parser. That can hide symptoms while introducing new errors. The repaired object may be syntactically valid but not what the model meant. Worse, repair logic can become a second fragile language interpreter. Constrained decoding moves the syntax rule to the only place where it can be guaranteed: before the next token is chosen.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that text generation is incremental and irrevocable. Once a token is emitted, the model conditions on it for all future tokens. A single bad token -- a missing quote, an extra comma, a wrong brace -- can make the rest of the output unparseable no matter what comes after. Retry-and-repair does not change this: it restarts the whole generation, burning latency and compute.',
        'Validation after the fact can reject a bad result, but it cannot prevent the model from wasting an entire forward pass on a structurally doomed output. The wall is that syntax errors are cheaper to prevent than to detect and retry. A structural constraint that runs at each decode step eliminates entire classes of malformed output without any model retraining.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate scoring from legality. The language model is good at ranking plausible continuations. The grammar engine is good at deciding which continuations preserve structure. Constrained decoding combines them by masking logits. Illegal tokens receive probability zero. Legal tokens keep their model scores and compete with each other. The result is still model-generated text, but it is generated inside a formal language boundary.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Finite_state_machine_example_with_comments.svg/250px-Finite_state_machine_example_with_comments.svg.png', alt: 'Annotated finite state machine with states, transitions, and transition conditions', caption: 'A finite-state machine makes the legality boundary visible: current state determines which transitions are allowed next. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Finite_state_machine_example_with_comments.svg.'},
        'This distinction matters because structure and meaning are different problems. A JSON schema can require a field named "city" and a string value. It cannot prove that the city exists, that it was extracted from the source, or that it is safe to pass into a tool. Constrained decoding guarantees shape. Semantic validation, authorization, grounding, and business rules still run after the object is produced.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A schema or grammar is compiled into a stateful acceptor. For a regular expression, that is a finite-state machine. For nested JSON or a context-free grammar, it is a parser state with a stack. At any point, the acceptor represents all valid ways the partial output can continue. The decoder asks the acceptor which token byte strings are legal next steps from the current state.',
        'The vocabulary makes this harder than it sounds. Models do not emit characters one by one. A token can contain a brace, a quote, a comma, a whole word, whitespace, or a partial string fragment. Efficient engines compile constraints over token byte strings using a vocabulary trie, precomputed transitions, cached parser states, and special handling for strings and escapes. At each step the runtime computes a mask, applies it to model logits, renormalizes with softmax, samples a token, and advances the parser state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Transformer%2C_attention_block_diagram.png/250px-Transformer%2C_attention_block_diagram.png', alt: 'Transformer attention block diagram with query key value mask softmax and output', caption: 'The model still produces token scores; constrained decoding adds a legality mask before sampling. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Transformer,_attention_block_diagram.png.'},
        'The schema view in the animation proves that a format can be treated as a state machine. At the beginning of an object, an opening brace is legal and a closing brace is not. After a required key, a colon is legal. After a value, a comma or closing brace is legal depending on required fields. The grammar-mask view proves that data structures sit in the generation hot path: a naive mask that scans every vocabulary token at each step can destroy latency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every invalid final string has a first token where it stopped being a valid prefix. If the decoder prevents that token, the final output cannot become invalid in that way. This is stronger than validation after the fact. Validation can reject a bad sample, but constrained decoding prevents the bad branch from entering the sample set.',
        'It also works because many output languages have compact state representations. Regular languages need finite-state machines. JSON schemas need parser states plus required-field bookkeeping. Context-free grammars track nested structure with stacks. The model does not need to learn these rules from a prompt. The decoder already knows them and enforces them mechanically.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is per-token latency. A naive mask checks every vocabulary token against the grammar at each decode step. With a vocabulary of 100,000 tokens and a 500-token output, that is 50 million grammar checks. Efficient implementations precompute transitions, share prefixes with tries, cache common parser states, and fuse mask computation with sampling. The constraint engine must be fast enough to sit beside optimized attention kernels without becoming the new bottleneck.',
        'The second cost is expressiveness versus usability. A narrow schema gives strong guarantees and fast masks, but it may force awkward outputs. A broad grammar gives the model more room but can be slower and harder to validate semantically. The third cost is failure behavior. If the legal set becomes empty at some decode step, the system has a grammar, tokenization, or state-management bug. If the model strongly prefers illegal continuations, output quality may degrade because the decoder must choose from weak legal alternatives.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Constrained decoding is used for tool calls, function arguments, API payloads, form extraction, browser automation commands, workflow agents, database filters, code-generation subsets, configuration files, and structured summaries. It is valuable wherever parse failures create operational cost. A tool-calling assistant can guarantee that the top-level object has the right function name and argument types. An extraction system can guarantee required keys and data types.',
        'It is also useful for streaming interfaces. If each partial output remains a valid prefix of the target language, clients can display or process data incrementally. The constraint engine must handle partial strings, escaped characters, arrays, and required fields correctly. In multi-beam decoding, each beam carries its own parser state. In speculative decoding, draft tokens must be checked against constraints before acceptance.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The biggest misconception is that constrained decoding makes an answer correct. It makes the answer structurally valid. A medical code can match a schema and still be the wrong code. A SQL query can match a grammar and still leak data. A tool call can have parseable arguments and still be unauthorized. Production systems should pair constrained decoding with semantic validation, permission checks, and domain-specific review.',
        'Tokenization is another common failure. A grammar written over characters has to be reconciled with tokens written over byte strings. Tokens may cross logical boundaries, include leading spaces, or represent fragments that are legal only inside strings. Unicode, escaping, and streaming partials add more edge cases. Constraints can also reduce diversity. If the schema is too rigid, the model may be forced into unnatural phrasing or low-probability values.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A schema requires {"city": <string>}. The vocabulary includes tokens: {, }, "city", "Paris", "London", :, ,, 42, true, \\n. The model generates one token at a time under the schema constraint.',
        'Step 1: grammar state is START. Legal tokens: { only. The model\\\'s top preference might be \\n or "city", but those are masked. The model samples {. State moves to OBJECT_OPEN.',
        'Step 2: state is OBJECT_OPEN. The schema requires key "city". Legal tokens: "city" only. The model samples "city". State moves to KEY_DONE.',
        'Step 3: state is KEY_DONE. Legal tokens: : only. The model samples :. State moves to COLON_DONE.',
        'Step 4: state is COLON_DONE, value type is string. Legal tokens: any string token ("Paris", "London", etc.). The model ranks "Paris" highest among legal tokens. It samples "Paris". State moves to VALUE_DONE.',
        'Step 5: state is VALUE_DONE, all required fields present. Legal tokens: } (and , if schema allowed more fields). The model samples }. Output: {"city":"Paris"}. The result is guaranteed valid JSON matching the schema. Whether Paris is the correct answer is a semantic question the grammar cannot answer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Willard and Louf, "Efficient Guided Generation for Large Language Models" (2023), describes the Outlines library and finite-state approaches to token masking. Dong et al., "XGrammar: Flexible and Efficient Structured Generation Engine" (2024), covers context-free grammar support and performance optimization for large vocabularies. The Guidance library (Microsoft) and llama.cpp grammars provide production-grade implementations.',
        'Study Finite-State Machine and Trie (Prefix Tree) for the data structures behind mask computation. Study Tokenization (BPE) to understand why character-level grammars and token-level vocabularies can conflict. Study Softmax and Temperature for how masking interacts with probability normalization. Study Beam Search vs Greedy for how constraints interact with search strategies.',
      ],
    },
  ],
};

