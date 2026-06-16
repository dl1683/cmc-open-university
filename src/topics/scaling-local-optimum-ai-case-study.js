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
    explanation: 'Scaling is powerful because it is measurable, fundable, repeatable, and infrastructure-friendly. Those strengths can become a loop: benchmarks reward scale, funding buys clusters, teams specialize around clusters, and the next proposal is another scale-up.',
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
    explanation: 'Bigger can buy real capability, but the ledger must include what it hides: serving cost, data quality, energy, p99, bad proxies, and product economics.',
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
    explanation: 'The mirage paper shows the danger of nonlinear or discontinuous metrics. A smooth improvement in underlying probability can look like a sudden emergent jump when the score is thresholded.',
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
    explanation: 'The escape from a local optimum is not anti-scaling. It is bottleneck triage: identify whether the next gain should come from data, evaluation, architecture, serving, or product design.',
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
      heading: 'What it is',
      paragraphs: [
        'Scaling as a local optimum means "make it bigger" is often the locally rational next move even when it is not the globally best research or product move. Scaling is not fake. Scaling laws showed that language-model loss can improve predictably with parameters, data, and compute. The problem begins when metrics, funding, infrastructure, hiring, publication incentives, and serving economics make scaling the default diagnosis for every bottleneck.',
        'The local source notes frame this as an incentive loop: scaling is measurable, easy to fund, easy to schedule, compatible with existing GPU clusters, and legible to stakeholders. This case study turns that argument into data structures: scaling ledgers, metric curves, infrastructure loops, evidence gates, and alternative-lever maps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A scale-up proposal usually has clean artifacts: more parameters, more tokens, more GPUs, a benchmark target, and a timeline. That clarity is useful. But it can crowd out alternatives whose evidence is harder to package: better data curation, retrieval, distillation, a new architecture, on-device routing, better evaluation, or a product workflow that changes the task.',
        'The sharpest technical warning is metric choice. Are Emergent Abilities of Large Language Models a Mirage? argues that some apparent sharp jumps can arise from nonlinear or discontinuous metrics applied to smoothly improving model behavior. That does not mean all capability changes are fake. It means benchmark curves should show underlying continuous signals when possible, not only thresholded pass/fail headlines.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scaling costs more than training dollars. It can raise inference cost, memory pressure, energy use, p99 latency, operational complexity, and platform lock-in. It can also consume the organization: teams hire around distributed training, buy long-lead hardware, tune tooling around one stack, and then naturally choose proposals that reuse the stack. The path becomes cheaper to choose because the organization already paid for it.',
        'Chinchilla is the useful correction to naive scale talk. Under a fixed compute budget, model size and training tokens should be balanced. That is already a systems allocation lesson, not a slogan. LLM Inference Cost Stack Case Study then adds the serving side: a model that is compute-optimal to train can still be expensive to serve if decode, KV cache, latency, or routing economics break the product.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Scaling Laws for Neural Language Models found empirical power-law relationships between loss and model size, dataset size, and training compute, making scale a predictable planning tool: https://arxiv.org/abs/2001.08361. Chinchilla showed that many large models were undertrained for their size and that compute-optimal training should scale model size and tokens together: https://arxiv.org/abs/2203.15556.',
        'Are Emergent Abilities of Large Language Models a Mirage? argues that nonlinear or discontinuous metrics can create apparent sharp emergence from smoothly improving outputs: https://arxiv.org/abs/2304.15004 and https://openreview.net/forum?id=ITw9edRDlD. The growing influence of industry in AI research analyzes how industry increasingly dominates compute, data, and talent inputs: https://ide.mit.edu/wp-content/uploads/2023/03/0303PolicyForum_Ai_FF-2.pdf.',
      ],
    },
    {
      heading: 'Escape routes',
      paragraphs: [
        'The escape is not refusing scale. It is bottleneck triage. If data is weak, curate and audit slices. If the metric is a bad proxy, redesign the eval before increasing compute. If serving cost is the wall, use caching, distillation, quantization, retrieval, or on-device routing. If reasoning depth is the wall, test verifier search or process supervision. If exploration is the wall, fund small evidence-gated bets outside the dominant stack.',
        'Good alternatives carry proof. RAG needs groundedness and citation tests. MoE needs router and load-balance evaluation, not only parameter count. Distillation needs teacher-gap and slice checks. On-device inference needs device-class evals and update controls. Self-organizing or open-ended approaches need held-out perturbation and transfer evidence. Search-based systems need locked holdouts so they do not Goodhart the evaluator.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Scaling Laws through Batch Size Scaling, Benchmark Variance & Model Selection, AI Engineering Stack: Five Parts Primer, LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, LLM Inference Scaling Playbook, Mixture of Experts, RAG Context Packing Token Budget, On-Device LLM Inference Cost Crossover, Self-Organizing AI Design Pattern, Process Reward Models & Verifier Search, and AlphaEvolve Case Study. The durable skill is asking which bottleneck the next dollar actually attacks.',
      ],
    },
  ],
};
