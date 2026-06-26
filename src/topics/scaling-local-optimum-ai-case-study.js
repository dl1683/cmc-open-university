// Scaling as a local optimum: explain when bigger models are the right move,
// when metrics and infrastructure make them the default move, and how to escape.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'scaling-local-optimum-ai-case-study',
  title: 'Scaling as Local Optimum Case Study',
  category: 'AI & ML',
  summary: 'A case study on scaling laws, benchmark incentives, infrastructure lock-in, emergent-metric artifacts, and alternative evidence paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['scaling loop', 'escape routes'], defaultValue: 'scaling loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'metric', label: 'metric', x: 0.8, y: 3.7, note: 'score' },
      { id: 'paper', label: 'paper', x: 2.3, y: 2.0, note: 'publish' },
      { id: 'fund', label: 'funding', x: 4.2, y: 2.0, note: 'budget' },
      { id: 'cluster', label: 'cluster', x: 5.9, y: 3.7, note: 'GPUs' },
      { id: 'team', label: 'team', x: 4.2, y: 5.5, note: 'skills' },
      { id: 'model', label: 'bigger', x: 2.3, y: 5.5, note: 'scale up' },
    ],
    edges: [
      { id: 'e-metric-paper', from: 'metric', to: 'paper' },
      { id: 'e-paper-fund', from: 'paper', to: 'fund' },
      { id: 'e-fund-cluster', from: 'fund', to: 'cluster' },
      { id: 'e-cluster-team', from: 'cluster', to: 'team' },
      { id: 'e-team-model', from: 'team', to: 'model' },
      { id: 'e-model-metric', from: 'model', to: 'metric' },
    ],
  }, { title });
}

function escapeGraph(title) {
  return graphState({
    nodes: [
      { id: 'bottleneck', label: 'bottleneck', x: 0.8, y: 3.7, note: 'measure' },
      { id: 'data', label: 'data', x: 2.9, y: 1.4, note: 'quality' },
      { id: 'eval', label: 'eval', x: 2.9, y: 2.7, note: 'proxy' },
      { id: 'arch', label: 'arch', x: 2.9, y: 4.4, note: 'bias' },
      { id: 'serving', label: 'serving', x: 2.9, y: 5.8, note: 'cost+p99' },
      { id: 'proof', label: 'proof', x: 5.5, y: 3.7, note: 'evidence' },
      { id: 'rollout', label: 'rollout', x: 7.8, y: 3.7, note: 'guarded' },
      { id: 'learn', label: 'learn', x: 9.3, y: 3.7, note: 'update' },
    ],
    edges: [
      { id: 'e-bottleneck-data', from: 'bottleneck', to: 'data' },
      { id: 'e-bottleneck-eval', from: 'bottleneck', to: 'eval' },
      { id: 'e-bottleneck-arch', from: 'bottleneck', to: 'arch' },
      { id: 'e-bottleneck-serving', from: 'bottleneck', to: 'serving' },
      { id: 'e-data-proof', from: 'data', to: 'proof' },
      { id: 'e-eval-proof', from: 'eval', to: 'proof' },
      { id: 'e-arch-proof', from: 'arch', to: 'proof' },
      { id: 'e-serving-proof', from: 'serving', to: 'proof' },
      { id: 'e-proof-rollout', from: 'proof', to: 'rollout' },
      { id: 'e-rollout-learn', from: 'rollout', to: 'learn' },
    ],
  }, { title });
}

function* scalingLoop() {
  yield {
    state: loopGraph('Scaling can become a self-reinforcing loop'),
    highlight: { active: ['metric', 'paper', 'fund', 'cluster', 'team', 'model'], found: ['e-model-metric'] },
    explanation: 'Scaling works often enough to become the default move. The loop starts when metrics reward bigger runs, funding buys clusters, teams specialize around clusters, and the next plausible proposal is another scale-up.',
  };

  yield {
    state: labelMatrix(
      'Scaling ledger',
      [
        { id: 'params', label: 'params' },
        { id: 'tokens', label: 'tokens' },
        { id: 'compute', label: 'compute' },
        { id: 'metric', label: 'metric' },
        { id: 'serving', label: 'serving' },
      ],
      [
        { id: 'buys', label: 'buys' },
        { id: 'hides', label: 'hides' },
      ],
      [
        ['capacity', 'inference cost'],
        ['coverage', 'data quality'],
        ['throughput', 'energy+p99'],
        ['headline', 'bad proxy'],
        ['reach', 'unit econ'],
      ],
    ),
    highlight: { active: ['params:buys', 'tokens:buys', 'compute:buys'], compare: ['metric:hides', 'serving:hides'] },
    explanation: 'Bigger can buy real capability, but the ledger must include what it hides: serving cost, data quality, energy, p99, bad proxies, and product economics. Otherwise scale becomes a substitute for diagnosis.',
    invariant: 'Scaling is a lever, not a diagnosis.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'model scale', min: 1, max: 10 }, y: { label: 'measured score', min: 0, max: 1 } },
      series: [
        { id: 'prob', label: 'smooth prob', points: [{ x: 1, y: 0.25 }, { x: 2, y: 0.34 }, { x: 3, y: 0.42 }, { x: 4, y: 0.50 }, { x: 5, y: 0.58 }, { x: 6, y: 0.65 }, { x: 7, y: 0.72 }, { x: 8, y: 0.78 }, { x: 9, y: 0.83 }, { x: 10, y: 0.87 }] },
        { id: 'acc', label: 'step score', points: [{ x: 1, y: 0.0 }, { x: 2, y: 0.0 }, { x: 3, y: 0.0 }, { x: 4, y: 0.0 }, { x: 5, y: 0.0 }, { x: 6, y: 1.0 }, { x: 7, y: 1.0 }, { x: 8, y: 1.0 }, { x: 9, y: 1.0 }, { x: 10, y: 1.0 }] },
      ],
      markers: [
        { id: 'cutoff', x: 6, y: 1.0, label: 'cutoff' },
      ],
    }),
    highlight: { active: ['prob'], compare: ['acc', 'cutoff'] },
    explanation: 'The mirage paper shows the danger of nonlinear or discontinuous metrics. A smooth improvement in underlying probability can look like a sudden emergent jump when the public score is thresholded.',
  };

  yield {
    state: labelMatrix(
      'Compute allocation',
      [
        { id: 'kaplan', label: 'Kaplan' },
        { id: 'chinch', label: 'Chinchilla' },
        { id: 'serve', label: 'serving' },
        { id: 'edge', label: 'edge path' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'ask', label: 'ask' },
      ],
      [
        ['power laws', 'where spend?'],
        ['tokens too', 'data balance?'],
        ['decode wall', 'unit cost?'],
        ['small local', 'fit device?'],
      ],
    ),
    highlight: { active: ['kaplan:lesson', 'chinch:lesson'], found: ['serve:ask', 'edge:ask'] },
    explanation: 'Scaling laws are not "make N bigger forever." They are allocation tools. Chinchilla is the canonical correction: under a fixed budget, model size and training tokens both matter. Serving then adds a separate inference-economics constraint.',
  };

  yield {
    state: loopGraph('Infrastructure lock-in narrows the search space'),
    highlight: { active: ['cluster', 'team', 'model', 'e-cluster-team', 'e-team-model'], compare: ['metric'], found: ['fund'] },
    explanation: 'Once a team owns distributed-training infrastructure, hiring pipelines, benchmark rituals, and vendor commitments, scaling becomes the path of least resistance. That can be rational locally and limiting globally.',
  };

  yield {
    state: labelMatrix(
      'When scaling is the right move',
      [
        { id: 'data', label: 'data ready' },
        { id: 'metric', label: 'metric sane' },
        { id: 'cost', label: 'cost ok' },
        { id: 'alt', label: 'alts tested' },
      ],
      [
        { id: 'green', label: 'green sign' },
        { id: 'red', label: 'red sign' },
      ],
      [
        ['clean tokens', 'dirty pile'],
        ['smooth proxy', 'step artifact'],
        ['serving pays', 'unit loss'],
        ['scale wins', 'not tried'],
      ],
    ),
    highlight: { active: ['data:green', 'metric:green', 'cost:green'], compare: ['alt:red'] },
    explanation: 'A scale-up is strongest when the data is clean, the metric is well-behaved, serving economics work, and simpler alternatives have already been tested under fair evidence.',
  };
}

function* escapeRoutes() {
  yield {
    state: escapeGraph('Escape starts with bottleneck triage'),
    highlight: { active: ['bottleneck', 'data', 'eval', 'arch', 'serving'], found: ['proof', 'rollout'] },
    explanation: 'The escape from a local optimum is not anti-scaling. It is bottleneck triage: identify whether the next gain should come from data, evaluation, architecture, serving, or product design before buying the next run.',
  };

  yield {
    state: labelMatrix(
      'Alternative levers',
      [
        { id: 'data', label: 'data' },
        { id: 'rag', label: 'RAG' },
        { id: 'moe', label: 'MoE' },
        { id: 'distill', label: 'distill' },
        { id: 'edge', label: 'device' },
        { id: 'search', label: 'search' },
      ],
      [
        { id: 'attacks', label: 'attacks' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['coverage', 'slice lift'],
        ['context', 'groundedness'],
        ['FFN cost', 'router eval'],
        ['latency', 'teacher gap'],
        ['unit cost', 'task eval'],
        ['ideas', 'holdout'],
      ],
    ),
    highlight: { active: ['data:proof', 'rag:proof', 'edge:proof'], found: ['search:proof'], compare: ['moe:attacks'] },
    explanation: 'Alternatives should be judged by the bottleneck they attack and the proof they provide. A clever architecture that does not move cost, quality, latency, or reliability is not an escape route.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'spend', min: 0, max: 100 }, y: { label: 'product value', min: 0, max: 100 } },
      series: [
        { id: 'scale', label: 'scale only', points: [{ x: 10, y: 35 }, { x: 30, y: 50 }, { x: 60, y: 62 }, { x: 100, y: 70 }] },
        { id: 'systems', label: 'system mix', points: [{ x: 10, y: 35 }, { x: 25, y: 57 }, { x: 45, y: 72 }, { x: 70, y: 84 }] },
      ],
      markers: [
        { id: 'frontier', x: 70, y: 84, label: 'frontier' },
      ],
    }),
    highlight: { active: ['systems', 'frontier'], compare: ['scale'] },
    explanation: 'This conceptual frontier is the product argument. Better data, retrieval, evals, caching, routing, distillation, and on-device paths can dominate a pure scale-up when the product bottleneck is not raw pretraining loss.',
  };

  yield {
    state: labelMatrix(
      'Evidence ladder',
      [
        { id: 'idea', label: 'idea' },
        { id: 'demo', label: 'demo' },
        { id: 'paper', label: 'paper' },
        { id: 'prod', label: 'prod' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'next', label: 'next gate' },
      ],
      [
        ['mechanism', 'toy test'],
        ['works once', 'ablation'],
        ['fair budget', 'holdout'],
        ['online lift', 'monitor'],
      ],
    ),
    highlight: { active: ['paper:proof', 'prod:proof'], found: ['prod:next'] },
    explanation: 'Exploration needs evidence gates or it becomes storytelling. The point is to make non-scaling paths fundable: mechanism, toy test, ablation, fair budget, holdout, online lift, monitor.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'exploit', label: 'exploit', x: 0.8, y: 3.7, note: 'known path' },
        { id: 'scale', label: 'scale', x: 2.7, y: 2.1, note: 'bigger' },
        { id: 'explore', label: 'explore', x: 2.7, y: 5.3, note: 'new path' },
        { id: 'archive', label: 'archive', x: 4.8, y: 5.3, note: 'lessons' },
        { id: 'gate', label: 'gate', x: 6.8, y: 3.7, note: 'evidence' },
        { id: 'ship', label: 'ship', x: 8.8, y: 3.7, note: 'guarded' },
      ],
      edges: [
        { id: 'e-exploit-scale', from: 'exploit', to: 'scale' },
        { id: 'e-exploit-explore', from: 'exploit', to: 'explore' },
        { id: 'e-explore-archive', from: 'explore', to: 'archive' },
        { id: 'e-scale-gate', from: 'scale', to: 'gate' },
        { id: 'e-archive-gate', from: 'archive', to: 'gate' },
        { id: 'e-gate-ship', from: 'gate', to: 'ship' },
      ],
    }, { title: 'A healthier portfolio keeps exploration alive' }),
    highlight: { active: ['exploit', 'scale', 'explore', 'archive', 'gate'], found: ['ship'] },
    explanation: 'The organizational fix is a portfolio. Exploit scaling when it is the best evidenced lever, but preserve structured exploration and archive failed lessons so alternatives can mature.',
  };

  yield {
    state: labelMatrix(
      'Questions before scaling',
      [
        { id: 'metric', label: 'metric' },
        { id: 'data', label: 'data' },
        { id: 'serve', label: 'serving' },
        { id: 'alt', label: 'alts' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'artifact', label: 'artifact' },
      ],
      [
        ['smooth?', 'score curve'],
        ['clean?', 'data audit'],
        ['pays?', 'cost model'],
        ['tested?', 'ablation'],
        ['fair?', 'ledger'],
      ],
    ),
    highlight: { found: ['metric:artifact', 'data:artifact', 'serve:artifact', 'alt:artifact', 'budget:artifact'] },
    explanation: 'A scaling proposal should carry artifacts: score curves, data audits, serving cost models, ablations, and budget ledgers. Those artifacts turn bigger from default answer into justified answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'scaling loop') yield* scalingLoop();
  else if (view === 'escape routes') yield* escapeRoutes();
  else throw new InputError('Pick a scaling local-optimum view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an organizational feedback loop, not as an argument that scale is fake. Active nodes show the reinforced path through metric, paper, funding, cluster, team, and larger model. Compare nodes show bottlenecks that may be real but less visible to the planning system, and found nodes mark the choice the loop has made easy to justify.',
        'The safe inference rule is that a bigger run is evidence only for the bottleneck it attacks. If the failure is dirty data, a discontinuous benchmark, or serving latency, the scale node is not automatically the repair. Follow the escape-route view to see whether a non-scaling lever has its own proof path.',
        {type:'callout', text:`Scaling is a powerful lever that becomes dangerous when the organization treats it as the diagnosis before measuring the bottleneck.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Scaling means increasing model size, training data, compute, context length, or serving capacity. Modern machine learning earned that lever because larger runs often reduced loss and improved useful behavior. The problem starts when the lever becomes the default diagnosis for every weakness.',
        'A local optimum is a choice that looks best from the current position but is not the best possible move overall. In AI organizations, scaling can become locally optimal because clusters, hiring, papers, dashboards, and budget rituals all make the next larger run easy to explain. Other fixes may be better, but they need evidence that is harder to package.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scale the component that already has a clean curve. If benchmark score rises with model size, the next proposal is a bigger model. If longer context helps on a public test, the next proposal is a longer context window.',
        'This approach is not foolish. Scaling laws made compute planning more empirical, and many smaller alternatives are weaker than a well-run scale-up. The mistake is treating a historical trend as proof that the current bottleneck is still capacity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the next unit of scale attacks the wrong constraint. More parameters do not fix mislabeled data, a broken retriever, a bad scorer, or a product flow that asks the model the wrong question. More context can raise cost while hiding that the evidence was never selected well.',
        'Metrics can hide the wall. A thresholded benchmark can turn a smooth probability improvement into an apparent jump. If the public score is discontinuous, scale may look like it caused emergence when the underlying behavior changed gradually.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that scale is one lever in a system of levers. It buys capacity, coverage, and sometimes generality. It does not identify whether the missing value is in data, evaluation, retrieval, architecture, latency, workflow, or unit economics.',
        'Escaping the local optimum requires giving non-scaling paths the same decision quality as scaling paths. Data repair needs slice lift, retrieval needs groundedness gains, architecture needs fair-budget comparison, and serving work needs p99 and cost-per-accepted-answer evidence. A story is not enough to compete with a GPU budget unless it carries measurements.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The scaling loop starts with a metric that rewards larger runs. A larger run creates a paper, demo, or internal win, which justifies funding. Funding buys clusters, clusters shape team skills, and team skills make the next large run easier than an unfamiliar intervention.',
        'The escape route starts with bottleneck triage. Triage means naming the constraint before choosing the lever. A team separates data quality, eval validity, architecture fit, serving cost, and product workflow, then requires a small proof before expanding the intervention.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Scaling works when loss is still capacity-limited under a sane allocation of parameters, tokens, and compute. If the data distribution is broad, labels are usable, and serving economics are acceptable, larger models can buy real capability. The correctness argument is empirical: held-out loss and protected task slices improve under controlled comparisons.',
        'The local-optimum critique works because systems have switching costs. A team with cluster tooling can evaluate scaling faster than it can evaluate a new data program or architecture. Without an explicit bottleneck ledger, the organization keeps improving the thing it can measure while the product constraint may sit elsewhere.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost grows through accelerator hours, network bandwidth, checkpoint storage, failed-run risk, and researcher time. Serving cost grows through memory, decode latency, KV cache size, batching pressure, and power. Doubling parameters can make a model harder to host even if the training curve still looks attractive.',
        'Opportunity cost is a behavior too. A six-week scale run can crowd out data curation, eval repair, distillation, caching, or tool-use design. The practical cost model should compare dollars per accepted answer at target latency, not only loss per training FLOP.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This framing is useful in model-roadmap reviews. A team can ask whether the next quarter should fund pretraining scale, domain data, retrieval, verifier search, quantization, routing, or product workflow changes. The point is to decide with bottleneck evidence instead of prestige.',
        'It also helps benchmark interpretation. If a score improves only after a metric threshold, inspect the continuous signal underneath. If a larger model wins quality but loses cost per accepted answer, the product may need routing or distillation before more scale.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The critique fails when it becomes anti-scaling posture. Sometimes scale is the best-evidenced lever, and refusing it can be worse than overusing it. The right standard is fair comparison, not preference for smaller or larger systems.',
        'Exploration also fails when alternatives do not have gates. A vague data-quality project or architecture experiment can waste time just as easily as an automatic scale-up. Every path needs a budget, a measurement, a holdout, and a decision rule.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a support-agent model answers 78 percent of tickets acceptably at $0.018 per answer with p99 latency of 2.2 seconds. A larger model raises acceptance to 82 percent but costs $0.061 per answer and pushes p99 to 5.8 seconds. A retrieval cleanup raises acceptance to 81 percent at $0.021 per answer because the model stops reading stale policy snippets.',
        'The scaling run is real progress, but it is not the best product move under a 3-second p99 target. The bottleneck was evidence quality, not model capacity. The team should ship retrieval cleanup, keep the larger model for hard-route fallback, and reserve another scale run for slices where retrieval is already clean.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Scaling Laws for Neural Language Models, Training Compute-Optimal Large Language Models, and Are Emergent Abilities of Large Language Models a Mirage. Read them for the difference between useful scaling curves, compute allocation, and metric artifacts. Current model and accelerator economics should be refreshed from live deployment data before making budget claims.',
        'Study Benchmark Variance and Model Selection, LLM Inference Cost Stack, RAG Context Packing Token Budget, Mixture of Experts, distillation, verifier-guided inference, and on-device inference. The practical habit is a pre-scale review: state the bottleneck, compare fair-budget alternatives, and define the post-run decision before spending the run.',
      ],
    },
  ],
};
