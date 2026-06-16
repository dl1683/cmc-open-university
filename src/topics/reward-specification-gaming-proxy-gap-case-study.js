// Reward specification gaming: the proxy reward rises while intended task
// success, event facts, and safety checks diverge.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'reward-specification-gaming-proxy-gap-case-study',
  title: 'Reward Specification Gaming Proxy Gap Case Study',
  category: 'AI & ML',
  summary: 'A reward-hacking primer: optimization pressure exploits proxy gaps, evaluator loopholes, hidden state, simulator bugs, and shortcut rewards unless event facts and audit gates catch them.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['proxy loop', 'audit gate'], defaultValue: 'proxy loop' },
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

function proxyGraph(title, { hacked = false } = {}) {
  return graphState({
    nodes: [
      { id: 'intent', label: 'intent', x: 0.8, y: 2.0, note: 'goal' },
      { id: 'proxy', label: 'proxy', x: 2.5, y: 2.0, note: hacked ? 'gap' : 'metric' },
      { id: 'policy', label: 'policy', x: 4.2, y: 3.5, note: 'opt' },
      { id: 'env', label: 'env', x: 5.9, y: 3.5, note: 'world' },
      { id: 'reward', label: 'reward', x: 7.5, y: 2.0, note: hacked ? 'high' : 'score' },
      { id: 'facts', label: 'facts', x: 7.5, y: 5.0, note: 'events' },
      { id: 'audit', label: 'audit', x: 9.2, y: 3.5, note: hacked ? 'catch' : 'check' },
      { id: 'shortcut', label: 'shortcut', x: 4.2, y: 6.0, note: hacked ? 'used' : 'latent' },
    ],
    edges: [
      { id: 'e-intent-proxy', from: 'intent', to: 'proxy', weight: 'spec' },
      { id: 'e-proxy-policy', from: 'proxy', to: 'policy', weight: 'train' },
      { id: 'e-policy-env', from: 'policy', to: 'env', weight: 'act' },
      { id: 'e-env-reward', from: 'env', to: 'reward', weight: 'score' },
      { id: 'e-env-facts', from: 'env', to: 'facts', weight: 'log' },
      { id: 'e-reward-policy', from: 'reward', to: 'policy', weight: 'grad' },
      { id: 'e-policy-shortcut', from: 'policy', to: 'shortcut', weight: hacked ? 'exploit' : 'maybe' },
      { id: 'e-shortcut-env', from: 'shortcut', to: 'env', weight: 'loophole' },
      { id: 'e-reward-audit', from: 'reward', to: 'audit', weight: 'proxy' },
      { id: 'e-facts-audit', from: 'facts', to: 'audit', weight: 'truth' },
    ],
  }, { title });
}

function* proxyLoop() {
  yield {
    state: proxyGraph('A reward is a proxy for intent'),
    highlight: { active: ['intent', 'proxy', 'policy', 'env', 'reward', 'e-intent-proxy', 'e-proxy-policy', 'e-env-reward'], compare: ['facts'] },
    explanation: 'The designer wants an outcome, but the agent receives a reward proxy. The gap between intent and proxy is where specification gaming lives.',
  };

  yield {
    state: proxyGraph('Optimization searches for loopholes', { hacked: true }),
    highlight: { active: ['policy', 'shortcut', 'env', 'reward', 'e-policy-shortcut', 'e-shortcut-env', 'e-env-reward'], compare: ['intent'] },
    explanation: 'A capable optimizer can find a shortcut that scores well without accomplishing the intended task. The behavior can look clever because it is optimizing exactly what was measured.',
    invariant: 'When a proxy becomes the target, the system is allowed to break your interpretation of the proxy.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training', min: 0, max: 10 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'proxy', label: 'proxy', points: [{ x: 0, y: 20 }, { x: 2, y: 39 }, { x: 4, y: 61 }, { x: 6, y: 82 }, { x: 8, y: 95 }] },
        { id: 'task', label: 'task', points: [{ x: 0, y: 20 }, { x: 2, y: 34 }, { x: 4, y: 43 }, { x: 6, y: 39 }, { x: 8, y: 31 }] },
      ],
      markers: [
        { id: 'gap', x: 6, y: 60, label: 'gap' },
      ],
    }),
    highlight: { active: ['proxy', 'gap'], compare: ['task'] },
    explanation: 'Reward hacking is visible when proxy reward rises while task success, hidden tests, human review, or downstream quality stalls or falls.',
  };

  yield {
    state: labelMatrix(
      'Common proxy gaps',
      [
        { id: 'score', label: 'score' },
        { id: 'sim', label: 'sim' },
        { id: 'judge', label: 'judge' },
        { id: 'cost', label: 'cost' },
        { id: 'hide', label: 'hide' },
      ],
      [
        { id: 'shortcut', label: 'gap' },
        { id: 'control', label: 'ctl' },
      ],
      [
        ['farm', 'cap'],
        ['bug', 'patch'],
        ['style', 'facts'],
        ['cheap', 'quality'],
        ['tamper', 'audit'],
      ],
    ),
    highlight: { active: ['score:shortcut', 'sim:shortcut', 'judge:shortcut'], found: ['hide:control'] },
    explanation: 'The gaps repeat across domains: farm the visible score, exploit simulator quirks, please the judge stylistically, minimize cost by skipping useful work, or hide failure from the evaluator.',
  };
}

function* auditGate() {
  yield {
    state: proxyGraph('Audit compares reward against event facts'),
    highlight: { active: ['reward', 'facts', 'audit', 'e-reward-audit', 'e-facts-audit'], compare: ['policy'] },
    explanation: 'The audit should read raw event facts, not only the scalar reward. It checks what happened, which proxy fields fired, and whether hidden outcomes match the intended task.',
  };

  yield {
    state: labelMatrix(
      'Reward audit schema',
      [
        { id: 'intent', label: 'intent' },
        { id: 'proxy', label: 'proxy' },
        { id: 'event', label: 'event' },
        { id: 'slice', label: 'slice' },
        { id: 'hold', label: 'hold' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['goal', 'truth'],
        ['terms', 'debug'],
        ['facts', 'audit'],
        ['case', 'coverage'],
        ['hidden', 'anti-game'],
      ],
    ),
    highlight: { active: ['intent:stores', 'proxy:stores', 'event:stores'], found: ['hold:why'] },
    explanation: 'A reward audit row stores the intended goal, proxy formula, raw event fields, slice labels, holdout checks, and why the reward should be trusted for that slice.',
    invariant: 'A reward scalar without provenance is not an audit trail.',
  };

  yield {
    state: proxyGraph('Adversarial evals probe for shortcut policies', { hacked: true }),
    highlight: { active: ['shortcut', 'facts', 'audit', 'e-shortcut-env', 'e-facts-audit'], compare: ['reward'] },
    explanation: 'Adversarial tests deliberately create situations where the proxy is easy to satisfy and the intended task is not. Passing those tests is stronger evidence than high reward on the training environment.',
  };

  yield {
    state: labelMatrix(
      'Release decision',
      [
        { id: 'proxy', label: 'proxy' },
        { id: 'task', label: 'task' },
        { id: 'adv', label: 'adv' },
        { id: 'drift', label: 'drift' },
        { id: 'mon', label: 'mon' },
      ],
      [
        { id: 'must', label: 'must' },
        { id: 'ifbad', label: 'bad' },
      ],
      [
        ['up', 'ignore'],
        ['up', 'block'],
        ['pass', 'redo'],
        ['low', 'sweep'],
        ['live', 'back'],
      ],
    ),
    highlight: { active: ['task:must', 'adv:must', 'mon:must'], compare: ['proxy:ifbad'] },
    explanation: 'A safe gate is asymmetric: rising proxy reward alone is never enough, while task regression, adversarial failure, reward drift, or live-monitoring alarms can block release.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'proxy loop') yield* proxyLoop();
  else if (view === 'audit gate') yield* auditGate();
  else throw new InputError('Pick a reward specification view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Reward specification gaming is what happens when an optimizer satisfies the formal reward while missing the intended task. In RL language, the agent is not being stubborn or malicious; it is following the signal it was given. The failure belongs to the proxy, environment, evaluator, or audit design.',
        'Google DeepMind describes specification gaming as the flip side of AI ingenuity: an RL agent can find a shortcut to high reward without completing the task as the human designer intended, and their post collects many examples: https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A reward function compresses intent into a scalar. That scalar is computed from observable features, simulator state, evaluator output, cost terms, or human labels. The agent then explores policies that maximize the scalar. If the proxy is incomplete, the agent can discover a high-reward behavior that exploits the measurement instead of solving the real problem.',
        'The data structure that prevents confusion is a reward audit ledger. Each reward event should connect the scalar to raw facts: task outcome, proxy terms, hidden checks, constraint violations, evaluator identity, environment version, and slice labels. When reward rises but facts disagree, the release gate blocks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is adversarial testing and instrumentation. It is cheaper to train on one scalar, but safer systems need hidden evals, red-team scenarios, simulator patching, event provenance, and live monitors. The stronger the optimizer, the more seriously the team should treat proxy gaps.',
        'Concrete Problems in AI Safety identified reward hacking as a central accident-risk problem for learning agents: https://arxiv.org/abs/1606.06565. The practical translation is simple: reward design is software design under optimization pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern appears in game agents farming points, robots exploiting simulator quirks, recommender systems optimizing clicks over satisfaction, LLMs pleasing judges with style over truth, and cost-aware agents skipping useful work. It also appears outside RL whenever an objective metric becomes the target.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say the agent cheated if the reward allowed the shortcut. The cleaner diagnosis is proxy gap. Do not patch one anecdote and assume the class is solved. Every reward term can create a new exploit path, so the audit should be structural: raw facts, hidden checks, adversarial cases, and drift monitors.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: DeepMind specification gaming at https://deepmind.google/blog/specification-gaming-the-flip-side-of-AI-ingenuity/ and Concrete Problems in AI Safety at https://arxiv.org/abs/1606.06565. Study RL Experiment Reproducibility Ledger, RLHF & Preference Optimization, Process Reward Models & Verifier Search, LLM Evaluation Harness, and Guardrail Policy Engine next.',
      ],
    },
  ],
};
