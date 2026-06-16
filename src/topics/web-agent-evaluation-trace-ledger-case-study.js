// Web-agent evaluation trace ledger: benchmark tasks, environment setup,
// trajectories, screenshots, action traces, replay, evaluators, and latency.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'web-agent-evaluation-trace-ledger-case-study',
  title: 'Web Agent Evaluation Trace Ledger Case Study',
  category: 'AI & ML',
  summary: 'A benchmark and observability case study for browser agents: task setup, trajectories, screenshots, action ledgers, execution-based scoring, replay, latency, and benchmark drift.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['benchmark ledger', 'latency loop'], defaultValue: 'benchmark ledger' },
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
      { id: 'task', label: 'task', x: 0.7, y: 3.5, note: 'goal' },
      { id: 'init', label: 'init', x: 2.0, y: 2.0, note: 'state' },
      { id: 'env', label: 'env', x: 2.0, y: 5.0, note: 'site/app' },
      { id: 'agent', label: 'agent', x: 3.7, y: 3.5, note: 'run' },
      { id: 'traj', label: 'traj', x: 5.2, y: 1.6, note: 'steps' },
      { id: 'trace', label: 'trace', x: 5.2, y: 3.5, note: 'spans' },
      { id: 'shots', label: 'shots', x: 5.2, y: 5.4, note: 'screens' },
      { id: 'eval', label: 'eval', x: 7.0, y: 3.5, note: 'score' },
      { id: 'replay', label: 'rpl', x: 8.4, y: 2.0, note: 'debug' },
      { id: 'report', label: 'report', x: 8.4, y: 5.0, note: 'slice' },
    ],
    edges: [
      { id: 'e-task-init', from: 'task', to: 'init' },
      { id: 'e-task-env', from: 'task', to: 'env' },
      { id: 'e-init-agent', from: 'init', to: 'agent' },
      { id: 'e-env-agent', from: 'env', to: 'agent' },
      { id: 'e-agent-traj', from: 'agent', to: 'traj' },
      { id: 'e-agent-trace', from: 'agent', to: 'trace' },
      { id: 'e-agent-shots', from: 'agent', to: 'shots' },
      { id: 'e-traj-eval', from: 'traj', to: 'eval' },
      { id: 'e-trace-eval', from: 'trace', to: 'eval' },
      { id: 'e-shots-eval', from: 'shots', to: 'eval' },
      { id: 'e-eval-replay', from: 'eval', to: 'replay' },
      { id: 'e-eval-report', from: 'eval', to: 'report' },
    ],
  }, { title });
}

function latencyGraph(title) {
  return graphState({
    nodes: [
      { id: 'obs', label: 'obs', x: 0.8, y: 3.5, note: 'shot' },
      { id: 'plan', label: 'plan', x: 2.2, y: 2.0, note: 'LLM' },
      { id: 'ground', label: 'ground', x: 2.2, y: 5.0, note: 'target' },
      { id: 'act', label: 'act', x: 4.0, y: 3.5, note: 'browser' },
      { id: 'wait', label: 'wait', x: 5.6, y: 2.0, note: 'page' },
      { id: 'reflect', label: 'reflect', x: 5.6, y: 5.0, note: 'LLM' },
      { id: 'next', label: 'next', x: 7.3, y: 3.5, note: 'step' },
      { id: 'budget', label: 'budget', x: 9.0, y: 3.5, note: 'stop' },
    ],
    edges: [
      { id: 'e-obs-plan', from: 'obs', to: 'plan' },
      { id: 'e-obs-ground', from: 'obs', to: 'ground' },
      { id: 'e-plan-act', from: 'plan', to: 'act' },
      { id: 'e-ground-act', from: 'ground', to: 'act' },
      { id: 'e-act-wait', from: 'act', to: 'wait' },
      { id: 'e-wait-reflect', from: 'wait', to: 'reflect' },
      { id: 'e-reflect-next', from: 'reflect', to: 'next' },
      { id: 'e-next-budget', from: 'next', to: 'budget' },
      { id: 'e-next-obs', from: 'next', to: 'obs' },
    ],
  }, { title });
}

function latencyPlot() {
  return plotState({
    axes: {
      x: { label: 'agent steps', min: 1, max: 30 },
      y: { label: 'task minutes', min: 0, max: 30 },
    },
    series: [
      { id: 'agent', label: 'agent', points: [{ x: 2, y: 2 }, { x: 6, y: 6 }, { x: 10, y: 11 }, { x: 18, y: 21 }, { x: 26, y: 28 }] },
      { id: 'human', label: 'human', points: [{ x: 2, y: 1 }, { x: 6, y: 3 }, { x: 10, y: 5.5 }, { x: 18, y: 10 }, { x: 26, y: 15 }] },
    ],
    markers: [
      { id: 'budget', x: 12, y: 12, label: 'cap' },
    ],
  });
}

function* benchmarkLedger() {
  yield {
    state: evalGraph('A browser-agent benchmark is a replayable ledger'),
    highlight: { active: ['task', 'init', 'env', 'agent', 'e-task-init', 'e-task-env', 'e-init-agent', 'e-env-agent'], found: ['eval'] },
    explanation: 'A real browser-agent benchmark needs task text, initial state, environment setup, agent trajectory, screenshots, trace spans, and scoring logic. Without those, a pass rate is hard to trust.',
    invariant: 'A score without a replayable trace is weak evidence.',
  };

  yield {
    state: labelMatrix(
      'Bench',
      [
        { id: 'mind', label: 'Mind2Web' },
        { id: 'voy', label: 'Voyager' },
        { id: 'osw', label: 'OSWorld' },
        { id: 'online', label: 'Online' },
      ],
      [
        { id: 'env', label: 'env' },
        { id: 'eval', label: 'eval' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['real web', 'actions', 'static'],
        ['live web', 'judge', 'drift'],
        ['desktop', 'scripts', 'setup'],
        ['live web', 'human+auto', 'volatility'],
      ],
    ),
    highlight: { active: ['mind:env', 'voy:env', 'osw:env', 'online:env'], compare: ['voy:risk', 'online:risk'] },
    explanation: 'Benchmarks differ in what they freeze. Offline action datasets isolate action prediction. Live web benchmarks test current sites but introduce drift. OSWorld adds real desktop state and execution-based evaluators.',
  };

  yield {
    state: evalGraph('Scoring joins trajectory, screenshots, and evaluator'),
    highlight: { active: ['traj', 'trace', 'shots', 'eval', 'e-traj-eval', 'e-trace-eval', 'e-shots-eval'], compare: ['task'] },
    explanation: 'Scoring should explain whether a task failed from planning, grounding, actionability, site drift, policy refusal, timeout, or evaluator mismatch. Those labels make pass rates actionable.',
  };

  yield {
    state: evalGraph('Replay turns a benchmark result into an engineering loop'),
    highlight: { active: ['eval', 'replay', 'report', 'e-eval-replay', 'e-eval-report'], compare: ['agent'] },
    explanation: 'Playwright traces are useful here because they let developers move through actions, screenshots, and state after the run. Agent traces should add model calls, target evidence, and policy gates.',
  };
}

function* latencyLoop() {
  yield {
    state: latencyGraph('Latency is part of browser-agent quality'),
    highlight: { active: ['obs', 'plan', 'ground', 'act', 'wait', 'e-obs-plan', 'e-obs-ground', 'e-plan-act', 'e-ground-act', 'e-act-wait'], found: ['budget'] },
    explanation: 'A browser agent can be correct and still unusable. Each step may include observation, planning, grounding, actionability waits, page waits, and reflection.',
  };

  yield {
    state: latencyPlot(),
    highlight: { active: ['agent', 'budget'], compare: ['human'] },
    explanation: 'OSWorld-Human reports that many computer-use agents take more steps than necessary and that large model calls for planning and reflection dominate latency. Evaluation should score time and steps, not only success.',
  };

  yield {
    state: labelMatrix(
      'Latency',
      [
        { id: 'model', label: 'model' },
        { id: 'shot', label: 'shot' },
        { id: 'wait', label: 'wait' },
        { id: 'retry', label: 'retry' },
        { id: 'eval', label: 'eval' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['planning', 'cache/small'],
        ['vision', 'crop/AX'],
        ['page load', 'signals'],
        ['flaky', 'action gate'],
        ['judge', 'script'],
      ],
    ),
    highlight: { active: ['model:fix', 'shot:fix', 'wait:fix', 'retry:fix'], compare: ['eval:cause'] },
    explanation: 'Latency fixes are specific. Use accessibility trees and crops to reduce vision load, page signals instead of sleeps, smaller models for mechanical routing, and execution scripts where possible.',
  };

  yield {
    state: latencyGraph('The stop rule protects time and money'),
    highlight: { active: ['reflect', 'next', 'budget', 'e-reflect-next', 'e-next-budget'], compare: ['obs'] },
    explanation: 'The evaluation ledger should enforce max steps, wall time, token spend, and risky-action limits. A failed stop rule is a product bug even if the agent eventually succeeds.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'benchmark ledger') yield* benchmarkLedger();
  else if (view === 'latency loop') yield* latencyLoop();
  else throw new InputError('Pick a web-agent evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A web-agent evaluation trace ledger is the evidence package behind browser-agent scores. It stores task definition, initial environment state, trajectory, screenshots, action records, model calls, trace spans, evaluator outputs, latency, and replay links.',
        'This extends LLM Evaluation Harnesses: Golden Sets and Agent Run Trace Span Tree Case Study into UI automation, where correctness depends on both reasoning and interaction mechanics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each benchmark item should have a task, setup state, allowed sites or applications, stop rules, success criteria, and evaluation code or rubric. Each run writes observations, actions, screenshots, locators, wait reasons, model decisions, policy gates, and final evaluator output.',
        'Failure analysis should label the smallest useful cause: planning error, grounding error, actionability failure, stale page, site drift, permission issue, human-approval block, timeout, or evaluator mismatch.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Browser-agent benchmarks are hard because live websites change. Offline datasets improve reproducibility but can overstate live performance. Live benchmarks approximate real use but need drift handling, task refresh, and careful evaluator design.',
        'Latency is a separate quality axis. A task that takes twenty model turns may pass a binary score while still being unusable. The ledger should keep wall time, step count, model time, wait time, retries, and token spend.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Mind2Web introduced a dataset for generalist web agents on real websites with natural-language tasks and annotated action sequences: https://arxiv.org/abs/2306.06070. WebVoyager built an end-to-end multimodal web agent benchmark on live websites and reported task success plus automatic-evaluation agreement: https://arxiv.org/abs/2401.13919.',
        'OSWorld created 369 real computer-use tasks with setup configuration and execution-based evaluation scripts: https://arxiv.org/abs/2404.07972. Online-Mind2Web argues that prior web-agent progress can be over-optimistic and evaluates agents on 300 realistic online tasks across 136 websites: https://arxiv.org/abs/2504.01382.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A browser-agent team can run a nightly slice across checkout, search, support, forms, and account-management tasks. The ledger tells whether regressions came from model routing, target grounding, UI waits, policy gates, or benchmark drift.',
        'The same structure supports vendor comparisons. Instead of one pass-rate number, compare success, steps, wall time, retries, approvals, cost per task, and failure taxonomy.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not compare browser-agent scores without checking task exclusions, site versions, evaluation method, and human-review policy. Do not rely only on an LLM judge when an execution-based evaluator can check the state directly.',
        'Do not hide latency. Computer-use agents are often bottlenecked by repeated planning and reflection, so practical evaluation needs time and step metrics alongside accuracy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mind2Web at https://arxiv.org/abs/2306.06070, WebVoyager at https://arxiv.org/abs/2401.13919, OSWorld at https://arxiv.org/abs/2404.07972, Online-Mind2Web at https://arxiv.org/abs/2504.01382, OSWorld-Human at https://arxiv.org/abs/2506.16042, and Playwright Trace Viewer at https://playwright.dev/docs/trace-viewer. Study Computer-Use Agent Harness Loop Case Study, Accessibility Tree Action Target Case Study, Browser Actionability Auto-Wait Case Study, Verified Agent Trajectory Store, and Benchmark Variance Model Selection next.',
      ],
    },
  ],
};
