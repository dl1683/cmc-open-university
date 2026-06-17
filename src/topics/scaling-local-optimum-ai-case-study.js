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
      heading: 'Why this exists',
      paragraphs: [
        `Scaling is one of the real discoveries of modern machine learning. Bigger models, more data, and more compute have repeatedly improved loss, benchmark performance, and product capability. That success created a planning language: parameter count, token count, FLOPs, cluster size, training run length, and benchmark target. Those numbers are measurable, fundable, and easy to compare. A team can write a proposal around them and stakeholders can understand what is being bought.`,
        `Scaling as a local optimum names the failure mode where "make it bigger" becomes the locally rational next move even when it is not the globally best move. The problem is not that scaling is fake. The problem is that metrics, papers, funding, GPU commitments, hiring pipelines, evaluation rituals, and serving economics can make scaling the default diagnosis. A bottleneck in data quality, evaluation, architecture, latency, workflow, or product design may be real, but scale is the easiest lever to package.`,
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        `The naive approach is to treat every capability gap as a scale gap. If the model misses reasoning tasks, train a larger one. If retrieval fails, increase context length. If latency is high, buy faster accelerators. If a benchmark is just below a threshold, run a bigger experiment. Sometimes this is correct. The wall appears when the next unit of scale attacks the wrong constraint. More parameters do not clean mislabeled data. More context does not fix a bad retriever. More compute does not make a discontinuous metric honest.`,
        `The second naive approach is anti-scaling reflex. That is also wrong. Scaling laws became influential because they were empirically useful allocation tools. Chinchilla was not a rejection of scale; it corrected how compute should be split between model size and training tokens under a fixed budget. The better question is not "scale or no scale?" It is "Which bottleneck does the next dollar attack, and what evidence would prove that it moved?"`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that scaling is a lever, not a diagnosis. It buys capacity: lower training loss, broader memorized coverage, more latent skills, more context, or more throughput. But a product system has many other levers: data curation, retrieval quality, distillation, quantization, routing, caching, architecture, process supervision, verifier search, interface design, and evaluation repair. The local optimum forms when the organization has great machinery for one lever and weak machinery for measuring the others.`,
        `Metric design sharpens the problem. Are Emergent Abilities of Large Language Models a Mirage? argues that nonlinear or discontinuous metrics can make smooth improvement look like a sudden jump. That does not mean every capability jump is fake. It means a thresholded public score may hide the continuous signal underneath. If the metric itself creates the appearance of a cliff, then scaling can look like the only path to "emergence" even when smaller interventions improve the underlying probability.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The scaling loop is a control system. Metrics reward larger runs. Larger runs produce papers, demos, or internal wins. Those wins justify funding. Funding buys clusters. Clusters shape hiring and tooling. The team becomes better at distributed training, benchmark reporting, and cluster utilization. The next proposal naturally reuses that machinery, so the loop returns to a larger model and another metric target. Every step can be locally reasonable.`,
        `The escape route is also a control system. Start with bottleneck triage. Is the failure caused by missing data, noisy labels, stale retrieval, bad evals, weak architecture, serving cost, latency, tool use, or product workflow? For each candidate lever, require proof: slice lift, ablation, groundedness, teacher-gap analysis, router evaluation, p99 cost model, locked holdout, or online guardrail. Alternatives become fundable only when they carry evidence as cleanly as a scale-up proposal carries GPU counts.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The scaling-loop view proves why a path can be rational and limiting at the same time. Metric, paper, funding, cluster, team, bigger model, and back to metric form a reinforcing cycle. The diagram is not an accusation that scale is bad. It shows why scale becomes the path of least resistance once the organization, infrastructure, and status system are aligned around it.`,
        `The escape-routes view proves that leaving the local optimum requires a comparable artifact economy. Data, evaluation, architecture, serving, and product design are not slogans. Each branch must produce evidence before rollout. The evidence ladder turns an alternative from a story into a decision object: mechanism, toy test, ablation, fair-budget comparison, holdout result, online lift, and monitoring plan.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Scaling works when the bottleneck really is capacity under a sane allocation. If the data distribution is broad, the labels are usable, the metric is smooth enough to guide learning, and the product can afford inference, larger models and more tokens can buy real capability. Scaling laws help teams forecast returns, compare runs, and avoid pure guesswork. Chinchilla shows that even inside scaling, allocation matters: model size and training data must be balanced under the compute budget.`,
        `The local-optimum critique works because systems have switching costs. A company that has invested in clusters, distributed training, data pipelines, and benchmark rituals can evaluate scale faster than it can evaluate unfamiliar research paths. That speed becomes a bias. Without explicit bottleneck ledgers and fair comparisons, the organization may keep improving the thing it knows how to improve while the actual product constraint sits elsewhere.`,
      ],
    },
    {
      heading: 'Tradeoffs and cost',
      paragraphs: [
        `The obvious cost is training spend, but that is only the first line. Scale can raise inference cost, memory pressure, energy use, p99 latency, networking complexity, failure blast radius, data-center dependency, and release risk. A model that is compute-optimal to train can be uneconomic to serve. Decode latency, KV cache memory, routing, batching, quantization, and context length all decide whether capability turns into a product that can be used at acceptable cost.`,
        `There is also an opportunity cost. A large run can consume months of attention and make smaller alternatives look unserious because their artifacts are less legible. Better evals may be cheaper than a bigger model, but they do not produce a parameter count. Data curation may raise a weak slice, but it lacks the drama of a frontier run. The practical fix is not rhetoric; it is a portfolio with reserved budget for evidence-gated non-scaling work.`,
      ],
    },
    {
      heading: 'Uses and failure modes',
      paragraphs: [
        `This framing is useful for research planning, model-roadmap reviews, infrastructure investment, product architecture, benchmark interpretation, and postmortems after expensive runs. It helps a team ask whether a proposal attacks training loss, data coverage, task format, retrieval, inference economics, or user workflow. It also helps compare scale with RAG, distillation, MoE, caching, verifier search, on-device inference, tool use, or domain-specific smaller models.`,
        `The failure mode is using "local optimum" as a fashionable way to reject scale. Sometimes scale is the best evidenced lever. Another failure is under-instrumented exploration: a team funds alternatives but never defines gates, so every path becomes storytelling. A third failure is bad metric accounting. If the benchmark is a proxy artifact, a scale-up can win the leaderboard while leaving product value flat. If serving cost is ignored, a research win can become an economic loss.`,
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        `Scaling Laws for Neural Language Models found empirical power-law relationships between loss and model size, dataset size, and training compute, making scale a predictable planning tool: https://arxiv.org/abs/2001.08361. Chinchilla showed that many large models were undertrained for their size and that compute-optimal training should scale model size and tokens together: https://arxiv.org/abs/2203.15556.`,
        `Are Emergent Abilities of Large Language Models a Mirage? argues that nonlinear or discontinuous metrics can create apparent sharp emergence from smoothly improving outputs: https://arxiv.org/abs/2304.15004 and https://openreview.net/forum?id=ITw9edRDlD. The growing influence of industry in AI research analyzes how industry increasingly dominates compute, data, and talent inputs: https://ide.mit.edu/wp-content/uploads/2023/03/0303PolicyForum_Ai_FF-2.pdf.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Scaling Laws through Batch Size Scaling for the training-side allocation problem, Benchmark Variance and Model Selection for metric uncertainty, AI Engineering Stack: Five Parts Primer for the full system boundary, LLM Inference Cost Stack Case Study and LLM Unit Economics Ledger Case Study for serving economics, Mixture of Experts for conditional capacity, RAG Context Packing Token Budget for evidence use, On-Device LLM Inference Cost Crossover for deployment constraints, and Process Reward Models and Verifier Search for non-scaling reasoning levers.`,
        `The durable practice is a pre-scale review. Demand a bottleneck statement, a metric curve that exposes continuous signals when possible, a data audit, a serving cost model, a fair-budget comparison with alternatives, and a post-run decision rule. Then scale when scale wins. The point is not to escape scale; it is to escape automatic scale.`,
      ],
    },
  ],
};
