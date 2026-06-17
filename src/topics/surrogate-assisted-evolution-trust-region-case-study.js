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
      heading: 'Why this exists',
      paragraphs: [
        'Surrogate-assisted evolution exists because some objective functions are too expensive to call casually. A candidate wing may require a CFD simulation. A robot controller may require a physical trial. A molecule may require a wet-lab assay. A chip layout may require a slow verification run. A model architecture may require hours of training. Plain evolutionary search can burn the budget exploring candidates that a cheaper model could have rejected.',
        'The method keeps the useful part of evolutionary search: generate diverse candidates, mutate, recombine, select, and repeat. It changes how candidates are evaluated. Instead of sending every candidate to the true objective, the system stores an archive of true evaluations, fits a surrogate model on that archive, uses the surrogate to screen many candidates cheaply, and spends true evaluations only on selected infill points.',
        'The trust-region part exists because a surrogate is a proxy, not an oracle. The search loop will push toward places where the surrogate predicts high value. Those are exactly the places where a learned proxy can be wrong. A trust region limits where surrogate recommendations are allowed to guide expensive decisions and uses true evaluation error to expand, shrink, or reset that region.',
      ],
    },
    {
      heading: 'The naive baselines and the wall',
      paragraphs: [
        'The first naive baseline is honest brute force: generate candidates and evaluate each one with the true objective. That is clean and easy to reason about. It also fails when each evaluation costs minutes, hours, specialized hardware, lab capacity, or real-world risk. With a budget of 100 true evaluations, wasting 80 on obviously poor candidates can decide the project.',
        'The opposite naive baseline is to train a cheap predictor once and optimize the predictor as if it were the objective. That feels efficient, but it changes the problem. Evolution is good at exploiting whatever signal it is given. If the surrogate has a blind spot, the population may find candidates that look excellent to the surrogate and fail under the true evaluator.',
        'The wall is proxy error under search pressure. A surrogate can rank ordinary candidates well and still be wrong in the regions created by aggressive optimization. Prediction error is not evenly distributed. It is often largest near constraints, sparse regions, unusual designs, or the apparent optimum. The system needs true evaluations, uncertainty, holdouts, and a policy for how far to trust the model.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate proposing from deciding. The surrogate proposes, ranks, and triages. The true evaluator decides what is real. This lets the algorithm spend cheap computation on broad exploration while preserving a hard boundary around the expensive objective.',
        'The basic loop is: initialize an evaluated archive, fit a surrogate, generate many candidate mutations, score or rank them cheaply, choose infill candidates, run true evaluations, update the archive, audit surrogate error, and repeat. The infill rule may prefer predicted best candidates, high-uncertainty candidates, constraint-boundary candidates, diverse candidates, or a mixture.',
        'This sits between evolutionary search and Bayesian optimization. Evolution supplies population-based variation and global search. The surrogate supplies cheap prediction, uncertainty estimates, or ranking to reduce wasted evaluations. The trust region supplies humility: use the model where it has earned trust, and retreat when measured error grows.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'The archive is the memory of reality. It stores candidate designs, true objective values, constraint outcomes, and sometimes evaluation context such as simulator version or random seed. Every surrogate fit depends on this archive. If the archive is stale, biased, or contaminated by leaked validation tasks, the surrogate inherits those flaws.',
        'The surrogate can be a Gaussian process, random forest, radial-basis model, neural network, ensemble, ranking model, or domain-specific predictor. The exact model is less important than the contract: it must be cheaper than the true evaluator and useful enough to reduce wasted evaluations. Some systems need calibrated uncertainty. Others only need a rough ranking that separates hopeless candidates from plausible ones.',
        'Candidate triage is the decision layer. Pure exploitation chooses the candidates with the best predicted value. Pure exploration chooses candidates where uncertainty is high. Constraint-aware triage samples near feasible boundaries. Diversity-aware triage avoids spending the whole budget on nearly identical candidates. A good infill policy mixes these motives because each one protects against a different failure.',
        'After true evaluation, the loop compares prediction with reality. If predictions were accurate, the trust region may expand or the surrogate may receive more influence. If predictions were poor, the region shrinks, the model retrains, the algorithm samples more uncertain points, or the system resets part of the search. The expensive evaluator remains the final source of truth.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The loop graph proves the separation of roles. The archive feeds the surrogate. The surrogate screens cheap candidates. The acquisition or infill rule chooses which candidates deserve true evaluation. The expensive evaluator updates the archive. The audit path measures whether the surrogate is still trustworthy. The trust region sends that evidence back into future selection.',
        'The prediction plot proves that the surrogate is allowed to be imperfect. Its curve does not have to equal the true objective everywhere. It only needs to improve allocation of scarce true evaluations. The marked next point is a bet: this candidate looks promising or informative enough to spend real budget on.',
        'The trust-region ledger proves that every expensive evaluation should teach two things. It gives a true objective value for the candidate, and it gives an error measurement for the surrogate. A loop that records only the new best score learns less than a loop that also records predicted value, true value, constraint outcome, error, and trust-region action.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness claim is not that the surrogate optimum is the true optimum. The safer claim is budget efficiency: if the surrogate ranking is better than random in parts of the search space, and if true evaluations keep correcting it, the algorithm can reach good candidates with fewer expensive calls than unguided evolution.',
        'Trust regions make that claim more defensible. Local models are often easier to trust than global models. If a surrogate has been accurate near the current region, the algorithm can exploit it nearby. If the measured error grows, shrinking the region reduces the damage from extrapolation. This is the same engineering instinct as numerical optimization trust regions: step farther only after the local model earns it.',
        'The archive also creates a feedback invariant. Every time the true evaluator runs, the system gains a new supervised example in the part of the space the search actually cares about. Over time, the surrogate should improve near promising regions, or the audit should reveal that it is not improving. Either outcome is useful because it changes how the budget is spent.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The method does not make optimization cheap. It adds surrogate training, model selection, feature engineering, uncertainty estimation, acquisition tuning, archive management, and audit policy. If true evaluations are already cheap, these overheads can dominate. A simple evolutionary algorithm or random search may be better when the objective can be evaluated millions of times.',
        'When true evaluations are expensive, the cost behavior changes. The goal is to improve best-found value per true evaluation, not to minimize CPU time spent inside the optimizer. It can be rational to spend thousands of cheap surrogate scores to save one simulation or lab run. The dominant cost is the scarce evaluator, so the algorithm should be judged by expensive calls used, wall-clock schedule, and final validated score.',
        'Memory and provenance matter. The archive should store candidate encoding, true result, prediction at selection time, surrogate version, constraint status, evaluation environment, and split membership. Without that ledger, teams cannot tell whether improvement came from better designs, benchmark leakage, simulator drift, or a surrogate that learned to exploit stale data.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Surrogate-assisted methods win in aerodynamic design, antenna design, robotics controller tuning, materials and molecule search, hyperparameter search, expensive combinatorial optimization, hardware design, and other settings where a true evaluation is scarce. The access pattern is many possible candidates, few affordable true evaluations, and enough structure for a model to learn useful ranking information.',
        'The same pattern appears in AI search systems. A cheap judge, heuristic, or smaller model can triage candidate solutions before a stronger verifier runs. The principle is identical: use a proxy to reduce waste, but keep an expensive trusted check in the loop. The proxy should accelerate search, not become the definition of success.',
        'The main failure mode is proxy takeover. If the surrogate is biased and the evolutionary loop trusts it too much, search finds candidates that fool the surrogate rather than improve the true objective. Other failures include archive drift, constraint blindness, overconfident uncertainty, diversity collapse, simulator-version mismatch, and leakage from benchmark or holdout tasks into surrogate training.',
        'Surrogate assistance is the wrong tool when evaluation is cheap, when the search space representation hides the real structure, when constraints are unknown and dangerous to violate, or when the team cannot afford the audit discipline. It is also weak when the objective is so noisy that the surrogate learns measurement noise instead of useful signal.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Keep the true evaluator in charge. Store an explicit archive. Record predictions before true evaluation so error cannot be rewritten after the fact. Reserve holdout evaluations that the surrogate never trains on. Version the surrogate and the evaluator. Put trust-region actions in a ledger: expand, shrink, hold, reset, or force exploration.',
        'Choose the infill rule to match the risk. If evaluations are costly but safe, the policy can be more exploitative. If constraint violations are dangerous, sample near boundaries carefully and keep conservative feasibility models. If the search space is poorly understood, spend more budget on uncertainty and diversity. A single "pick the predicted best" rule is rarely enough for serious expensive optimization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: pySOT surrogate optimization docs at https://pysot.readthedocs.io/en/latest/surrogate_optimization.html, pySOT repository at https://github.com/dme65/pySOT, Efficient Global Optimization PDF at https://www.ressources-actuarielles.net/EXT/ISFA/1226.nsf/8d48b7680058e977c1256d65003ecbb5/f84f7ac703bf5862c12576d8002f5259/%24FILE/Jones98.pdf, and a 2024 survey on surrogate-assisted evolutionary algorithms at https://link.springer.com/article/10.1007/s40747-024-01465-5. Study Evolutionary Search and CMA-ES for population mechanics, Gaussian Process Bayesian Optimization for acquisition functions and uncertainty, Hyperparameter Search for cheap-to-expensive evaluation ladders, NSGA-II for multi-objective selection, and AlphaEvolve-style systems for proxy-versus-verifier design.',
      ],
    },
  ],
};
