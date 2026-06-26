// SGLang structured-generation runtime: compile output constraints into a
// compressed FSM and combine it with prefix-cache-aware execution.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sglang-compressed-fsm-runtime-case-study',
  title: 'SGLang Compressed FSM Runtime Case Study',
  category: 'Systems',
  summary: 'A structured-generation runtime case study: SGLang programs, fork/join prompt streams, RadixAttention reuse, compressed FSM decoding, and JSON/tool-call serving gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['program runtime', 'compressed fsm'], defaultValue: 'program runtime' },
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

function runtimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'prog', label: 'prog', x: 0.7, y: 3.5, note: 'Python DSL' },
      { id: 'stream', label: 'stream', x: 2.2, y: 3.5, note: 'state' },
      { id: 'fork', label: 'fork', x: 3.8, y: 2.0, note: 'parallel' },
      { id: 'gen', label: 'gen', x: 3.8, y: 3.5, note: 'tokens' },
      { id: 'select', label: 'select', x: 3.8, y: 5.0, note: 'choice' },
      { id: 'radix', label: 'radix', x: 5.7, y: 2.0, note: 'KV hit' },
      { id: 'fsm', label: 'FSM', x: 5.7, y: 5.0, note: 'schema' },
      { id: 'sched', label: 'sched', x: 7.4, y: 3.5, note: 'batch' },
      { id: 'out', label: 'out', x: 9.0, y: 3.5, note: 'valid' },
    ],
    edges: [
      { id: 'e-prog-stream', from: 'prog', to: 'stream' },
      { id: 'e-stream-fork', from: 'stream', to: 'fork' },
      { id: 'e-stream-gen', from: 'stream', to: 'gen' },
      { id: 'e-stream-select', from: 'stream', to: 'select' },
      { id: 'e-fork-radix', from: 'fork', to: 'radix' },
      { id: 'e-gen-radix', from: 'gen', to: 'radix' },
      { id: 'e-gen-fsm', from: 'gen', to: 'fsm' },
      { id: 'e-select-fsm', from: 'select', to: 'fsm' },
      { id: 'e-radix-sched', from: 'radix', to: 'sched' },
      { id: 'e-fsm-sched', from: 'fsm', to: 'sched' },
      { id: 'e-sched-out', from: 'sched', to: 'out' },
    ],
  }, { title });
}

function fsmGraph(title) {
  return graphState({
    nodes: [
      { id: 'schema', label: 'schema', x: 0.7, y: 3.5, note: 'JSON/regex' },
      { id: 'nfa', label: 'NFA', x: 2.1, y: 3.5, note: 'rules' },
      { id: 'dfa', label: 'DFA', x: 3.5, y: 3.5, note: 'states' },
      { id: 'compress', label: 'fold', x: 5.0, y: 3.5, note: 'runs' },
      { id: 'mask', label: 'mask', x: 6.5, y: 2.2, note: 'branch' },
      { id: 'skip', label: 'skip', x: 6.5, y: 4.8, note: 'single path' },
      { id: 'decode', label: 'decode', x: 8.2, y: 3.5, note: 'step' },
      { id: 'json', label: 'JSON', x: 9.4, y: 3.5, note: 'valid' },
    ],
    edges: [
      { id: 'e-schema-nfa', from: 'schema', to: 'nfa' },
      { id: 'e-nfa-dfa', from: 'nfa', to: 'dfa' },
      { id: 'e-dfa-compress', from: 'dfa', to: 'compress' },
      { id: 'e-compress-mask', from: 'compress', to: 'mask' },
      { id: 'e-compress-skip', from: 'compress', to: 'skip' },
      { id: 'e-mask-decode', from: 'mask', to: 'decode' },
      { id: 'e-skip-decode', from: 'skip', to: 'decode' },
      { id: 'e-decode-json', from: 'decode', to: 'json' },
    ],
  }, { title });
}

function* programRuntime() {
  yield {
    state: runtimeGraph('Language program becomes runtime work'),
    highlight: { active: ['prog', 'stream', 'fork', 'gen', 'select', 'e-prog-stream'], found: ['sched'] },
    explanation: 'SGLang is useful to teach because it joins a programming model to a serving runtime. The program stream records generation calls, branches, selections, media inputs, and synchronization points instead of hiding them inside string concatenation.',
  };

  yield {
    state: labelMatrix(
      'Runtime records',
      [
        { id: 'stream', label: 'stream' },
        { id: 'fork', label: 'fork' },
        { id: 'radix', label: 'radix' },
        { id: 'fsm', label: 'FSM' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['prompt', 'order', 'sync'],
        ['copies', 'parallel', 'fanout'],
        ['KV', 'reuse', 'evict'],
        ['states', 'valid', 'blowup'],
        ['reqs', 'util', 'p99'],
      ],
    ),
    highlight: { active: ['radix:why', 'fsm:why', 'batch:why'], compare: ['stream:risk', 'fsm:risk'] },
    explanation: 'The important data structures are explicit: prompt streams, forked states, KV-prefix radix nodes, compressed FSM states, and batch-scheduler queues. Each gives a different optimization handle.',
  };

  yield {
    state: runtimeGraph('Cache reuse and constraints meet in the scheduler'),
    highlight: { active: ['radix', 'fsm', 'sched', 'e-radix-sched', 'e-fsm-sched'], found: ['out'] },
    explanation: 'A production runtime has to schedule both cache reuse and constrained decoding. A request can be cheap because its prefix hits RadixAttention, slow because its schema branches heavily, or both.',
    invariant: 'Structured generation is a runtime problem, not only a prompt-format problem.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'shared prefix percent', min: 0, max: 100 }, y: { label: 'relative throughput', min: 0, max: 8 } },
      series: [
        { id: 'base', label: 'plain engine', points: [{ x: 0, y: 1 }, { x: 25, y: 1 }, { x: 50, y: 1.05 }, { x: 75, y: 1.05 }, { x: 100, y: 1.1 }] },
        { id: 'sgl', label: 'SGLang-style', points: [{ x: 0, y: 1.1 }, { x: 25, y: 1.8 }, { x: 50, y: 3.0 }, { x: 75, y: 4.5 }, { x: 100, y: 6.4 }] },
      ],
      markers: [
        { id: 'reuse', x: 75, y: 4.5, label: 'reuse' },
      ],
    }),
    highlight: { active: ['sgl', 'reuse'], compare: ['base'] },
    explanation: 'This is a conceptual chart anchored to the SGLang paper result that structured workloads can see large throughput gains. The mechanism is not magic; it is prefix reuse, compressed constraints, and program-aware scheduling.',
  };
}

function* compressedFsm() {
  yield {
    state: fsmGraph('Constraints compile into state machines'),
    highlight: { active: ['schema', 'nfa', 'dfa', 'compress', 'e-schema-nfa', 'e-nfa-dfa', 'e-dfa-compress'], found: ['json'] },
    explanation: 'A JSON schema or regex can be lowered into a finite-state machine. Ordinary constrained decoding masks illegal next tokens. SGLang adds a compressed representation for long deterministic paths.',
  };

  yield {
    state: labelMatrix(
      'FSM decode choices',
      [
        { id: 'branch', label: 'branch' },
        { id: 'literal', label: 'literal' },
        { id: 'field', label: 'field' },
        { id: 'close', label: 'close' },
      ],
      [
        { id: 'next', label: 'next' },
        { id: 'action', label: 'action' },
      ],
      [
        ['many', 'mask'],
        ['one', 'skip'],
        ['model', 'sample'],
        ['one', 'emit'],
      ],
    ),
    highlight: { active: ['literal:action', 'close:action'], compare: ['branch:action', 'field:action'] },
    explanation: 'Not every output token needs a model decision. In a strict schema, punctuation, quotes, and fixed field names may be deterministic. The compressed FSM can emit or skip those runs while masking true branches.',
  };

  yield {
    state: fsmGraph('Compressed paths reduce decode steps'),
    highlight: { active: ['compress', 'skip', 'decode', 'e-compress-skip', 'e-skip-decode'], compare: ['mask'], found: ['json'] },
    explanation: 'The compressed path is the educational crux: if a state has a single legal continuation for several tokens, the runtime can collapse that span rather than forcing one model step per syntactic token.',
  };

  yield {
    state: labelMatrix(
      'Tool-call case',
      [
        { id: 'schema', label: 'schema' },
        { id: 'args', label: 'args' },
        { id: 'fsm', label: 'FSM' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['JSON', 'compile'],
        ['slots', 'sample'],
        ['states', 'valid'],
        ['SLO', 'p99'],
      ],
    ),
    highlight: { active: ['schema:gate', 'fsm:gate', 'route:gate'], found: ['args:artifact'] },
    explanation: 'For an agent tool call, the runtime should compile the schema, identify deterministic spans, sample only semantic fields, and record p99 overhead. Valid JSON is a correctness gate; latency is a production gate.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'program runtime') yield* programRuntime();
  else if (view === 'compressed fsm') yield* compressedFsm();
  else throw new InputError('Pick an SGLang runtime view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a serving-runtime trace. A finite state machine, or FSM, is a graph of allowed output states; a token is the unit the model emits; KV cache is saved transformer attention state for a prompt prefix. Active nodes show whether program state, prefix-cache state, constraint state, or scheduler state controls the next step. The safe rule is that a token may be sampled only if it keeps the partial output inside the FSM language.',
        {type:'callout', text:'Structured generation becomes reliable and fast when program state, prefix cache state, and FSM constraint state reach the scheduler together.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9d/DFAexample.svg', alt:'Deterministic finite automaton state diagram with labeled transitions.', caption:'DFA example state diagram, by Cepheus, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many LLM applications need JSON, tool arguments, enum choices, extraction records, or branches that share the same prompt history. A prompt can request that shape, but it cannot make invalid syntax unreachable. The serving system also wastes work when every branch repeats the same long prefix as a separate request.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is prompt, parse, and retry. The application asks for valid JSON, runs a parser, and sends a repair prompt when parsing fails. Branching is handled by issuing one request per branch, which is simple but hides shared ancestry from the backend.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is missing representation. The application knows there is a program, a schema, and shared prompt state, while the backend often sees only strings and sampling parameters. Naive constrained decoding can also spend real time rebuilding token masks for syntax tokens that were never semantic choices.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compile application structure into serving-time data structures. Shared prompt prefixes become paths in a radix tree, and output schemas become FSM state for legal-token masks. Deterministic FSM spans can be compressed so the runtime spends model work on field values and choices instead of fixed braces, commas, and field names.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The frontend exposes operations such as append text, fork state, generate tokens, choose among options, and join results. The backend keeps prompt state as first-class runtime state, so related branches can share prefill and batch decode work. For structured output, the current automaton state defines the legal next tokens, and illegal tokens are masked before sampling.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'The constraint proof is induction over emitted tokens. The empty output starts in the automaton start state, and every sampled token follows a legal transition, so every prefix remains valid. Compression is safe only across spans with exactly one legal continuation, and prefix reuse is safe only when model, tokenizer, adapter, and decoding settings match.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime pays compile time for schemas, memory for FSM state, radix-cache bookkeeping, and scheduler complexity. If three branches share 8,000 prompt tokens, naive serving may prefill 24,000 shared tokens, while prefix reuse can prefill 8,000 once and pay only for branch tails. If traffic has little prefix sharing or schemas explode to thousands of states, the overhead can outweigh the win.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits JSON tool calls, extraction into fixed records, enum-heavy classification, agent workflows with shared prompts, and products where invalid output causes expensive retries. It is strongest when prompts share long prefixes and the output format contains many deterministic syntax spans.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compressed FSM decoding is a poor fit for unconstrained creative writing, very large dynamic schemas, recursive constraints outside the chosen automaton model, and traffic with little prefix sharing. It also fails as a safety system if teams confuse valid JSON with correct action. A valid tool call can still choose the wrong tool, violate policy, or pass a false value.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A weather tool schema requires tool = weather, city as a string, and units = C or F. The runtime forces the opening object syntax and field names, stops at city because many city tokens are legal, then forces syntax again until units. With three branches sharing a 6,000-token prompt, prefix reuse saves about 12,000 repeated prefill tokens compared with three independent 6,000-token requests.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the SGLang paper and documentation, LMSYS material on RadixAttention, and standard automata references for deterministic finite automata and token masking. Study finite state machines, subset construction, constrained decoding, prefix caching, continuous batching, PagedAttention, speculative decoding, and the LLM inference cost stack.',
      ],
    },
  ],
};