// Verifier-guided inference as a production control plane: score traces, choose
// actions, bound search, and preserve an audit trail for every accepted answer.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'verifier-guided-inference-control-plane-case-study',
  title: 'Verifier-Guided Inference Control Plane Case Study',
  category: 'Systems',
  summary: 'A production case study for verifier-guided inference: score traces, terminate bad branches, repair weak answers, cap search, and audit every route.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['route decisions', 'cost frontier'], defaultValue: 'route decisions' },
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

function decisionGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.6, y: 3.8, note: 'task' },
      { id: 'gen', label: 'gen', x: 2.1, y: 3.8, note: 'drafts' },
      { id: 'trace', label: 'trace', x: 3.6, y: 3.8, note: 'steps' },
      { id: 'verify', label: 'verify', x: 5.2, y: 3.8, note: 'score' },
      { id: 'policy', label: 'policy', x: 6.7, y: 3.8, note: 'rules' },
      { id: 'stop', label: 'stop', x: 8.1, y: 1.5, note: 'ship' },
      { id: 'branch', label: 'branch', x: 8.1, y: 3.1, note: 'more' },
      { id: 'repair', label: 'repair', x: 8.1, y: 4.7, note: 'fix' },
      { id: 'human', label: 'human', x: 8.1, y: 6.2, note: 'esc' },
      { id: 'answer', label: 'answer', x: 9.7, y: 3.0, note: 'final' },
      { id: 'ledger', label: 'ledger', x: 9.7, y: 5.4, note: 'audit' },
    ],
    edges: [
      { id: 'e-request-gen', from: 'request', to: 'gen' },
      { id: 'e-gen-trace', from: 'gen', to: 'trace' },
      { id: 'e-trace-verify', from: 'trace', to: 'verify' },
      { id: 'e-verify-policy', from: 'verify', to: 'policy' },
      { id: 'e-policy-stop', from: 'policy', to: 'stop' },
      { id: 'e-policy-branch', from: 'policy', to: 'branch' },
      { id: 'e-policy-repair', from: 'policy', to: 'repair' },
      { id: 'e-policy-human', from: 'policy', to: 'human' },
      { id: 'e-stop-answer', from: 'stop', to: 'answer' },
      { id: 'e-human-answer', from: 'human', to: 'answer' },
      { id: 'e-branch-gen', from: 'branch', to: 'gen', weight: 'fanout' },
      { id: 'e-repair-gen', from: 'repair', to: 'gen', weight: 'patch' },
      { id: 'e-policy-ledger', from: 'policy', to: 'ledger' },
      { id: 'e-answer-ledger', from: 'answer', to: 'ledger' },
    ],
  }, { title });
}

function budgetGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.8, note: 'input' },
      { id: 'budget', label: 'budget', x: 2.4, y: 3.8, note: 'cap' },
      { id: 'cache', label: 'cache', x: 4.0, y: 1.8, note: 'hit' },
      { id: 'cheap', label: 'cheap', x: 4.0, y: 3.2, note: 'small' },
      { id: 'strong', label: 'strong', x: 4.0, y: 4.8, note: 'large' },
      { id: 'verify', label: 'verify', x: 5.9, y: 3.8, note: 'score' },
      { id: 'audit', label: 'audit', x: 7.5, y: 2.5, note: 'why' },
      { id: 'answer', label: 'answer', x: 7.5, y: 5.0, note: 'ship' },
      { id: 'metrics', label: 'metrics', x: 9.3, y: 3.8, note: 'learn' },
    ],
    edges: [
      { id: 'e-prompt-budget', from: 'prompt', to: 'budget' },
      { id: 'e-budget-cache', from: 'budget', to: 'cache' },
      { id: 'e-budget-cheap', from: 'budget', to: 'cheap' },
      { id: 'e-budget-strong', from: 'budget', to: 'strong' },
      { id: 'e-cache-verify', from: 'cache', to: 'verify' },
      { id: 'e-cheap-verify', from: 'cheap', to: 'verify' },
      { id: 'e-strong-verify', from: 'strong', to: 'verify' },
      { id: 'e-verify-audit', from: 'verify', to: 'audit' },
      { id: 'e-verify-answer', from: 'verify', to: 'answer' },
      { id: 'e-audit-metrics', from: 'audit', to: 'metrics' },
      { id: 'e-answer-metrics', from: 'answer', to: 'metrics' },
    ],
  }, { title });
}

function* routeDecisions() {
  yield {
    state: decisionGraph('A verifier control plane wraps generation'),
    highlight: { active: ['request', 'gen', 'trace', 'verify', 'policy', 'e-request-gen', 'e-gen-trace', 'e-trace-verify', 'e-verify-policy'], compare: ['answer'], found: ['ledger'] },
    explanation: 'The generator is no longer the whole product. Each candidate answer is packaged as a trace, scored by one or more verifiers, then routed by a policy that can ship, branch, repair, or escalate.',
    invariant: 'The production object is the route decision, not just the model output.',
  };

  yield {
    state: labelMatrix(
      'Verifier decision packet',
      [
        { id: 'trace', label: 'trace' },
        { id: 'scores', label: 'scores' },
        { id: 'thresh', label: 'thresholds' },
        { id: 'action', label: 'action' },
        { id: 'proof', label: 'evidence' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['step ids', 'replay'],
        ['quality+cost', 'rank paths'],
        ['risk bands', 'choose route'],
        ['stop/repair', 'bound work'],
        ['source links', 'prove claim'],
        ['route log', 'debug drift'],
      ],
    ),
    highlight: { active: ['trace:value', 'scores:value', 'thresh:value', 'action:value', 'proof:value'], found: ['audit:why'] },
    explanation: 'A useful verifier is not a single scalar. The packet needs trace ids, score vectors, threshold bands, an allowed action set, evidence pointers, and a durable route log.',
  };

  yield {
    state: decisionGraph('Scores become explicit actions'),
    highlight: { active: ['verify', 'policy', 'stop', 'branch', 'repair', 'human', 'e-verify-policy', 'e-policy-stop', 'e-policy-branch', 'e-policy-repair', 'e-policy-human'], found: ['ledger'] },
    explanation: 'The policy layer makes the inference loop auditable. High confidence can stop. Low diversity can branch. A localized flaw can repair. High stakes or low evidence can escalate.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'verifier confidence', min: 0, max: 1 }, y: { label: 'extra compute budget', min: 0, max: 10 } },
      series: [
        { id: 'budget', label: 'budget', points: [
          { x: 0.05, y: 9 }, { x: 0.18, y: 8 }, { x: 0.32, y: 6 }, { x: 0.52, y: 4 }, { x: 0.72, y: 2 }, { x: 0.9, y: 0.5 },
        ] },
      ],
      markers: [
        { id: 'human', x: 0.12, y: 8.5, label: 'human' },
        { id: 'repair', x: 0.45, y: 4.8, label: 'repair' },
        { id: 'stop', x: 0.86, y: 1.0, label: 'stop' },
      ],
    }),
    highlight: { active: ['budget', 'repair'], compare: ['human'], found: ['stop'] },
    explanation: 'The clean version is a threshold policy: spend more when confidence is low or risk is high, spend less when the verifier is strong, and make the thresholds visible enough to tune.',
  };

  yield {
    state: decisionGraph('Repair loops need hard caps'),
    highlight: { active: ['repair', 'gen', 'trace', 'verify', 'policy', 'e-policy-repair', 'e-repair-gen', 'e-gen-trace', 'e-trace-verify'], removed: ['branch'], found: ['ledger'] },
    explanation: 'Repair is useful only when it is bounded. Store attempt count, remaining budget, verifier version, and the exact reason for the repair. Otherwise a verifier can create an expensive loop with better-looking text and no better answer.',
  };

  yield {
    state: labelMatrix(
      'Domain routes',
      [
        { id: 'math', label: 'math' },
        { id: 'code', label: 'code' },
        { id: 'legal', label: 'legal' },
        { id: 'rag', label: 'RAG' },
        { id: 'chat', label: 'chat' },
      ],
      [
        { id: 'verifier', label: 'verifier' },
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['PRM', 'rerank', 'misrank'],
        ['tests', 'run suite', 'oracle gap'],
        ['rules', 'escalate', 'false OK'],
        ['cite check', 'repair', 'stale src'],
        ['judge', 'stop', 'style bias'],
      ],
    ),
    highlight: { active: ['math:verifier', 'code:verifier', 'legal:verifier', 'rag:verifier'], compare: ['chat:risk'] },
    explanation: 'The right verifier depends on the domain. Math can use process rewards, code can use executable tests, legal workflows need rules and citations, and RAG needs support checks against sources.',
  };
}

function* costFrontier() {
  yield {
    state: plotState({
      axes: { x: { label: 'inference calls', min: 1, max: 32 }, y: { label: 'accepted quality', min: 0.45, max: 0.95 } },
      series: [
        { id: 'single', label: 'single', points: [{ x: 1, y: 0.62 }, { x: 4, y: 0.63 }, { x: 8, y: 0.63 }, { x: 16, y: 0.63 }, { x: 32, y: 0.63 }] },
        { id: 'vote', label: 'vote', points: [{ x: 1, y: 0.62 }, { x: 4, y: 0.70 }, { x: 8, y: 0.75 }, { x: 16, y: 0.78 }, { x: 32, y: 0.79 }] },
        { id: 'verify', label: 'verify', points: [{ x: 1, y: 0.62 }, { x: 4, y: 0.74 }, { x: 8, y: 0.82 }, { x: 16, y: 0.86 }, { x: 32, y: 0.87 }] },
        { id: 'oracle', label: 'oracle', points: [{ x: 1, y: 0.64 }, { x: 4, y: 0.80 }, { x: 8, y: 0.88 }, { x: 16, y: 0.91 }, { x: 32, y: 0.92 }] },
      ],
      markers: [
        { id: 'knee', x: 8, y: 0.82, label: 'knee' },
        { id: 'cap', x: 16, y: 0.86, label: 'cap' },
      ],
    }),
    highlight: { active: ['verify', 'knee'], compare: ['single', 'vote'], found: ['oracle'] },
    explanation: 'Verifier-guided inference should be evaluated as a frontier: quality per call, latency, and risk reduction. If the curve has a knee, cap the fanout and spend the next dollar on better data or calibration.',
  };

  yield {
    state: labelMatrix(
      'Search ledger',
      [
        { id: 'cand', label: 'candidate' },
        { id: 'step', label: 'step' },
        { id: 'score', label: 'score' },
        { id: 'cost', label: 'cost' },
        { id: 'status', label: 'status' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['answer id', 'dedupe'],
        ['trace span', 'localize bug'],
        ['vector', 'rank path'],
        ['tokens+ms', 'stop budget'],
        ['live/pruned', 'replay'],
        ['test/cite', 'audit'],
      ],
    ),
    highlight: { active: ['cand:stores', 'step:stores', 'score:stores', 'cost:stores', 'proof:stores'], found: ['status:why'] },
    explanation: 'Search needs a ledger, not just a list of strings. The system should know why each candidate is alive, pruned, repaired, or accepted, and how much budget it has consumed.',
  };

  yield {
    state: budgetGraph('The budget manager owns fanout'),
    highlight: { active: ['prompt', 'budget', 'cache', 'cheap', 'strong', 'verify', 'e-prompt-budget', 'e-budget-cache', 'e-budget-cheap', 'e-budget-strong'], found: ['audit', 'metrics'] },
    explanation: 'The budget manager is the guardrail against unbounded test-time scaling. It decides whether to reuse cache, try a cheap pass, call a strong model, or allocate verifier-guided search.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sample size', min: 1, max: 128 }, y: { label: 'success rate', min: 0.45, max: 0.9 } },
      series: [
        { id: 'repeat', label: 'repeat', points: [{ x: 1, y: 0.58 }, { x: 8, y: 0.66 }, { x: 32, y: 0.73 }, { x: 64, y: 0.77 }, { x: 128, y: 0.80 }] },
        { id: 'weak', label: 'weak check', points: [{ x: 1, y: 0.58 }, { x: 8, y: 0.72 }, { x: 32, y: 0.76 }, { x: 64, y: 0.74 }, { x: 128, y: 0.70 }] },
        { id: 'strong', label: 'strong', points: [{ x: 1, y: 0.58 }, { x: 8, y: 0.75 }, { x: 32, y: 0.83 }, { x: 64, y: 0.86 }, { x: 128, y: 0.88 }] },
      ],
      markers: [
        { id: 'flaw', x: 64, y: 0.74, label: 'prune error' },
      ],
    }),
    highlight: { active: ['weak', 'flaw'], compare: ['repeat'], found: ['strong'] },
    explanation: 'A weak verifier can beat repeated sampling at small budgets and lose at large budgets by pruning valid paths. This is why verifier-guided search needs calibration, diversity, and held-out stress tests.',
    invariant: 'Search amplifies the verifier, including its mistakes.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'misrank', label: 'misrank' },
        { id: 'stop', label: 'false stop' },
        { id: 'overfit', label: 'overfit' },
        { id: 'drift', label: 'drift' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['bad path wins', 'pair evals'],
        ['valid path cut', 'keep sample'],
        ['games judge', 'holdout'],
        ['slice fails', 'calibrate'],
        ['p99 spike', 'route cap'],
      ],
    ),
    highlight: { active: ['misrank:control', 'stop:control', 'drift:control', 'latency:control'], compare: ['overfit:symptom'] },
    explanation: 'Production failures are usually mundane: the verifier misranks, stops too early, overfits a rubric, drifts on a slice, or consumes enough latency to erase the quality win.',
  };

  yield {
    state: budgetGraph('Exit metrics close the loop'),
    highlight: { active: ['verify', 'audit', 'answer', 'metrics', 'e-verify-audit', 'e-verify-answer', 'e-audit-metrics', 'e-answer-metrics'], compare: ['cheap', 'strong'], found: ['budget'] },
    explanation: 'The loop should ship only when accepted-answer quality rises, cost per accepted answer falls, p99 stays inside target, protected slices do not regress, and route logs explain every expensive decision.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'route decisions') yield* routeDecisions();
  else if (view === 'cost frontier') yield* costFrontier();
  else throw new InputError('Pick a verifier-control-plane view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Verifier-guided inference is a production control plane around generation. The model proposes candidate answers or reasoning traces. Verifiers score those candidates. A policy turns scores into actions: accept, branch, repair, terminate, fall back, or escalate. That makes inference scaling a routing problem instead of a blind request for more samples.',
        'The local Inference Scaling notes in the provided corpus name verifiers as a Tier 3 lever for agentic and legal systems: reward or scoring models can prune, stop, or redirect generations after lower-level serving wins have already been captured. This topic separates that operational pattern from the narrower process-reward-model primer.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'A robust verifier loop needs more than a final score. The decision packet should include candidate id, trace spans, score vector, score source, calibration band, threshold policy, domain risk, evidence refs, allowed actions, remaining budget, route reason, verifier version, and audit id. Those fields let the system replay why one answer shipped and another branch was pruned.',
        'The search ledger is the companion structure. Each candidate is live, pruned, repaired, accepted, or escalated. Each transition records token cost, latency cost, verifier scores, evidence pointers, and the policy rule that fired. Without that ledger, test-time scaling becomes expensive folklore.',
      ],
    },
    {
      heading: 'Complete case study: legal research agent',
      paragraphs: [
        'Suppose a legal research agent drafts an answer with citations. A cheap first pass builds candidate claims and source links. A citation verifier checks whether each claim is supported. A policy verifier checks jurisdiction, recency, and risk class. A process verifier checks whether the reasoning path depends on an unsupported premise. The route policy can accept low-risk supported claims, repair missing citations, branch on contradictory authority, or escalate high-risk conclusions.',
        'The important engineering point is that every action is explicit. A false stop can hide the only valid branch. A weak citation checker can approve a polished hallucination. An unbounded repair loop can increase cost while only changing style. The control plane therefore caps attempts, keeps at least some diversity alive, records route reasons, and audits high-stakes answers after deployment.',
      ],
    },
    {
      heading: 'Research case studies',
      paragraphs: [
        'Process Reward Models & Verifier Search covers the training-side idea: process supervision labels intermediate steps and can outperform outcome-only supervision on mathematical reasoning. OpenAI\'s Let\'s Verify Step by Step reports that process supervision outperformed outcome supervision on the MATH setting and released PRM800K with 800,000 step-level labels: https://arxiv.org/abs/2305.20050 and https://github.com/openai/prm800k.',
        'Tree of Thoughts turns language-model inference into deliberate search over thought units rather than one greedy path: https://arxiv.org/abs/2305.10601. Self-Consistency samples diverse reasoning paths and selects the most consistent final answer: https://arxiv.org/abs/2203.11171. Reward-Guided Tree Search for Inference Time Alignment, also called DARWIN, uses a reward model to guide inference-time search: https://aclanthology.org/2025.naacl-long.625/ and https://arxiv.org/abs/2406.15193.',
        'Newer work also clarifies the danger. Scaling Flaws of Verifier-Guided Search finds that verifier-guided search can outperform repeated sampling at limited sample sizes but underperform as sample size grows when imperfect verifiers misrank or prune valid paths: https://arxiv.org/abs/2502.00271. Rewarding Progress reframes process rewards as progress signals and reports process advantage verifiers that improve test-time search efficiency over outcome reward models: https://arxiv.org/abs/2410.08146.',
      ],
    },
    {
      heading: 'Pitfalls and controls',
      paragraphs: [
        'The main pitfall is Goodharting the verifier. If the generator learns phrases that the verifier likes, search can amplify a scoring flaw. If the verifier is uncalibrated, threshold rules can stop too early or overspend. If the verifier is out of distribution, it can confidently prune the only correct path. Calibration Curves, Threshold Optimization, Uncertainty Quantification, and Benchmark Variance Model Selection are not optional side topics; they are the measurement layer for this control plane.',
        'The second pitfall is latency laundering. A verifier may reduce invalid outputs while increasing p99, token spend, and operational complexity. The exit metric should be cost per accepted answer at target latency and protected quality slices, not verifier score alone.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Process Reward Models & Verifier Search, Self-Consistency Reasoning Vote, Chain of Draft Reasoning Token Budget Case Study, Tree of Thoughts Search Case Study, Monte Carlo Tree Search & UCT Primer, LLM Inference Scaling Playbook, Early-Exit Transformer Layer Skipping, Speculative Decoding, Constrained Decoding, Calibration Curves, Picking a Threshold with Real Costs, Uncertainty Quantification, LLM Evaluation Harnesses, Agentic AI Patterns, Deep Research Agent Architecture, Deep Research Evaluation Harness Case Study, Execution-as-a-Service Verifier Economy, Claim Graph & Source Ledger, and Distributed Tracing next.',
      ],
    },
  ],
};
