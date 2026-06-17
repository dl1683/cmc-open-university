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
      heading: 'Problem',
      paragraphs: [
        'Many LLM applications do not want free-form prose. They want JSON that parses, tool arguments that match a schema, enum choices from an allowed set, or a multi-step agent program where several branches share the same prompt history. A normal prompt can ask the model to follow the shape, but it does not make invalid tokens impossible.',
        'The serving system also has a performance problem. Application code often treats every branch, retry, and tool call as a new prompt string. The model server then sees many independent requests even when they share a long system prompt, a common conversation prefix, or a fixed output grammar. That loses both correctness and reuse opportunities.',
        'SGLang is interesting as a case study because it turns language-model programs into runtime state. Generation, selection, forked prompt streams, prefix reuse, and output constraints are represented explicitly, so the backend can schedule them, share KV cache, and enforce structured generation during decoding.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The simplest stack concatenates strings, calls the model, parses the answer, and retries if parsing fails. For tool calls, it may say "return valid JSON" and then run a JSON parser. For branching workflows, it may issue one request per branch even when each request repeats the same instruction block and conversation prefix.',
        'That approach is easy to ship because the application controls everything in ordinary code. But the cost appears after traffic grows. A failed parse is discovered only after the model has spent tokens. Retrying can double or triple latency. Repeated prefixes consume prefill compute and KV memory. Branches that could share state become unrelated calls from the scheduler perspective.',
        'Prompt-only structure also blurs responsibility. If the output is invalid, the product may blame the model, the prompt, the parser, or the retry logic. A constrained decoder gives the runtime a clearer contract: at each step, only tokens that keep the output inside the allowed language may be emitted.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is missing representation. The application knows that there is a program, a schema, a set of branches, and shared prompt ancestry. The backend often sees only strings and sampling parameters. Without richer state, it cannot know which requests share prefixes, which output positions are deterministic syntax, or which branches can be batched together safely.',
        'Naive constrained decoding also has a wall. If every step computes a token mask from a large grammar or JSON schema, the mask itself can become expensive. Many schema positions are not semantic choices. Braces, quotes, colons, commas, fixed field names, and enum delimiters are often forced. Spending a full model sampling step on each forced syntax token wastes time.',
        'The result is a bad tradeoff: unconstrained generation is fast but unreliable, while naive constrained generation is reliable but can add overhead. A practical runtime needs to enforce structure, share prefixes, and avoid paying decode cost for deterministic syntax when possible.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Compile both the program and the output constraint into serving-time data structures. Prompt prefixes become paths in a radix tree so shared ancestry can reuse KV cache. Forks become related prompt states rather than independent strings. JSON schemas, regexes, or other regular constraints become finite-state machines that define legal next tokens.',
        'Then compress deterministic FSM spans. If the current state has only one legal continuation for a sequence of syntax tokens, the runtime does not need to ask the model to choose each one. It can advance through that forced region and spend model work on semantic choices: field values, enum alternatives, tool names, and free-text slots.',
        'The invariant is simple and strong: every emitted token must keep the partial output inside the accepted language. The performance goal is also simple: never recompute a shared prefix or sample a forced token unless the implementation has a good reason.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The frontend program describes operations such as append text, generate tokens, select from choices, fork prompt state, and join results. Instead of flattening that program into unrelated prompt strings immediately, the runtime can keep prompt streams as first-class objects. That lets the scheduler see shared prefixes and related branches.',
        'RadixAttention stores KV-cache ancestry in a radix-tree-like structure keyed by token prefixes. If two requests share a prefix, the backend can reuse the KV computation for that prefix instead of prefilling it again. Forked programs benefit because each branch starts from the same prompt state and diverges only near the branch point.',
        'For structured output, the runtime compiles the allowed language into an automaton. The automaton state represents which prefixes remain valid. At each decode step, the runtime builds or looks up a mask of tokens that keep the automaton on an accepting path. Illegal tokens receive zero probability or are excluded before sampling.',
        'Compressed FSM decoding adds another optimization. When the automaton has a deterministic run, such as fixed punctuation or a field name that must appear exactly, the runtime can advance across that run without treating each token as an open model decision. The exact mechanics depend on tokenizer boundaries and implementation details, but the principle is to separate forced syntax from semantic choice.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Think of the runtime as maintaining two coupled states: prompt state and constraint state. Prompt state says what tokens are already in the context and which KV cache entries can be reused. Constraint state says what output prefixes are still legal. The scheduler must batch work across requests while respecting both states.',
        'For a JSON tool call, the schema may require an object with fields like tool, location, date, and units. The automaton accepts only strings that match that shape. When decoding begins, a left brace may be forced. A quote may be forced. The field name "tool" may be forced. The value of the tool field may be a real choice. The runtime masks tokens at each choice point so the model cannot produce syntactically invalid JSON.',
        'For a branching agent program, several candidate branches may share the same system prompt and conversation prefix. The radix cache stores that common prefix once. Each branch then appends different instructions or generated tokens. The scheduler can batch decode steps where possible while avoiding duplicate prefill work.',
        'The output still needs semantic validation after decoding. The FSM can prove shape, not truth. A tool call can be valid JSON and still request a forbidden tool, contain a location the product does not support, or fail a business rule. Structured generation is the first gate, not the whole policy system.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument for the constraint comes from automata. If the current FSM state represents all valid continuations after the emitted prefix, and the runtime only allows tokens that lead to valid next states, then the final accepted output is guaranteed to satisfy the regular constraint encoded by the automaton.',
        'Compression is safe when it only skips model decisions that are not decisions. If there is exactly one legal token sequence through a deterministic span, emitting that span cannot change which semantic alternatives the model would have selected at a later branch. The runtime must still respect tokenizer boundaries and stop at points where multiple legal continuations appear.',
        'The reuse argument comes from transformer prefix computation. For identical token prefixes, the KV cache produced by prefill is identical for a given model and decoding configuration. A radix structure can share that prefix among requests and branches. This reduces time to first token and saves memory bandwidth when the workload has repeated or forked prefixes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an application asks the model to return a weather tool call with schema { "tool": "weather", "args": { "city": string, "units": "C" or "F" } }. A prompt-only stack asks for JSON, decodes whatever text appears, then parses. The constrained runtime compiles the schema into an FSM before decoding.',
        'At the start, the left brace and part of the fixed field structure may be forced. The runtime advances through forced syntax, then reaches the city value. At that point many tokens are legal because the model must choose a city string. After the city closes, punctuation and the units field name may again be forced. At the units value, only tokens compatible with "C" or "F" remain legal.',
        'Now add branching. The program tries three candidate phrasings before the tool call, but all branches share the same system prompt, user message, and schema. RadixAttention can reuse the shared prefix and store branch-specific tails separately. The compressed FSM reduces wasted decode work in each branch, and the scheduler can reason about all branches as related runtime work instead of unrelated API calls.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The "program runtime" view shows the whole serving path: program, prompt stream, fork, generation, selection, radix cache, FSM constraint, scheduler, and valid output. The important lesson is that application structure should not vanish when a request reaches the model server.',
        'The "compressed fsm" view focuses on the constraint path. Schema becomes NFA or grammar-like state, state becomes DFA-style legal-token tracking, deterministic runs are folded, and decoding alternates between forced syntax and real choices. This is the difference between asking for valid JSON and making invalid syntax unreachable.',
        'The throughput curve shows why the optimization is workload-dependent. A plain engine may be fine for one unconstrained prompt. The structured runtime pays off when there is prefix reuse, branching, deterministic schema syntax, or a high cost for invalid outputs and retries.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The runtime pays compile time for constraints, memory for automaton state, bookkeeping for radix cache entries, and scheduler complexity for related prompt streams. Some schemas generate many states or expensive token masks. Some tokenizers make apparently simple literals span awkward token boundaries.',
        'Constraints can also change model behavior. If the allowed language is too narrow, the model may be forced into outputs that parse but lose nuance. If the schema is huge, dynamic, or user-defined, compiling and caching constraints may dominate request time. If traffic has little prefix sharing, RadixAttention provides less benefit.',
        'Good production telemetry should record schema id, FSM state count, deterministic-token ratio, mask-build cost, cache-hit ratio, prefill tokens saved, time to first token, p50 and p99 latency, output validity, semantic rejection counts, fallback reason, and memory pressure. Without these measurements, a team cannot tell whether structured decoding is helping or only moving cost around.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern wins for JSON tool calls, form filling, enum-heavy classification, extraction into fixed schemas, agent workflows with shared system prompts, multi-branch reasoning programs, and products where invalid output is expensive. It is strongest when prompts share long prefixes and the output format has many deterministic spans.',
        'It also wins when the serving platform owns both the programming abstraction and the backend runtime. If the frontend can expose fork, generation, selection, and schema information directly, the scheduler can optimize across semantic program operations instead of reverse-engineering intent from strings.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compressed FSM decoding is the wrong tool for unconstrained creative text where shape does not matter. It can be a poor fit for recursive or context-sensitive constraints that do not fit the chosen automaton model, very large dynamic schemas, traffic with no repeated prefixes, or tasks where the grammar is easy but the meaning is hard.',
        'It also fails if teams confuse syntactic validity with product correctness. A valid JSON object can call the wrong tool, omit required business context, pass a policy check incorrectly, or contain a value that looks well-formed but is false. The runtime should be paired with semantic validators, permission checks, tool sandboxes, and audit logs.',
        'Finally, it can fail operationally if cache reuse becomes stale or unsafe across model versions, tokenizer versions, adapters, or decoding settings. Prefix KV state is reusable only when all relevant model and request parameters match.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Implementation bugs include incorrect token masks, accepting an invalid transition after a tokenizer split, skipping a deterministic span that was not actually unique, failing to reset FSM state between branches, caching a schema under the wrong version, or sharing KV cache across incompatible model state.',
        'Runtime failures include automaton explosion, p99 latency spikes under fanout, memory pressure from many cached prefixes, branch starvation in the scheduler, fallback loops after semantic rejection, and observability gaps where invalid output disappears into retry logic. A robust route has an explicit fallback: simplify the schema, disable compression, use parse-and-repair, or send the request to a slower but safer path.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references are the SGLang paper, the SGLang documentation and project repository, and the LMSYS discussion of RadixAttention. Study them with two questions: what information does the frontend expose to the runtime, and which runtime states can be reused or constrained safely?',
        'Inside this curriculum, study Prefix Caching and RadixAttention for shared-prefix reuse, Finite State Machine for the constraint foundation, Subset Construction NFA to DFA for automaton compilation, Constrained Decoding for token masks, LLM Continuous Batching for scheduler pressure, LLM Serving PagedAttention for KV memory layout, Speculative Decoding Runtime Controller for another serving-time optimization, and LLM Inference Cost Stack for production economics.',
      ],
    },
  ],
};
