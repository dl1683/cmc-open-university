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
      heading: 'Why this exists',
      paragraphs: [
        `Browser agents turn a vague instruction into browser observations, model decisions, clicks, typing, waits, file operations, and final checks. A single pass rate hides almost all of that work. The agent may fail because it misunderstood the task, clicked the wrong target, clicked before the page was ready, hit a changed website, used the wrong account state, timed out, or was judged by an evaluator that did not match the human intent.`,
        `A trace ledger exists to make each score inspectable. It binds the task, starting state, environment setup, action trajectory, screenshots, model calls, browser events, evaluator output, latency, cost, failure labels, and replay artifacts into one evidence package. The goal is not more logging for its own sake. The goal is to make a benchmark result useful for engineering decisions.`,
        {type:'callout', text:`A browser-agent score only becomes engineering evidence when the task, run path, evaluator, latency, cost, and replay artifacts are bound into one inspectable ledger.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious benchmark stores a prompt, lets an agent run, and records pass or fail. That is attractive because it produces a clean leaderboard row and a simple regression number. For pure text tasks with deterministic answers, this can be enough.`,
        `Browser agents are different. They operate inside mutable interfaces. The path matters. A passing run that needed twenty retries, ignored warnings, opened the wrong tab twice, and eventually got lucky is not equivalent to a passing run that completed the task in four clear actions. A final state alone cannot tell those stories apart.`,
      ],
    },
    {
      heading: 'Where the obvious approach fails',
      paragraphs: [
        `The first wall is attribution. A binary score cannot tell whether the model planned poorly, the target grounding failed, the browser automation was flaky, the website changed, the task fixture was stale, the policy layer blocked a needed action, or the evaluator was wrong.`,
        `The second wall is drift. Live websites change product catalogs, cookie banners, login flows, anti-bot prompts, search ranking, and page structure. Offline datasets are more reproducible, but they can overstate live performance because the agent never faces the current site. A useful ledger separates model regression from benchmark drift instead of mixing them into one failure bucket.`,
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        `The invariant is simple: every score must be explainable from the stored evidence. A pass or fail should point back to the exact task version, environment setup, run trajectory, model decisions, evaluator version, and replay bundle that produced it. If a reviewer cannot reconstruct why the score happened, the score is weak evidence.`,
        `This invariant also protects comparisons. Two agents should not be compared unless the ledger can show that they faced the same task definitions, compatible environment states, compatible stop rules, and comparable evaluator logic. Otherwise a leaderboard can reward a looser setup instead of a better agent.`,
      ],
    },
    {
      heading: 'Ledger schema',
      paragraphs: [
        `A good row begins before the agent acts. Store the task text, task id, task version, allowed sites or apps, setup script, account and credential policy, seeded files or carts, browser profile state, permissions, timeout policy, maximum steps, risky-action rules, success criteria, and evaluator version.`,
        `During the run, append observations, screenshots, accessibility snapshots when available, DOM excerpts when useful, model prompts, model outputs, tool calls, action records, locator evidence, wait reasons, network or console errors, policy gates, human approvals, and trace spans. After the run, store final score, evaluator evidence, failure category, wall time, step count, token spend, and replay pointers.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Before a run, the evaluator creates or restores the environment and records what was frozen and what remained live. It then starts the browser or desktop session, gives the agent the task, and records the loop of observe, plan, ground target, act, wait, and decide whether to continue.`,
        `After the run, the scorer checks the final state and attaches the evidence used for that judgment. For deterministic tasks, this may be a script that checks a file, cart, setting, form state, ticket, or database row. For open-ended tasks, it may be a judge model plus rubric, but the judge prompt, model version, inputs, and disagreement checks must be stored too.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The ledger works because it turns a browser-agent run into a sequence of bounded claims. The task claim says what was requested. The setup claim says what state the agent faced. The trajectory claim says what the agent actually did. The evaluator claim says why the final state counts as success or failure. Replay ties those claims to visible evidence.`,
        `This structure makes failures actionable. A wrong search query points to planning. A click on the right text but wrong DOM node points to target grounding. A timeout after a spinner points to readiness detection. A pass rejected by the scorer points to evaluator mismatch. Each label suggests a different fix.`,
      ],
    },
    {
      heading: 'Latency and cost',
      paragraphs: [
        `Latency is part of browser-agent quality. A run that succeeds after thirty model calls, five retries, and several long sleeps may be worse for product use than a run that fails quickly and cleanly. Store model time, browser wait time, screenshot processing time, evaluator time, retry count, approval wait, and total wall time separately.`,
        `The ledger has its own cost. Screenshots, videos, accessibility snapshots, DOM captures, model payloads, and browser trace archives grow quickly. Production systems may sample some fields, but benchmark runs should preserve enough evidence to replay every failure and audit every surprising pass. Compression and retention policy matter, but missing evidence is more expensive than storage when a regression cannot be explained.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Use stable ids for task version, run id, agent build, model version, evaluator version, environment image, and replay bundle. Store raw artifacts in content-addressed storage when possible, then keep compact references in the ledger row. That lets reports stay small while preserving the full evidence chain.`,
        `Use a failure taxonomy that is specific enough to guide work but not so large that reviewers cannot apply it. Useful first-level labels include task ambiguity, planning error, target grounding error, actionability wait error, site drift, fixture error, policy block, timeout, evaluator mismatch, and infrastructure failure.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `Agent teams use trace ledgers for nightly regression suites across checkout, search, support, forms, account management, office documents, and internal tools. The same record supports debugging, model comparison, prompt changes, locator changes, wait-policy tuning, evaluator audits, and release gates.`,
        `Vendor evaluation also needs this structure. One model can show higher success while using more retries, more human approvals, more wall time, and more cost per task. A production decision depends on the full row: success, latency, cost, risk, evidence quality, and failure shape.`,
      ],
    },
    {
      heading: 'Worked examples',
      paragraphs: [
        `A shopping task says: find the cheapest blue carry-on and add it to the cart. The ledger should show the query, filters, product page screenshots, selected item, price evidence, add-to-cart action, final cart state, evaluator rule, and any site changes detected during the run. If the product grid changed since task creation, the failure should be labeled as drift, not automatically as model reasoning failure.`,
        `A desktop task may require editing a spreadsheet and saving a file. The ledger should include setup configuration, file paths, screenshots, action records, final artifact, and execution-based evaluator output. Without that evidence, a pass cannot be reproduced and a failure cannot be assigned to the model, the desktop state, or the evaluator.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Trace ledgers fail when they become a pile of artifacts without a schema. A screenshot archive is not enough. The rows need stable ids, versions, timestamps, action ordering, evaluator links, and failure labels that can be queried across runs.`,
        `They also fail when aggregate reports hide exclusions and drift. Do not compare scores without checking task versions, site state, credential rules, evaluator type, stop rules, and human-review policy. A stricter benchmark can look worse while producing cleaner evidence.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary references include Mind2Web for offline web tasks, WebVoyager for real-world website tasks, OSWorld for computer tasks with setup and execution-based evaluation, Online-Mind2Web for live web drift, OSWorld-Human for efficiency analysis, and Playwright Trace Viewer for replayable browser traces.`,
        `Next, study Computer-Use Agent Runtime Loop Case Study for the runtime loop, Browser Actionability Auto-Wait Case Study for flaky clicks, Accessibility Tree Action Target Case Study for target grounding, Verified Agent Trajectory Store for tamper-resistant records, Distributed Tracing for spans, and Benchmark Variance Model Selection for comparing noisy measurements.`,
      ],
    },
  ],
};
