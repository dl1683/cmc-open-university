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
  yield {
    state: automaton('A schema becomes a next-token state machine'),
    highlight: { active: ['start', 'e-start-open', 'open'], compare: ['key', 'colon', 'value', 'close'] },
    explanation: 'A JSON schema can be compiled into a state machine. At the start of an object, "{" is legal and almost everything else is illegal. The model still supplies probabilities, but the decoder filters them through the structural state.',
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
    explanation: 'The decoder converts grammar state into a vocabulary mask. Illegal tokens get probability zero before sampling. This is why constrained decoding can guarantee structure while still letting the model choose among legal values.',
    invariant: 'The model ranks legal continuations; the constraint system defines legality.',
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
    explanation: 'The output is not repaired after generation. It is never allowed to leave the grammar. That distinction matters for APIs: the caller can parse the result without a retry loop for malformed JSON.',
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
    explanation: 'Constrained decoding guarantees shape, not truth. It can make a tool call parseable, but it cannot prove the chosen city, price, SQL predicate, or citation is correct.',
  };
}

function* grammarMask() {
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
    explanation: 'The core systems problem is not the idea of masking. It is building masks cheaply enough that structure does not dominate decode time. Vocab tries, finite-state transitions, and grammar stacks are data structures in the hot path.',
  };

  yield {
    state: automaton('A regex-like constraint is a small automaton'),
    highlight: { active: ['open', 'key', 'colon', 'e-open-key', 'e-key-colon'], found: ['value'] },
    explanation: 'For regular constraints, the allowed-next-token set follows a finite-state transition. This connects directly to Finite-State Machine and Trie (Prefix Tree): the decoder is walking an automaton over token strings.',
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
    explanation: 'The order is important: model logits, structural mask, renormalization, then sampling. If the legal set is empty, the system has a grammar or tokenization bug, not a model-quality problem.',
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
    explanation: 'Structured generation is a runtime feature, not just a prompting style. The constraint engine must be fast, tokenization-aware, stream-friendly, and paired with semantic validation.',
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
      heading: 'What it is',
      paragraphs: [
        'Constrained decoding makes a language model generate only tokens that keep the output inside a required language: JSON, a regular expression, a context-free grammar, a function-call schema, or a narrow command format. The model still scores likely next tokens, but the decoder masks out tokens that would violate the current structural state. After masking, probabilities are renormalized over the legal set.',
        'The practical motivation is simple. Prompting a model to "return valid JSON" is a request. Constrained decoding is an enforcement mechanism. It prevents malformed braces, wrong separators, missing required fields, and grammar-invalid command strings before they appear. That is why it is central to tool calling, agent commands, extraction APIs, and structured data generation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A schema or grammar is compiled into a stateful acceptor. For regular languages this can be a Finite-State Machine. For nested JSON-like structures it may use a stack or parser state. The vocabulary is indexed so the engine can ask which tokens keep the partial byte string valid. A Trie (Prefix Tree) is useful because tokens share prefixes and a token may contain several characters at once.',
        'At each decode step, the model produces logits over the vocabulary. The grammar engine computes a legal-token mask from the current parser state. Illegal logits are suppressed, Softmax & Temperature is applied to the remaining logits, and the decoder samples or chooses the next token. Beam Search vs Greedy can also run inside the same constraint, as long as each beam carries its own grammar state.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The hard part is speed. A naive implementation that tests every vocabulary token against the grammar at every step can erase the serving win from optimized inference. Efficient systems precompute transitions, build vocabulary indexes, separate context-independent from context-dependent token checks, and cache parser states. The constraint logic must also be tokenization-aware: a single token can contain quotes, braces, whitespace, or parts of words.',
        'Constrained decoding also changes failure modes. A valid JSON object can still contain a false claim, a dangerous SQL predicate, or a wrong tool argument. The structure guarantee should be paired with semantic validation, authorization checks, and source grounding when the output affects real systems.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Structured generation is used for tool calls, function arguments, API payloads, extraction tasks, code-generation subsets, workflow commands, browser automation, database filters, and agent action plans. It is especially valuable in production systems that need parseable output on the first try. Retries and repair prompts are slower, less reliable, and harder to reason about than preventing invalid tokens in the decoding loop.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that constrained decoding makes output correct. It makes output structurally valid. A medical code can match a schema and still be the wrong code. A SQL query can match a grammar and still leak data. Another trap is ignoring tokenization. Grammars written over characters must be reconciled with model vocabularies written over token byte strings. Performance bugs often live at that boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Efficient Guided Generation for Large Language Models at https://arxiv.org/abs/2307.09702, XGrammar at https://arxiv.org/abs/2411.15100, and the XGrammar project page at https://catalyst.cs.cmu.edu/projects/xgrammar.html. Study JSON Schema Constrained Decoding Token Mask for the production schema-compile, required-field, token-mask, and validation ledger. Then study Finite-State Machine, Trie (Prefix Tree), Tokenization (BPE), Softmax & Temperature, Beam Search vs Greedy, and Speculative Decoding next.',
      ],
    },
  ],
};
