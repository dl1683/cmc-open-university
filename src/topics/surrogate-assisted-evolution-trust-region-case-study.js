// Surrogate-assisted evolution: spend cheap model predictions to triage
// expensive black-box evaluations, then keep the surrogate honest.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'surrogate-assisted-evolution-trust-region-case-study',
  title: 'Surrogate-Assisted Evolution Trust Region',
  category: 'AI & ML',
  summary: 'An expensive-optimization case study: archive true evaluations, fit a surrogate, rank cheap candidates, choose infill points, update trust regions, and audit model error.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['surrogate loop', 'trust region gate'], defaultValue: 'surrogate loop' },
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
      { id: 'archive', label: 'archive', x: 0.7, y: 3.5, note: 'true evals' },
      { id: 'fit', label: 'fit', x: 2.2, y: 2.0, note: 'surrogate' },
      { id: 'cheap', label: 'cheap', x: 3.9, y: 2.0, note: 'screen' },
      { id: 'acq', label: 'acq', x: 5.5, y: 3.5, note: 'infill' },
      { id: 'eval', label: 'eval', x: 7.1, y: 2.0, note: 'expensive' },
      { id: 'audit', label: 'audit', x: 7.1, y: 5.0, note: 'error' },
      { id: 'trust', label: 'trust', x: 8.8, y: 3.5, note: 'region' },
    ],
    edges: [
      { id: 'e-archive-fit', from: 'archive', to: 'fit' },
      { id: 'e-fit-cheap', from: 'fit', to: 'cheap' },
      { id: 'e-cheap-acq', from: 'cheap', to: 'acq' },
      { id: 'e-acq-eval', from: 'acq', to: 'eval' },
      { id: 'e-eval-archive', from: 'eval', to: 'archive' },
      { id: 'e-eval-audit', from: 'eval', to: 'audit' },
      { id: 'e-audit-trust', from: 'audit', to: 'trust' },
      { id: 'e-trust-acq', from: 'trust', to: 'acq' },
    ],
  }, { title });
}

function predictionPlot(title) {
  return plotState({
    axes: { x: { label: 'candidate x', min: 0, max: 10 }, y: { label: 'score', min: 0, max: 10 } },
    series: [
      { id: 'sur', label: 'sur', points: [{ x: 0, y: 2.0 }, { x: 2, y: 4.8 }, { x: 4, y: 6.2 }, { x: 6, y: 5.4 }, { x: 8, y: 7.0 }, { x: 10, y: 6.0 }] },
      { id: 'true', label: 'true', points: [{ x: 1, y: 2.5 }, { x: 3, y: 5.0 }, { x: 5, y: 5.8 }, { x: 7, y: 7.3 }, { x: 9, y: 6.4 }] },
    ],
    markers: [
      { id: 'next', x: 7.5, y: 7.1, label: 'next' },
      { id: 'risk', x: 4.0, y: 6.2, label: 'unc' },
    ],
  }, { title });
}

function* surrogateLoop() {
  yield {
    state: loopGraph('Use cheap predictions to ration expensive evaluations'),
    highlight: { active: ['archive', 'fit', 'cheap', 'acq', 'e-archive-fit', 'e-fit-cheap', 'e-cheap-acq'], found: ['eval'] },
    explanation: 'Surrogate-assisted evolution keeps an archive of true evaluations, fits a cheaper model, uses that model to screen many candidates, and spends the expensive evaluator only on selected infill points.',
    invariant: 'The surrogate proposes; the true evaluator decides.',
  };

  yield {
    state: predictionPlot('The surrogate ranks candidates before true evaluation'),
    highlight: { active: ['sur', 'next'], compare: ['true', 'risk'] },
    explanation: 'The surrogate curve is allowed to be imperfect. Its job is to reduce wasted evaluations by triaging candidates, not to replace the objective permanently.',
  };

  yield {
    state: labelMatrix(
      'Candidate triage',
      [
        { id: 'exploit', label: 'use' },
        { id: 'explore', label: 'learn' },
        { id: 'constraint', label: 'limit' },
        { id: 'diverse', label: 'novel' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['pred+', 'best'],
        ['unc+', 'learn'],
        ['edge', 'safe'],
        ['far', 'diverse'],
      ],
    ),
    highlight: { active: ['exploit:reason', 'explore:reason', 'constraint:reason'], compare: ['diverse:score'] },
    explanation: 'Infill selection balances exploitation, exploration, constraint learning, and diversity. A pure predicted-best policy can get trapped by surrogate error.',
  };

  yield {
    state: loopGraph('True evaluations repair the surrogate'),
    highlight: { active: ['eval', 'archive', 'audit', 'trust', 'e-eval-archive', 'e-eval-audit', 'e-audit-trust'], compare: ['cheap'] },
    explanation: 'Every expensive evaluation updates the archive and audits surrogate error. If the model is wrong, the trust region shrinks, the surrogate retrains, or the policy spends more evaluations on uncertainty.',
  };
}

function* trustRegionGate() {
  yield {
    state: loopGraph('Trust regions keep the surrogate honest'),
    highlight: { active: ['trust', 'acq', 'eval', 'audit', 'e-trust-acq', 'e-acq-eval', 'e-eval-audit'], compare: ['fit'] },
    explanation: 'A trust-region gate limits where surrogate recommendations are allowed to influence expensive decisions. Good predictions can expand the region; bad predictions should shrink it.',
  };

  yield {
    state: labelMatrix(
      'Trust update ledger',
      [
        { id: 'pred', label: 'pred' },
        { id: 'actual', label: 'actual' },
        { id: 'err', label: 'error' },
        { id: 'region', label: 'region' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'action', label: 'action' },
      ],
      [
        ['7.4', 'compare'],
        ['7.0', 'true'],
        ['0.4', 'ok'],
        ['wide', 'expand'],
      ],
    ),
    highlight: { active: ['pred:value', 'actual:value', 'err:action', 'region:action'] },
    explanation: 'The trust update ledger is the safety mechanism. It stores predicted value, true value, model error, constraint result, and whether the search region expands, shrinks, or holds.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'true evals used', min: 0, max: 120 }, y: { label: 'best score', min: 0, max: 10 } },
      series: [
        { id: 'plain', label: 'plain', points: [{ x: 10, y: 2.5 }, { x: 30, y: 4.2 }, { x: 60, y: 5.6 }, { x: 90, y: 6.4 }, { x: 120, y: 7.0 }] },
        { id: 'sur', label: 'sur', points: [{ x: 10, y: 2.5 }, { x: 30, y: 5.2 }, { x: 60, y: 7.0 }, { x: 90, y: 7.5 }, { x: 120, y: 7.7 }] },
      ],
      markers: [
        { id: 'save', x: 60, y: 7.0, label: 'save' },
      ],
    }),
    highlight: { active: ['sur', 'save'], compare: ['plain'] },
    explanation: 'When the surrogate is useful, the same expensive-evaluation budget reaches good candidates sooner. When it is misleading, the audit and trust gate should prevent runaway exploitation.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'bias', label: 'bias' },
        { id: 'unc', label: 'unc' },
        { id: 'drift', label: 'drift' },
        { id: 'leak', label: 'leak' },
      ],
      [
        { id: 'symptom', label: 'sig' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['fake', 'holdout'],
        ['conf', 'explore'],
        ['stale', 'refresh'],
        ['leak', 'split'],
      ],
    ),
    highlight: { active: ['bias:guard', 'unc:guard', 'drift:guard', 'leak:guard'] },
    explanation: 'A surrogate is another model that can overfit. The search needs held-out evaluations, uncertainty sampling, archive freshness checks, and benchmark splits that the surrogate did not shape.',
    invariant: 'Never let a cheap proxy become the final source of truth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'surrogate loop') yield* surrogateLoop();
  else if (view === 'trust region gate') yield* trustRegionGate();
  else throw new InputError('Pick a surrogate-assisted evolution view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Surrogate-assisted evolution is a pattern for expensive black-box optimization. The system stores true evaluations, fits a cheaper surrogate model, uses that surrogate to screen many candidate mutations, and spends the expensive evaluator on a small set of promising or informative candidates.',
        'This sits between Evolutionary Search and Gaussian Process Bayesian Optimization. Evolution supplies population search and variation. The surrogate supplies cheap prediction, uncertainty, or ranking to reduce expensive evaluations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic loop is: initialize an evaluated archive, fit a surrogate, generate many candidates, score or rank them cheaply, choose infill candidates, run true evaluations, update the archive, audit surrogate error, and repeat. The infill rule may prefer predicted best, high uncertainty, constraint boundary points, diverse candidates, or a mix.',
        'Trust-region versions limit where the surrogate can guide decisions. If predictions match true evaluations, the region can expand. If predictions are bad, the region shrinks or the algorithm spends more budget on exploration and model repair.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The goal is not to make optimization cheap; it is to spend expensive evaluations better. The new costs are surrogate training, model selection, uncertainty estimation, and model-management policy. These are worth it when objective calls are costly enough: CFD simulations, hardware design, robotics, wet-lab experiments, or long model-training runs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Surrogate-assisted methods appear in engineering design, combinatorial optimization, hyperparameter search, controller tuning, material and molecule search, antenna design, and other settings where a true evaluation is minutes, hours, or dollars. The same idea appears in AI agent search when a cheap judge triages candidates before a stronger verifier runs.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The failure mode is proxy takeover. If the surrogate is biased and the evolutionary loop trusts it too much, search finds candidates that fool the surrogate rather than the true objective. Keep true evaluations in the loop, audit prediction error, preserve holdout tasks, and version the archive.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: pySOT surrogate optimization docs at https://pysot.readthedocs.io/en/latest/surrogate_optimization.html, pySOT repository at https://github.com/dme65/pySOT, Efficient Global Optimization PDF at https://www.ressources-actuarielles.net/EXT/ISFA/1226.nsf/8d48b7680058e977c1256d65003ecbb5/f84f7ac703bf5862c12576d8002f5259/%24FILE/Jones98.pdf, and a 2024 survey on surrogate-assisted evolutionary algorithms at https://link.springer.com/article/10.1007/s40747-024-01465-5. Study Evolutionary Search, CMA-ES, Gaussian Process Bayesian Optimization, Hyperparameter Search, NSGA-II, and AlphaEvolve next.',
      ],
    },
  ],
};
