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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the ledger view as one browser-agent run becoming evidence. Active nodes are records being written now: task, setup, action, screenshot, evaluator result, latency, and cost. Found nodes are records that can now be checked later without trusting memory or a dashboard total.',
        'The safe inference is narrow. If a score points to the same task version, environment, trace, evaluator, and replay bundle, a reviewer can explain why that score exists. If any link is missing, the pass rate is only a summary, not an engineering fact.',
        {type:'callout', text:`A browser-agent score only becomes engineering evidence when the task, run path, evaluator, latency, cost, and replay artifacts are bound into one inspectable ledger.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A browser agent is software that turns a human instruction into observations, model calls, clicks, typing, waits, and final checks inside a browser. A benchmark score says whether the task passed, but it does not explain which part of the run made the result happen. That missing explanation is the problem a trace ledger solves.',
        'A trace ledger is an append-only record that binds the task, starting state, browser events, model decisions, evaluator output, latency, cost, and replay artifacts. It exists because browser tasks fail for many different reasons: bad planning, wrong target grounding, stale site state, slow loading, policy blocks, or evaluator mismatch. One binary score cannot separate those causes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious benchmark stores a prompt, runs the agent, and writes pass or fail. That is reasonable because it gives a clean regression number and a simple leaderboard row. For a deterministic text answer, that may be enough evidence.',
        'Browser agents are path-dependent. A run that passes after nine retries, two wrong tabs, and a lucky final click is not the same as a run that passes in four clear actions. The final page state hides the route that produced it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is attribution. When a task fails, the team needs to know whether to fix the model prompt, locator strategy, wait policy, task fixture, website snapshot, evaluator, or product permission rule. A pass/fail table sends all of those cases into the same bucket.',
        'The second wall is drift. Live websites change search ranking, cookie banners, checkout flows, anti-bot prompts, and product inventory. Without a ledger, a lower score can look like model regression when the task environment changed instead.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The score must be derived from a replayable evidence chain. The invariant is that every pass or fail points to the exact task version, setup, action sequence, browser state, evaluator version, failure label, latency fields, and artifact bundle. A reviewer should be able to reconstruct the judgment from stored evidence.',
        'That invariant makes comparisons fairer. Two agents should not be compared unless the ledger shows that they faced compatible tasks, stop rules, credentials, browser profiles, evaluator logic, and approval rules. Otherwise the benchmark can reward a looser setup rather than a better agent.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Before the run, the harness records the task id, task text, task version, allowed sites, setup script, browser profile, account policy, timeout, maximum steps, evaluator version, and success rule. During the run, it appends observations, screenshots, accessibility snapshots, DOM excerpts when useful, model prompts, model outputs, tool calls, action records, waits, errors, and approvals.',
        'After the run, the scorer attaches the final state, evaluator evidence, pass/fail result, failure category, wall time, model-call count, token count, estimated spend, and replay pointers. The ledger row should be compact, but the artifacts it references can be large and content-addressed. Reports stay small while the evidence remains inspectable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is provenance. A task claim says what was requested, a setup claim says what state the agent faced, a trajectory claim says what the agent did, and an evaluator claim says why the final state counts. If those claims are linked and immutable, the score is auditable.',
        'The structure also makes failures actionable. A wrong query points to planning. A click on the right label but wrong DOM node points to grounding. A timeout after a spinner points to readiness detection. A rejected valid final state points to evaluator mismatch.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is storage and review time. Suppose one run stores 20 screenshots at 250 KB each, 20 DOM or accessibility snapshots at 100 KB each, a 400 KB model log, and a 600 KB trace archive. That is about 8 MB per run, so 5,000 nightly runs produce about 40 GB before compression and retention rules.',
        'Cost changes behavior. If the ledger is too thin, teams cannot debug regressions. If it records everything forever, storage and privacy review become the bottleneck. A practical system keeps full artifacts for failures and sampled passes, then keeps compact metrics and hashes longer.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Agent teams use trace ledgers for checkout, search, support forms, office documents, admin tools, and internal dashboards. The access pattern is repeated runs over tasks where the route matters as much as the final state. The same record supports debugging, model comparison, evaluator audits, and release gates.',
        'Vendor evaluation needs the same shape. One agent may have a higher pass rate but need twice the wall time, three times the model calls, or more human approvals. A production choice depends on success, latency, spend, risk, and evidence quality together.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A ledger fails when it becomes an artifact dump without a schema. Screenshots alone do not prove task version, evaluator version, action order, wait reasons, or failure category. The row needs stable ids and queryable fields, not just files in a folder.',
        'It also fails when privacy and retention are ignored. Browser traces can contain personal data, credentials, customer records, or internal pages. The system needs redaction, access control, and deletion policy before it becomes a default benchmark substrate.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider 100 shopping tasks. Agent A passes 72, averages 18 steps, uses 14 model calls per task, and costs $0.42 per task. Agent B passes 69, averages 7 steps, uses 5 model calls, and costs $0.16 per task. The leaderboard says A wins, but the ledger says B may be the better production choice if the three extra passes are mostly low-value retries.',
        'Now inspect one failed task: find the cheapest blue carry-on under $150 and add it to the cart. The ledger shows the task version, product-grid screenshot, query, filter clicks, selected item, final cart state, and evaluator rule. If the cheapest product changed after task creation, the failure label is site drift, not model reasoning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources and nearby systems: Playwright Trace Viewer at https://playwright.dev/docs/trace-viewer, Mind2Web at https://arxiv.org/abs/2306.06070, WebVoyager at https://arxiv.org/abs/2401.13919, and OSWorld at https://arxiv.org/abs/2404.07972.',
        'Study next by role: Browser Actionability Auto-Wait for flaky clicks, Accessibility Tree Action Target for grounding, Distributed Tracing for spans, Event Sourcing for append-only evidence, and Benchmark Variance Model Selection for comparing noisy scores.',
      ],
    },
  ],
};
