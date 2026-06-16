// MoE production routing: top-k choices become capacity slots, dispatch buffers,
// all-to-all exchange, combine weights, and load telemetry.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'moe-expert-capacity-all-to-all-routing-ledger-case-study',
  title: 'MoE Expert Capacity and All-To-All Routing Ledger',
  category: 'AI & ML',
  summary: 'A production MoE case study: route tokens to top-k experts, assign bounded capacity slots, exchange token shards with all-to-all, combine outputs, and gate load balance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['router slots', 'dispatch fabric', 'ops gates'], defaultValue: 'router slots' },
  ],
  run,
};

const TOKENS = [
  { id: 't0', label: 'the' },
  { id: 't1', label: 'protein' },
  { id: 't2', label: 'folds' },
  { id: 't3', label: 'quickly' },
  { id: 't4', label: 'GPU' },
  { id: 't5', label: 'kernel' },
  { id: 't6', label: 'Paris' },
  { id: 't7', label: '1871' },
];

const EXPERTS = [
  { id: 'e0', label: 'E0' },
  { id: 'e1', label: 'E1' },
  { id: 'e2', label: 'E2' },
  { id: 'e3', label: 'E3' },
];

const ROUTER = [
  [0.62, 0.19, 0.13, 0.06],
  [0.08, 0.74, 0.12, 0.06],
  [0.10, 0.58, 0.24, 0.08],
  [0.55, 0.16, 0.18, 0.11],
  [0.11, 0.08, 0.70, 0.11],
  [0.09, 0.10, 0.68, 0.13],
  [0.18, 0.12, 0.14, 0.56],
  [0.15, 0.11, 0.18, 0.56],
];

const PICKS = [
  ['e0', 'e1'],
  ['e1', 'e2'],
  ['e1', 'e2'],
  ['e0', 'e2'],
  ['e2', 'e3'],
  ['e2', 'e3'],
  ['e3', 'e0'],
  ['e3', 'e2'],
];

const EXPERT_TO_GPU = {
  e0: 'g0',
  e1: 'g1',
  e2: 'g2',
  e3: 'g3',
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

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function topCellsForPick(rank = 0) {
  return PICKS.map((picks, i) => `${TOKENS[i].id}:${picks[rank]}`);
}

function dispatchGraph(title) {
  return graphState({
    nodes: [
      { id: 'batch', label: 'batch', x: 0.7, y: 3.8, note: 'tokens' },
      { id: 'router', label: 'router', x: 2.1, y: 3.8, note: 'logits' },
      { id: 'topk', label: 'top-k', x: 3.6, y: 2.2, note: 'k=2' },
      { id: 'slots', label: 'slots', x: 3.6, y: 5.3, note: 'cap' },
      { id: 'pack', label: 'pack', x: 5.2, y: 3.8, note: 'sendbuf' },
      { id: 'a2a', label: 'all2all', x: 6.8, y: 3.8, note: 'swap' },
      { id: 'experts', label: 'experts', x: 8.5, y: 2.4, note: 'GEMM' },
      { id: 'combine', label: 'combine', x: 8.5, y: 5.2, note: 'weights' },
      { id: 'out', label: 'out', x: 10.0, y: 3.8, note: 'tokens' },
    ],
    edges: [
      { id: 'e-batch-router', from: 'batch', to: 'router', weight: 'hidden' },
      { id: 'e-router-topk', from: 'router', to: 'topk', weight: 'score' },
      { id: 'e-router-slots', from: 'router', to: 'slots', weight: 'count' },
      { id: 'e-topk-pack', from: 'topk', to: 'pack', weight: 'idx' },
      { id: 'e-slots-pack', from: 'slots', to: 'pack', weight: 'slot' },
      { id: 'e-pack-a2a', from: 'pack', to: 'a2a', weight: 'bytes' },
      { id: 'e-a2a-experts', from: 'a2a', to: 'experts', weight: 'local' },
      { id: 'e-experts-combine', from: 'experts', to: 'combine', weight: 'y_i' },
      { id: 'e-combine-out', from: 'combine', to: 'out', weight: 'sum' },
    ],
  }, { title });
}

function slotRows() {
  return [
    { id: 's0', label: 'slot0' },
    { id: 's1', label: 'slot1' },
    { id: 's2', label: 'slot2' },
    { id: 's3', label: 'slot3' },
    { id: 'over', label: 'over' },
  ];
}

function* routerSlots() {
  yield {
    state: matrixState({
      title: 'Router scores each token against every expert',
      rows: TOKENS,
      columns: EXPERTS,
      values: ROUTER,
      format: pct,
    }),
    highlight: { active: topCellsForPick(0), compare: topCellsForPick(1) },
    explanation: 'The router is a learned score table at runtime: each token gets affinity scores for experts. The top expert is not enough for most top-2 MoE layers; the dispatch ledger must preserve both selected experts and their combine weights.',
    invariant: 'Routing output is structured data: token id, expert id, rank, weight, and slot.',
  };

  yield {
    state: labelMatrix(
      'Top-2 assignment ledger',
      TOKENS,
      [
        { id: 'p0', label: 'pick0' },
        { id: 'w0', label: 'w0' },
        { id: 'p1', label: 'pick1' },
        { id: 'w1', label: 'w1' },
      ],
      [
        ['E0', '0.62', 'E1', '0.19'],
        ['E1', '0.74', 'E2', '0.12'],
        ['E1', '0.58', 'E2', '0.24'],
        ['E0', '0.55', 'E2', '0.18'],
        ['E2', '0.70', 'E3', '0.11'],
        ['E2', '0.68', 'E3', '0.13'],
        ['E3', '0.56', 'E0', '0.18'],
        ['E3', '0.56', 'E2', '0.18'],
      ],
    ),
    highlight: { active: ['t1:p0', 't2:p0', 't4:p0', 't5:p0'], found: ['t4:p1', 't5:p1'], compare: ['t0:p1'] },
    explanation: 'This ledger is what makes the animation honest: top-k is not a vague choice. The runtime records the selected expert IDs and the router weights needed to blend expert outputs back into one token state.',
  };

  yield {
    state: labelMatrix(
      'Capacity slots per expert',
      slotRows(),
      EXPERTS,
      [
        ['t0', 't0', 't1', 't4'],
        ['t3', 't1', 't2', 't5'],
        ['t6', 't2', 't3', 't6'],
        ['', '', 't4', 't7'],
        ['', '', 't5,t7', ''],
      ],
    ),
    highlight: { active: ['s0:e2', 's1:e2', 's2:e2', 's3:e2'], compare: ['over:e2'], found: ['s0:e3', 's3:e3'] },
    explanation: 'Capacity converts a soft routing preference into bounded memory. Here each expert has four slots. Expert E2 receives six assignments, so two assignments overflow and must be dropped, rerouted, padded, or handled by a different capacity factor.',
    invariant: 'Expert capacity is a memory layout contract, not just a training hyperparameter.',
  };

  yield {
    state: labelMatrix(
      'Capacity factor tradeoff',
      [
        { id: 'cf10', label: 'cf1.0' },
        { id: 'cf125', label: 'cf1.25' },
        { id: 'cf15', label: 'cf1.5' },
        { id: 'cf20', label: 'cf2.0' },
      ],
      [
        { id: 'slots', label: 'slots' },
        { id: 'drop', label: 'drop' },
        { id: 'mem', label: 'mem' },
        { id: 'lat', label: 'lat' },
      ],
      [
        ['4', '2', 'low', 'low'],
        ['5', '1', 'mid', 'mid'],
        ['6', '0', 'high', 'mid'],
        ['8', '0', 'vhigh', 'high'],
      ],
    ),
    highlight: { active: ['cf125:slots', 'cf125:drop'], found: ['cf15:drop'], compare: ['cf20:mem'] },
    explanation: 'Capacity factor is the pressure valve. Smaller factors save memory and static compute but can drop or reroute tokens when the router is skewed. Larger factors reduce overflow but pay with padding, memory, and latency.',
  };

  yield {
    state: labelMatrix(
      'Load-balance telemetry',
      EXPERTS,
      [
        { id: 'load', label: 'load' },
        { id: 'share', label: 'share' },
        { id: 'bias', label: 'bias' },
        { id: 'state', label: 'state' },
      ],
      [
        ['3', '19%', '+0.02', 'ok'],
        ['3', '19%', '+0.02', 'ok'],
        ['6', '38%', '-0.05', 'hot'],
        ['4', '25%', '+0.00', 'ok'],
      ],
    ),
    highlight: { active: ['e2:load', 'e2:share', 'e2:bias', 'e2:state'], found: ['e0:state', 'e1:state'], compare: ['e3:load'] },
    explanation: 'Modern MoE systems need telemetry beyond loss. Track per-expert token counts, probability mass, overflow, dropped assignments, auxiliary-loss pressure or bias terms, and hot experts. Without that ledger, router collapse hides behind average quality.',
  };
}

function* dispatchFabric() {
  yield {
    state: dispatchGraph('MoE dispatch is gather, all-to-all, expert GEMM, combine'),
    highlight: { active: ['batch', 'router', 'topk', 'slots', 'pack'], found: ['combine'], compare: ['experts'] },
    explanation: 'The local batch first becomes routing metadata. The system gathers selected token states into per-destination send buffers, preserving original token IDs, expert IDs, slot IDs, and combine weights.',
  };

  yield {
    state: labelMatrix(
      'Expert placement',
      EXPERTS,
      [
        { id: 'gpu', label: 'gpu' },
        { id: 'kind', label: 'kind' },
        { id: 'load', label: 'load' },
      ],
      [
        ['G0', 'local', '3'],
        ['G1', 'remote', '3'],
        ['G2', 'remote', '6'],
        ['G3', 'remote', '4'],
      ],
    ),
    highlight: { active: ['e2:gpu', 'e2:load'], compare: ['e0:kind'], found: ['e3:load'] },
    explanation: 'Expert parallelism usually places different experts on different ranks. A token can be local for E0 and remote for E2 in the same top-2 route. The router therefore creates a communication problem before it creates a neural-network problem.',
  };

  yield {
    state: labelMatrix(
      'Send-count matrix',
      [
        { id: 'g0', label: 'G0' },
        { id: 'g1', label: 'G1' },
        { id: 'g2', label: 'G2' },
        { id: 'g3', label: 'G3' },
      ],
      [
        { id: 'to0', label: 'toG0' },
        { id: 'to1', label: 'toG1' },
        { id: 'to2', label: 'toG2' },
        { id: 'to3', label: 'toG3' },
      ],
      [
        ['3', '3', '6', '4'],
        ['0', '0', '0', '0'],
        ['0', '0', '0', '0'],
        ['0', '0', '0', '0'],
      ],
    ),
    highlight: { active: ['g0:to2', 'g0:to3'], found: ['g0:to0'], compare: ['g0:to1'] },
    explanation: 'An all-to-all call needs counts and offsets. In this one-rank teaching batch, GPU 0 owns the tokens and sends expert payloads to the ranks that own E0, E1, E2, and E3. Real batches have nonzero rows for every source rank.',
  };

  yield {
    state: dispatchGraph('All-to-all turns destination buffers into local expert batches'),
    highlight: { active: ['pack', 'a2a', 'experts', 'e-pack-a2a', 'e-a2a-experts'], found: ['slots'], compare: ['router'] },
    explanation: 'All-to-all is the collective that matches MoE routing: every rank may send different token slices to every other rank. Megatron-Core recommends all-to-all dispatch when expert parallelism is applied because the traffic pattern is peer-specific, not a shared reduction.',
  };

  yield {
    state: labelMatrix(
      'Combine buffer',
      TOKENS,
      [
        { id: 'y0', label: 'y0' },
        { id: 'a0', label: 'a0' },
        { id: 'y1', label: 'y1' },
        { id: 'a1', label: 'a1' },
        { id: 'out', label: 'out' },
      ],
      [
        ['E0', '.62', 'E1', '.19', 'sum'],
        ['E1', '.74', 'E2', '.12', 'sum'],
        ['E1', '.58', 'E2', '.24', 'sum'],
        ['E0', '.55', 'E2', '.18', 'sum'],
        ['E2', '.70', 'E3', '.11', 'sum'],
        ['E2', '.68', 'E3', '.13', 'sum'],
        ['E3', '.56', 'E0', '.18', 'sum'],
        ['E3', '.56', 'E2', '.18', 'sum'],
      ],
    ),
    highlight: { active: ['t4:y0', 't4:a0', 't4:y1', 't4:a1', 't4:out'], found: ['t6:out'], compare: ['t0:y1'] },
    explanation: 'After expert outputs return, the combine buffer restores original token order and blends outputs with router weights. Losing token IDs or rank order here creates silent semantic corruption rather than a clean crash.',
    invariant: 'Dispatch scatters by expert; combine restores by token.',
  };

  yield {
    state: labelMatrix(
      'Dispatch ledger fields',
      [
        { id: 'tok', label: 'tok id' },
        { id: 'expert', label: 'expert id' },
        { id: 'slot', label: 'slot id' },
        { id: 'rank', label: 'rank' },
        { id: 'weight', label: 'weight' },
        { id: 'offset', label: 'offset' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'bug', label: 'bug if lost' },
      ],
      [
        ['restore', 'wrong token'],
        ['run expert', 'bad GEMM'],
        ['cap layout', 'overwrite'],
        ['send peer', 'dead route'],
        ['blend out', 'bad scale'],
        ['pack bytes', 'bad read'],
      ],
    ),
    highlight: { active: ['tok:why', 'expert:why', 'slot:why', 'weight:why'], compare: ['offset:bug'] },
    explanation: 'This is the data-structure lesson: MoE performance depends on a ledger that survives gather, collective communication, expert execution, return traffic, and combine. Treating routing as just a probability matrix misses the hard part.',
  };
}

function* opsGates() {
  yield {
    state: plotState({
      axes: { x: { label: 'hot share', min: 0.25, max: 0.75 }, y: { label: 'p99 latency', min: 1.0, max: 2.4 } },
      series: [
        { id: 'a2a', label: 'all2all', points: [
          { x: 0.25, y: 1.08 }, { x: 0.35, y: 1.18 }, { x: 0.45, y: 1.42 }, { x: 0.60, y: 1.92 }, { x: 0.72, y: 2.30 },
        ] },
        { id: 'ideal', label: 'ideal', points: [
          { x: 0.25, y: 1.05 }, { x: 0.35, y: 1.08 }, { x: 0.45, y: 1.12 }, { x: 0.60, y: 1.20 }, { x: 0.72, y: 1.30 },
        ] },
      ],
      markers: [
        { id: 'gate', x: 0.38, y: 1.22, label: 'gate' },
      ],
    }),
    highlight: { active: ['a2a', 'gate'], compare: ['ideal'] },
    explanation: 'Sparse FLOPs do not guarantee sparse latency. When one expert receives too much traffic, the all-to-all exchange and expert GEMM wait for the hot rank. Production gates should track skew against p99, not only average throughput.',
  };

  yield {
    state: labelMatrix(
      'System patterns',
      [
        { id: 'gshard', label: 'GShard' },
        { id: 'switch', label: 'Switch' },
        { id: 'mixtral', label: 'Mixtral' },
        { id: 'dsm', label: 'DeepMoE' },
        { id: 'dsv3', label: 'DS-V3' },
        { id: 'dsmoe', label: 'DS-MoE' },
        { id: 'mega', label: 'MCore' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'control', label: 'control' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['top2', 'aux loss', 'shard'],
        ['top1', 'cap fac', 'simple'],
        ['top2', '8 exp', 'open'],
        ['fine', 'shared', 'special'],
        ['topk', 'bias', 'loss-free'],
        ['serve', 'compress', 'latency'],
        ['a2a', 'EP', 'dispatch'],
      ],
    ),
    highlight: { active: ['mixtral:route', 'dsv3:control', 'mega:lesson'], found: ['switch:control'], compare: ['dsmoe:lesson'] },
    explanation: 'The lineage is practical. GShard made large conditional computation trainable. Switch simplified routing. Mixtral made open top-2 MoE visible. DeepSeekMoE changed expert granularity. DeepSeek-V3 reports loss-free balancing. Systems stacks such as DeepSpeed-MoE and Megatron-Core make dispatch and serving explicit.',
  };

  yield {
    state: labelMatrix(
      'Serving gate',
      [
        { id: 'qual', label: 'qual' },
        { id: 'bal', label: 'bal' },
        { id: 'comm', label: 'comm' },
        { id: 'mem', label: 'mem' },
        { id: 'tail', label: 'tail' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'metric', label: 'metric' },
        { id: 'fail', label: 'fail' },
        { id: 'action', label: 'act' },
      ],
      [
        ['eval', 'regress', 'block'],
        ['max', 'hot', 'rebias'],
        ['bytes', 'stall', 'bucket'],
        ['experts', 'OOM', 'quant'],
        ['p99', 'spike', 'cap'],
        ['rlog', 'missing', 'audit'],
      ],
    ),
    highlight: { active: ['bal:metric', 'comm:metric', 'tail:metric'], compare: ['qual:fail'], found: ['trace:action'] },
    explanation: 'A production MoE release should gate on quality slices, load skew, all-to-all bytes, memory residency, p99, and trace coverage. The route ledger turns a bad answer or latency spike into a debuggable event.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'collapse', label: 'collapse' },
        { id: 'overflow', label: 'overflow' },
        { id: 'a2a', label: 'a2a stall' },
        { id: 'combine', label: 'bad merge' },
        { id: 'cache', label: 'KV cache' },
        { id: 'drift', label: 'data drift' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['one expert', 'aux/bias'],
        ['drops', 'cap tune'],
        ['hot rank', 'place exp'],
        ['wrong out', 'tok ids'],
        ['low batch', 'sched'],
        ['new domain', 'calib'],
      ],
    ),
    highlight: { active: ['collapse:fix', 'overflow:fix', 'a2a:fix'], found: ['combine:fix'], compare: ['cache:symptom'] },
    explanation: 'Most MoE incidents are ordinary distributed-systems failures wearing a model architecture label: skew, overflow, bad offsets, memory pressure, scheduling fragmentation, and drift. The fix is observability plus a route-aware control plane.',
  };

  yield {
    state: dispatchGraph('Sparse expert serving still needs a control plane'),
    highlight: { active: ['router', 'slots', 'a2a', 'experts', 'combine', 'out'], found: ['pack'], compare: ['batch'] },
    explanation: 'The final design is not only a model. It is a router, capacity allocator, collective exchange, expert placement plan, combine buffer, telemetry stream, and rollback policy. That is why MoE is both a data-structure topic and a systems topic.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'router slots') yield* routerSlots();
  else if (view === 'dispatch fabric') yield* dispatchFabric();
  else if (view === 'ops gates') yield* opsGates();
  else throw new InputError('Pick a MoE routing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A production Mixture-of-Experts layer is not just a router probability table. It is a small distributed data system embedded inside a transformer block. Tokens are scored against experts, top-k expert IDs are selected, capacity slots are assigned, selected hidden states are packed into send buffers, an all-to-all collective moves token shards to expert-owning ranks, expert MLPs run, outputs return, and combine weights restore one hidden state per original token.',
        'The basic Mixture of Experts primer explains why sparse activation can increase parameter capacity without activating every parameter for every token. This case study shows the missing operational layer: the bounded slot table and dispatch ledger that decide whether the sparse model is actually trainable, fast, and debuggable.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The router emits a score matrix shaped tokens by experts. Top-k turns that into assignment records: token id, expert id, route rank, router weight, and sometimes a load-balance bias. Capacity assignment adds slot ids under each expert. Dispatch adds destination rank, send offset, byte range, and original token order. Combine adds the return offsets and router weights used to blend outputs.',
        'These structures are compact, but they are not optional bookkeeping. Dropping a token id corrupts output order. Dropping a slot id can overwrite an expert input. Dropping a combine weight changes the residual stream. Dropping load telemetry hides router collapse until quality or p99 breaks.',
      ],
    },
    {
      heading: 'Case study: top-k capacity',
      paragraphs: [
        'GShard used top-2 expert routing and automatic sharding to scale multilingual translation beyond 600B parameters. Switch Transformer simplified the routing to one expert per token and made capacity factor a central engineering knob. The capacity factor decides how many token slots each expert reserves relative to the expected balanced load. Low capacity reduces memory and padding but can overflow when routing is skewed; high capacity protects tokens but increases memory and latency.',
        'The important mental model is that capacity is a memory layout contract. The route table may prefer six assignments for one expert, but if the static buffer has four slots, two assignments need an explicit policy: drop, reroute, backpressure, increase capacity, or change the balancing objective. A serious MoE implementation records this decision rather than hiding it in aggregate loss.',
      ],
    },
    {
      heading: 'Case study: all-to-all dispatch',
      paragraphs: [
        'Expert parallelism places experts on different ranks. A local batch can contain tokens whose top-2 experts live on several devices. That creates an all-to-all traffic pattern: every rank may send a different amount of token data to every other rank. This is different from all-reduce, where ranks jointly reduce the same-shaped buffer. MoE dispatch is peer-specific shuffling.',
        'Megatron-Core documents all-to-all as the recommended dispatcher when expert parallelism is applied. DeepSpeed-MoE frames the serving challenge directly: MoE can save training compute, but inference is hard because the model is larger, routing is irregular, and communication can dominate. The dispatch ledger makes this visible by separating route choice, slot allocation, packed bytes, all-to-all counts, expert execution, and combine.',
      ],
    },
    {
      heading: 'Modern systems',
      paragraphs: [
        'Mixtral 8x7B is an open sparse MoE with eight feed-forward experts per layer and two selected experts per token. The paper reports 47B total parameters and 13B active parameters per token, making the capacity-versus-active-compute trade concrete. DeepSeekMoE introduced finer-grained expert segmentation and shared experts to encourage specialization and reduce redundancy. DeepSeek-V3 reports 671B total parameters with 37B activated per token, using DeepSeekMoE and an auxiliary-loss-free strategy for load balancing.',
        'Those systems are not interchangeable slogans. Top-1 versus top-2 changes combine buffers. Fine-grained experts change dispatch cardinality. Shared experts change what must always run. Loss-free balancing changes the control signal. Serving compression changes memory residency. The route ledger is the common interface that lets an operator compare those choices.',
      ],
    },
    {
      heading: 'Operational gates',
      paragraphs: [
        'A MoE deployment should gate on task quality slices, per-expert load distribution, overflow rate, dropped-token rate, all-to-all bytes, expert GEMM occupancy, memory residency, p50/p99 latency, and trace coverage. Average tokens per second is not enough because a single hot expert can dominate tail latency while the mean looks fine.',
        'The common failures are router collapse, expert overflow, hot-rank all-to-all stalls, incorrect combine order, scheduling fragmentation with the KV cache, and data drift that changes expert load. These are partly ML failures and partly distributed-systems failures. Treat them like both: evaluate slices, trace route decisions, canary capacity changes, and keep rollback paths for routing policy and expert placement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Shazeer et al. on sparsely-gated MoE at https://arxiv.org/abs/1701.06538, GShard at https://arxiv.org/abs/2006.16668, Switch Transformer at https://arxiv.org/abs/2101.03961, Mixtral of Experts at https://arxiv.org/abs/2401.04088, DeepSeekMoE at https://arxiv.org/abs/2401.06066, DeepSpeed-MoE at https://arxiv.org/abs/2201.05596, Megatron-Core MoE docs at https://docs.nvidia.com/megatron-core/developer-guide/latest/api-guide/moe.html, and DeepSeek-V3 at https://arxiv.org/abs/2412.19437.',
        'Study Mixture of Experts, Load Balancer, GPU All-Reduce, Tensor Parallelism, Transformer Inference Roofline, LLM Continuous Batching, Length-Aware Batching for LLM Schedulers, KV Cache Concurrency Capacity Model, Benchmark Variance and Model Selection, Structured Pruning and N:M Sparsity, and Activation-Aware Quantization Calibration Ledger next.',
      ],
    },
  ],
};
