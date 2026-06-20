// Sequence-memory evaluation ledger: compare exact attention, KV variants,
// linear state, SSMs, fast weights, and neural memory with task and serving slices.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sequence-memory-evaluation-ledger-case-study',
  title: 'Sequence Memory Evaluation Ledger Case Study',
  category: 'AI & ML',
  summary: 'An evaluation playbook for long-context memory forms: recall slices, overwrite tests, RULER-style tasks, p99 serving metrics, state bytes, and rollout gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['recall slices', 'serving gate'], defaultValue: 'recall slices' },
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

function evalGraph(title) {
  return graphState({
    nodes: [
      { id: 'arch', label: 'arch', x: 0.7, y: 3.5, note: 'memory form' },
      { id: 'tasks', label: 'tasks', x: 2.2, y: 2.1, note: 'RULER' },
      { id: 'pos', label: 'position', x: 2.2, y: 3.5, note: 'middle' },
      { id: 'mut', label: 'overwrite', x: 2.2, y: 4.9, note: 'delta' },
      { id: 'serve', label: 'serving', x: 4.3, y: 2.1, note: 'p99' },
      { id: 'state', label: 'state bytes', x: 4.3, y: 4.9, note: 'memory' },
      { id: 'ledger', label: 'ledger', x: 6.4, y: 3.5, note: 'slices' },
      { id: 'gate', label: 'gate', x: 8.4, y: 3.5, note: 'ship?' },
    ],
    edges: [
      { id: 'e-arch-tasks', from: 'arch', to: 'tasks' },
      { id: 'e-arch-pos', from: 'arch', to: 'pos' },
      { id: 'e-arch-mut', from: 'arch', to: 'mut' },
      { id: 'e-arch-serve', from: 'arch', to: 'serve' },
      { id: 'e-arch-state', from: 'arch', to: 'state' },
      { id: 'e-tasks-ledger', from: 'tasks', to: 'ledger' },
      { id: 'e-pos-ledger', from: 'pos', to: 'ledger' },
      { id: 'e-mut-ledger', from: 'mut', to: 'ledger' },
      { id: 'e-serve-ledger', from: 'serve', to: 'ledger' },
      { id: 'e-state-ledger', from: 'state', to: 'ledger' },
      { id: 'e-ledger-gate', from: 'ledger', to: 'gate' },
    ],
  }, { title });
}

function* recallSlices() {
  yield {
    state: evalGraph('Long-context memory must pass slice tests'),
    highlight: { active: ['arch', 'tasks', 'pos', 'mut', 'ledger', 'e-arch-tasks', 'e-arch-pos', 'e-arch-mut'], found: ['gate'] },
    explanation: 'A sequence-memory architecture is not proven by a context-length number. The ledger must test retrieval, position sensitivity, overwrites, multi-hop tracing, and aggregation.',
    invariant: 'Context length is capacity advertised; slice scores are capacity used.',
  };

  yield {
    state: labelMatrix(
      'Recall slices',
      [
        { id: 'needle', label: 'needle' },
        { id: 'multi', label: 'multi' },
        { id: 'middle', label: 'middle' },
        { id: 'overwrite', label: 'fresh' },
        { id: 'agg', label: 'agg' },
      ],
      [
        { id: 'tests', label: 'tests' },
        { id: 'catches', label: 'catches' },
        { id: 'next', label: 'next' },
      ],
      [
        ['find', 'lookup', 'easy'],
        ['2facts', 'bind', 'hard'],
        ['mid', 'lost', 'must'],
        ['new', 'stale', 'must'],
        ['sum', 'state', 'must'],
      ],
    ),
    highlight: { active: ['middle:catches', 'overwrite:catches', 'agg:catches'], compare: ['needle:next'] },
    explanation: 'Vanilla needle-in-haystack can be too shallow. RULER-style suites add multiple needles, multi-hop tracing, aggregation, and length scaling to expose brittle memory.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'relative position of evidence', min: 0, max: 100 }, y: { label: 'accuracy, conceptual percent', min: 0, max: 100 } },
      series: [
        { id: 'edge', label: 'edge-biased model', points: [{ x: 0, y: 88 }, { x: 20, y: 70 }, { x: 50, y: 46 }, { x: 80, y: 70 }, { x: 100, y: 89 }] },
        { id: 'flat', label: 'robust target', points: [{ x: 0, y: 86 }, { x: 20, y: 84 }, { x: 50, y: 82 }, { x: 80, y: 84 }, { x: 100, y: 86 }] },
      ],
      markers: [
        { id: 'mid', x: 50, y: 46, label: 'middle dip' },
      ],
    }),
    highlight: { active: ['edge', 'mid'], compare: ['flat'] },
    explanation: 'Lost-in-the-middle behavior is a required slice for any long-context claim. If relevant evidence in the middle disappears, a larger context window is not enough.',
  };

  yield {
    state: labelMatrix(
      'Architecture-specific probes',
      [
        { id: 'kv', label: 'KV' },
        { id: 'lin', label: 'linear' },
        { id: 'ssm', label: 'SSM' },
        { id: 'delta', label: 'delta' },
        { id: 'neural', label: 'neural' },
      ],
      [
        { id: 'probe', label: 'probe' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['exact', 'cache'],
        ['collide', 'blur'],
        ['carry', 'forget'],
        ['update', 'noise'],
        ['surprise', 'drift'],
      ],
    ),
    highlight: { active: ['lin:probe', 'ssm:probe', 'delta:probe', 'neural:probe'], compare: ['kv:risk'] },
    explanation: 'Different memory forms need different stress tests. A delta-rule model needs overwrite tasks; an SSM needs long carry tasks; a neural-memory model needs surprise and drift probes.',
  };
}

function* servingGate() {
  yield {
    state: evalGraph('Serving metrics sit beside quality metrics'),
    highlight: { active: ['serve', 'state', 'ledger', 'gate', 'e-serve-ledger', 'e-state-ledger', 'e-ledger-gate'], compare: ['tasks'] },
    explanation: 'Efficient sequence memory is a serving claim as much as a modeling claim. The same ledger should record p50, p95, p99, state bytes, kernel route, and fallback rate.',
  };

  yield {
    state: labelMatrix(
      'Serving gate fields',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'ttft', label: 'TTFT' },
        { id: 'tpot', label: 'TPOT' },
        { id: 'p99', label: 'p99' },
        { id: 'fallback', label: 'fallback' },
        { id: 'quality', label: 'quality' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['state', 'cap'],
        ['pre', 'SLO'],
        ['decode', 'SLO'],
        ['tail', 'must'],
        ['slow', 'alert'],
        ['slice', 'must'],
      ],
    ),
    highlight: { active: ['bytes:gate', 'p99:gate', 'fallback:gate', 'quality:gate'], found: ['tpot:measure'] },
    explanation: 'A memory-efficient layer can still fail production if it falls off the optimized kernel, creates a p99 tail, or silently routes to a full-attention fallback.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 128000 }, y: { label: 'ship score, conceptual', min: 0, max: 1 } },
      series: [
        { id: 'quality', label: 'quality', points: [{ x: 8000, y: 0.92 }, { x: 32000, y: 0.84 }, { x: 64000, y: 0.70 }, { x: 128000, y: 0.51 }] },
        { id: 'cost', label: 'cost fitness', points: [{ x: 8000, y: 0.55 }, { x: 32000, y: 0.72 }, { x: 64000, y: 0.83 }, { x: 128000, y: 0.91 }] },
      ],
      markers: [
        { id: 'knee', x: 48000, y: 0.76, label: 'knee' },
      ],
    }),
    highlight: { active: ['quality', 'cost', 'knee'] },
    explanation: 'The decision is a frontier, not a single score. A compressed memory model may become more attractive as context grows, but only until quality drops below the product floor.',
  };

  yield {
    state: labelMatrix(
      'Rollout packet',
      [
        { id: 'base', label: 'base' },
        { id: 'cand', label: 'cand' },
        { id: 'slice', label: 'slice' },
        { id: 'serve', label: 'serve' },
        { id: 'canary', label: 'canary' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'decision', label: 'gate' },
      ],
      [
        ['attn', 'ref'],
        ['cand', 'test'],
        ['RULER', 'pass'],
        ['p99', 'pass'],
        ['canary', 'ramp'],
      ],
    ),
    highlight: { active: ['base:artifact', 'cand:artifact', 'slice:decision', 'serve:decision', 'canary:decision'] },
    explanation: 'A complete adoption packet compares the candidate against a full-attention baseline, records slice scores, records serving metrics, and canaries real traffic before claiming victory.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'recall slices') yield* recallSlices();
  else if (view === 'serving gate') yield* servingGate();
  else throw new InputError('Pick a sequence-memory evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'Why Sequence Memory Needs a Ledger',
      paragraphs: [
        "Long-context memory claims are easy to inflate because the advertised capacity is simple and the actual behavior is not. A model can accept 128K tokens, pass a simple needle-in-haystack demo, and still fail when the important fact appears in the middle, must be combined with another fact, is overwritten later, or sits inside code with local dependencies. A serving stack can also look efficient in a notebook and then miss a production p99 latency target.",
        "A sequence-memory evaluation ledger exists to separate those cases. It is a structured record of what kind of memory was tested, where the evidence was placed, what task demanded it, how the architecture stored or compressed state, and what happened under realistic serving conditions. The ledger turns a vague claim like 'long context works' into rows that can be inspected and repeated.",
        {type:"callout", text:"A sequence-memory ledger makes long context measurable by preserving the shape of failures instead of averaging them away."},
        "This matters because sequence memory is no longer one mechanism. Full attention, grouped or paged KV cache, sliding windows, retrieval, linear attention, state-space models, delta-rule memory, fast weights, xLSTM-style recurrence, and test-time neural memory all preserve different information in different ways. A single average score cannot tell a team which one is failing or why.",
      ],
    },
    {
      heading: 'The Naive Benchmark Plan',
      paragraphs: [
        "The obvious plan is to report maximum context length and one aggregate long-context score. That is easy to market and easy to compare in a table. It is also too shallow. Context length tells you how many tokens the system will accept, not how much useful information it can recover from those tokens.",
        "A second shallow plan is to compare architecture labels. Full attention is exact, linear attention is efficient, state-space models carry a recurrent state, neural memory writes into learned storage, and retrieval adds external documents. These labels are useful, but they are not results. A weak full-attention implementation can fail due to prompting or serving limits. A compressed memory model can pass some retrieval tasks and fail overwrites. A retrieval system can find the right document and still lose the answer in the prompt.",
        "The ledger is the antidote to label-driven evaluation. It demands that each claim name the slice, the setup, the evidence position, the model revision, the runtime path, and the decision rule.",
      ],
    },
    {
      heading: 'The Wall: Memory Is Not One Skill',
      paragraphs: [
        "Memory quality is not one property. Exact lookup, multi-hop binding, middle-position robustness, recency, overwrite handling, long carry, aggregation, code-trace fidelity, and instruction following can all move in different directions. A system may retrieve a single unique key but fail when two keys must be associated. It may remember the first and last pages while ignoring the middle. It may keep stale facts after a later correction.",
        "Deployment adds another wall. A candidate memory layer can pass offline tasks and fail production because it falls off the optimized kernel route, increases time to first token, produces a tail-latency spike, consumes unexpected state bytes per user, or silently routes hard examples to full attention. If the serving path is not recorded, a quality win may actually be a hidden fallback.",
        "That is why a useful ledger mixes modeling rows and systems rows. The same candidate must be evaluated as a memory algorithm and as a serving component.",
      ],
    },
    {
      heading: 'Core Insight: Evaluate Slices',
      paragraphs: [
        "The core insight is to evaluate memory as a ledger of slices, not as a single scoreboard. A slice is a narrow claim: can the model recover one fact at 80 percent depth, bind two facts separated by 40K tokens, prefer the later correction over the earlier statement, aggregate values across the context, or trace a variable through a long code file? Each row should have enough metadata to rerun it.",
        "The result is a frontier rather than a champion. Full attention may win exact recall but pay a high KV-cache cost. A compressed memory model may reduce state bytes but blur rare facts. A state-space model may carry long trends while struggling with sharp associative lookup. A retrieval hybrid may work when the retriever finds the right chunk and fail when chunking breaks the evidence. The ledger makes those tradeoffs visible.",
        "This style also prevents good results from hiding bad product fit. A model that wins average accuracy but fails the legally required citation slice is not shippable for a legal assistant. A model that passes retrieval but misses p99 is not shippable for interactive chat. The ledger keeps the decision attached to the use case.",
      ],
    },
    {
      heading: 'Ledger Data Model',
      paragraphs: [
        "A useful row includes architecture id, model revision, tokenizer, context length, task family, evidence position, number of needles, multi-hop depth, overwrite pattern, aggregation rule, prompt template, seed, expected answer, scoring function, and pass or fail reason. For serving, it includes runtime, kernel path, batch shape, p50, p95, p99, time to first token, time per output token, state bytes per user, fallback rate, and hardware.",
        "The ledger also needs artifact pointers. Each row should link to the exact prompts, generated data, code version, container or environment, model weights or API revision, and scorer. Without those links, the ledger is only a slide. With them, it becomes an engineering object that can catch regressions, support rollout decisions, and settle disputes about what actually changed.",
        "A good schema keeps rows narrow but composable. You should be able to filter by architecture, by task slice, by context length, by evidence position, by serving route, and by product gate. That lets the team ask precise questions instead of staring at one blended number.",
      ],
    },
    {
      heading: 'What the Animation Teaches',
      paragraphs: [
        "The recall-slices view shows that long-context testing should cover more than simple lookup. The highlighted middle-position, overwrite, and aggregation cells are the places where impressive context-window claims often break. The plot makes the lost-in-the-middle pattern concrete: edge evidence can be easy while middle evidence disappears.",
        "The serving-gate view shows that quality and cost have to be evaluated together. A candidate may look attractive as context length grows because it uses less memory, but the product cannot ship it if the quality curve drops below the floor or the p99 path becomes unstable. The gate is therefore a frontier decision, not a trophy for the highest average score.",
      ],
    },
    {
      heading: 'Mechanism: From Baseline to Gate',
      paragraphs: [
        "Start with a strong baseline. In many projects that means the current production route and, where feasible, a full-attention reference. The baseline must be strong enough that the candidate cannot win by beating a strawman. Then run shared slices: single-needle lookup, multi-needle lookup, multi-hop binding, middle-position retrieval, late overwrite, aggregation, long conversation carry, code trace, and domain-specific tasks.",
        "Next add architecture-specific probes. Linear attention needs collision, normalization, and denominator-stability tests because many tokens are compressed into a state. State-space models need long-carry and sharp-event tests because they excel at some continuous sequence patterns but may smear rare associative facts. Delta-rule and fast-weight models need overwrite tests because update rules can leave stale state. Neural memory needs surprise-write, retrieval, and drift probes because its learned storage can change behavior across distributions.",
        "Finally run serving gates under realistic traffic shapes. Use the same route the product will use, not a special benchmark path. Record batch size, context distribution, output length, hardware, kernel selection, fallback rate, and tail latency. A candidate that passes only under a lab route has not passed the product gate.",
      ],
    },
    {
      heading: 'Worked Example: Replacing Attention Layers',
      paragraphs: [
        "Suppose a team wants to replace some full-attention layers with a compressed memory layer to reduce KV-cache pressure at 64K and 128K context. The candidate looks promising on cost: state bytes per user fall, decode throughput improves, and batch capacity rises. A single aggregate benchmark says the model is close to baseline.",
        "The ledger asks sharper questions. Does the model still find a fact placed at 50 percent depth? Does it bind the right customer id to the right invoice total when the two facts appear far apart? Does it prefer a late correction over an early statement? Does it summarize a long incident timeline without dropping the root cause? Does it trace a renamed function through a code migration?",
        "Now the decision becomes actionable. If middle-position retrieval fails but serving is strong, the team may need training data or architectural changes. If quality passes but p99 fails, the next work is kernel and runtime engineering. If overwrite tasks fail, the update rule or recency handling is suspect. The ledger tells the team what to fix instead of merely saying the candidate is better or worse.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The ledger works because failures do not get averaged away. A model can pass simple retrieval and fail multi-hop binding. It can pass edge evidence and fail middle evidence. It can pass quality and fail p99. Those are different rows with different owners and different fixes.",
        "It also works because it forces evidence to stay attached to deployment. Long-context memory is not only a modeling property. It is a serving claim about state size, kernels, caching, batching, and fallback behavior. A memory-efficient architecture is not production-ready unless its quality slices and serving path survive together.",
        "The product decision is usually a knee in the curve. As context grows, compressed memory becomes more attractive on cost, but quality may decline. The ship point is where savings, latency, and memory fit improve while the required slices remain above the product floor.",
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        "The ledger has its own cost. It requires benchmark generation, scorers, prompt versioning, artifact storage, hardware capture, and routine re-runs. It can slow down teams that want one clean leaderboard. It also forces uncomfortable conversations when a candidate wins average accuracy but fails a high-value slice.",
        "The trade is worth it when memory choices affect architecture and infrastructure. Grouped KV, latent KV, linear attention, RetNet-style recurrence, RWKV, Mamba-2, Gated DeltaNet, TTT layers, xLSTM, neural memory, retrieval, and hybrid attention budgets all change both quality and serving cost. The ledger is the place where those changes become comparable.",
        "The main danger is false precision. A ledger with weak slices, brittle scorers, or unrepresentative traffic can look scientific while steering the team badly. The slice set must be updated as the product learns where users actually depend on memory.",
      ],
    },
    {
      heading: 'Where It Wins and Fails',
      paragraphs: [
        "A sequence-memory ledger wins in model selection, architecture research, runtime planning, and rollout reviews. It is especially useful when a team must decide whether the next month belongs to kernel work, data generation, retrieval improvements, context packing, architecture changes, or a narrower launch target.",
        "It fails when the rows are too easy, the prompts are not versioned, the serving path is missing, or the baseline is weak. It also fails when the report collapses back into one average after collecting detailed rows. The point of the ledger is to preserve the shape of the failures.",
        "The ledger is not a substitute for real product telemetry. Synthetic tasks can expose mechanisms, but user traffic reveals distributions. The best evaluation loop keeps synthetic slices, curated domain tasks, and canary telemetry connected.",
      ],
    },
    {
      heading: 'Misconceptions to Avoid',
      paragraphs: [
        "Do not treat context length as memory quality. A bigger window can increase the chance that evidence is present while decreasing the chance that the model uses it correctly. Presence and use are different claims.",
        "Do not treat a needle task as a complete long-context evaluation. It is a useful smoke test, especially when scaled and varied, but it cannot stand in for multi-hop reasoning, overwrite handling, aggregation, code navigation, or domain workflows.",
        "Do not treat efficient memory as automatically better. A compressed state that is cheap but loses rare facts can be worse than full attention for high-stakes retrieval. Conversely, exact full attention that misses latency or cost targets can be unusable at product scale.",
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources: Lost in the Middle at https://arxiv.org/abs/2307.03172 and https://aclanthology.org/2024.tacl-1.9/, RULER at https://arxiv.org/abs/2404.06654 and https://github.com/NVIDIA/RULER, LongBench at https://arxiv.org/abs/2308.14508, and Transformer Inference Roofline sources in this repo.",
        "Study Mamba-2 Structured State Space Duality Case Study, Linear Attention Prefix-State Primer, Fast Weight Delta-Rule Memory Case Study, Kimi Linear Attention, Titans Test-Time Neural Memory Case Study, Lost in the Middle: Long-Context Failure Modes, Benchmark Variance and Model Selection, KV Cache Concurrency Capacity Model, and RAG Context Packing Token Budget next.",
      ],
    },
  ],
};
