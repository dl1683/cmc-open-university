// Computer-use agent harness loop: screenshots, model actions, browser or VM
// execution, observations, safety gates, and trace records.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'computer-use-agent-harness-loop-case-study',
  title: 'Computer-Use Agent Harness Loop Case Study',
  category: 'AI & ML',
  summary: 'A browser and desktop agent case study: screenshot state, model action records, isolated harnesses, allow lists, human gates, tool execution, and replay traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['agent loop', 'harness safety'], defaultValue: 'agent loop' },
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
      { id: 'task', label: 'task', x: 0.7, y: 3.5, note: 'goal' },
      { id: 'env', label: 'env', x: 2.0, y: 3.5, note: 'browser' },
      { id: 'shot', label: 'shot', x: 3.4, y: 1.7, note: 'screen' },
      { id: 'state', label: 'state', x: 3.4, y: 5.3, note: 'DOM/AX' },
      { id: 'model', label: 'model', x: 5.0, y: 3.5, note: 'decide' },
      { id: 'action', label: 'act', x: 6.4, y: 2.0, note: 'click/type' },
      { id: 'gate', label: 'gate', x: 6.4, y: 5.0, note: 'risk' },
      { id: 'exec', label: 'exec', x: 7.9, y: 3.5, note: 'harness' },
      { id: 'obs', label: 'obs', x: 9.1, y: 2.0, note: 'new shot' },
      { id: 'trace', label: 'trace', x: 9.1, y: 5.0, note: 'replay' },
    ],
    edges: [
      { id: 'e-task-env', from: 'task', to: 'env' },
      { id: 'e-env-shot', from: 'env', to: 'shot' },
      { id: 'e-env-state', from: 'env', to: 'state' },
      { id: 'e-shot-model', from: 'shot', to: 'model' },
      { id: 'e-state-model', from: 'state', to: 'model' },
      { id: 'e-model-action', from: 'model', to: 'action' },
      { id: 'e-model-gate', from: 'model', to: 'gate' },
      { id: 'e-gate-exec', from: 'gate', to: 'exec' },
      { id: 'e-action-exec', from: 'action', to: 'exec' },
      { id: 'e-exec-obs', from: 'exec', to: 'obs' },
      { id: 'e-exec-trace', from: 'exec', to: 'trace' },
      { id: 'e-obs-shot', from: 'obs', to: 'shot' },
    ],
  }, { title });
}

function safetyGraph(title) {
  return graphState({
    nodes: [
      { id: 'iso', label: 'iso', x: 0.8, y: 3.5, note: 'VM' },
      { id: 'allow', label: 'allow', x: 2.3, y: 2.0, note: 'domains' },
      { id: 'deny', label: 'deny', x: 2.3, y: 5.0, note: 'blocks' },
      { id: 'page', label: 'page', x: 4.0, y: 1.6, note: 'untrusted' },
      { id: 'prompt', label: 'inj', x: 4.0, y: 5.4, note: 'attack' },
      { id: 'policy', label: 'policy', x: 5.7, y: 3.5, note: 'check' },
      { id: 'human', label: 'human', x: 7.2, y: 2.0, note: 'approve' },
      { id: 'run', label: 'run', x: 7.2, y: 5.0, note: 'safe' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.5, note: 'trace' },
    ],
    edges: [
      { id: 'e-iso-allow', from: 'iso', to: 'allow' },
      { id: 'e-iso-deny', from: 'iso', to: 'deny' },
      { id: 'e-allow-policy', from: 'allow', to: 'policy' },
      { id: 'e-deny-policy', from: 'deny', to: 'policy' },
      { id: 'e-page-policy', from: 'page', to: 'policy' },
      { id: 'e-prompt-policy', from: 'prompt', to: 'policy' },
      { id: 'e-policy-human', from: 'policy', to: 'human' },
      { id: 'e-policy-run', from: 'policy', to: 'run' },
      { id: 'e-human-run', from: 'human', to: 'run' },
      { id: 'e-run-audit', from: 'run', to: 'audit' },
    ],
  }, { title });
}

function harnessPlot() {
  return plotState({
    axes: {
      x: { label: 'programmatic access', min: 0, max: 10 },
      y: { label: 'visual ambiguity', min: 0, max: 10 },
    },
    series: [
      { id: 'browser', label: 'browser', points: [{ x: 2, y: 8 }, { x: 4, y: 6 }, { x: 6, y: 5 }, { x: 8.2, y: 3 }] },
      { id: 'desktop', label: 'desktop', points: [{ x: 1, y: 9 }, { x: 2, y: 8 }, { x: 4, y: 7 }, { x: 6.8, y: 5 }] },
    ],
    markers: [
      { id: 'hybrid', x: 7, y: 4, label: 'hybrid' },
    ],
  });
}

function* agentLoop() {
  yield {
    state: loopGraph('Computer use is a closed observation-action loop'),
    highlight: { active: ['task', 'env', 'shot', 'state', 'model', 'e-task-env', 'e-env-shot', 'e-env-state', 'e-shot-model', 'e-state-model'], found: ['action'] },
    explanation: 'A computer-use agent gets a task, observes a browser or desktop through screenshots and optional structured state, chooses an action, runs that action in a harness, then observes again.',
    invariant: 'The model proposes actions; the harness executes and records them.',
  };

  yield {
    state: labelMatrix(
      'Action',
      [
        { id: 'obs', label: 'obs' },
        { id: 'plan', label: 'plan' },
        { id: 'act', label: 'act' },
        { id: 'target', label: 'target' },
        { id: 'guard', label: 'guard' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['shot id', 'state'],
        ['intent', 'debug'],
        ['type', 'replay'],
        ['coords/id', 'ground'],
        ['policy', 'safe'],
        ['new obs', 'loop'],
      ],
    ),
    highlight: { active: ['obs:field', 'act:field', 'target:field', 'guard:field', 'result:field'], compare: ['target:why'] },
    explanation: 'The action record needs more than x and y. Store the observation id, selected action, target evidence, safety decision, execution result, timing, and trace span so a failure can be replayed.',
  };

  yield {
    state: harnessPlot(),
    highlight: { active: ['browser', 'hybrid'], compare: ['desktop'] },
    explanation: 'OpenAI describes several harness shapes: built-in computer tools, custom tools on top of browser automation, and code-execution environments. Browser tasks can mix visual state with DOM or accessibility state; desktop tasks often need more visual grounding.',
  };

  yield {
    state: loopGraph('Every action writes a trace and returns an observation'),
    highlight: { active: ['model', 'action', 'gate', 'exec', 'obs', 'trace', 'e-model-action', 'e-model-gate', 'e-gate-exec', 'e-action-exec', 'e-exec-obs', 'e-exec-trace', 'e-obs-shot'], compare: ['task'] },
    explanation: 'The loop becomes production-grade when actions are gated, executed in isolation, written to a trace, and linked to the next screenshot or structured observation.',
  };
}

function* harnessSafety() {
  yield {
    state: safetyGraph('The harness is part of the safety boundary'),
    highlight: { active: ['iso', 'allow', 'deny', 'policy', 'e-iso-allow', 'e-iso-deny', 'e-allow-policy', 'e-deny-policy'], found: ['audit'] },
    explanation: 'Computer use should run inside an isolated browser, VM, or container with explicit domain, file, credential, and action boundaries. The UI is an input channel, not a trusted authority.',
    invariant: 'Page content is untrusted instruction-bearing data.',
  };

  yield {
    state: labelMatrix(
      'Guards',
      [
        { id: 'domain', label: 'domain' },
        { id: 'auth', label: 'auth' },
        { id: 'money', label: 'money' },
        { id: 'data', label: 'data' },
        { id: 'file', label: 'file' },
        { id: 'host', label: 'host' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['allowlist', 'block'],
        ['scoped', 'review'],
        ['limit', 'human'],
        ['redact', 'review'],
        ['sandbox', 'deny'],
        ['no env', 'deny'],
      ],
    ),
    highlight: { active: ['domain:rule', 'money:gate', 'data:gate', 'host:gate'], compare: ['auth:rule'] },
    explanation: 'OpenAI recommends isolation, action allow lists, and human review for high-impact actions. Anthropic similarly emphasizes consent, sandboxed environments, and prompt-injection defenses for computer use.',
  };

  yield {
    state: safetyGraph('Prompt injection can arrive as pixels'),
    highlight: { active: ['page', 'prompt', 'policy', 'human', 'e-page-policy', 'e-prompt-policy', 'e-policy-human'], compare: ['run'] },
    explanation: 'A browser page can display instructions aimed at the model. The harness should treat page text, screenshots, documents, and tool output as untrusted data and route risky actions to policy or human review.',
  };

  yield {
    state: labelMatrix(
      'Harness',
      [
        { id: 'proto', label: 'proto' },
        { id: 'local', label: 'local' },
        { id: 'cloud', label: 'cloud' },
        { id: 'desk', label: 'desk' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'risk', label: 'risk' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['browser', 'secrets', 'demo'],
        ['playwright', 'host env', 'dev'],
        ['remote VM', 'tenant', 'scale'],
        ['desktop', 'wide perms', 'apps'],
      ],
    ),
    highlight: { active: ['local:shape', 'cloud:shape', 'desk:shape'], compare: ['desk:risk'] },
    explanation: 'The harness choice changes the data structures. A browser harness can expose locators and DOM state. A desktop harness relies more on screenshots, input events, sandbox policy, and state snapshots.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'agent loop') yield* agentLoop();
  else if (view === 'harness safety') yield* harnessSafety();
  else throw new InputError('Pick a computer-use harness view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A computer-use agent harness is the runtime loop that lets a model operate a browser or desktop UI. The model observes screenshots and optional structured state, proposes actions, the harness executes them, and the result becomes the next observation.',
        'This sits below Agent Workflow DAG Compiler Case Study and Agent Run Trace Span Tree Case Study. The workflow decides why a step exists; the computer-use harness decides how a click, type, scroll, screenshot, or wait action is executed and audited.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The core data structure is an action ledger. Each row binds observation id, screenshot id, structured state hash, model decision, action type, target coordinates or locator, policy result, execution result, timing, and trace span.',
        'A strong browser harness can combine visual state with DOM, accessibility tree, locators, network events, and page console events. A desktop harness usually has weaker structured state, so screenshots, coordinate systems, focus state, and sandbox policy matter more.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computer-use agents are expensive because each step may require a model call, screenshot capture, action execution, wait, and re-observation. More reflection can improve reliability, but it also raises latency and creates more chances to drift from the user goal.',
        'The safety boundary is not optional. The harness should isolate the browser or desktop, avoid inheriting host secrets, enforce domain and action allow lists, and require human approval for purchases, authenticated flows, destructive actions, or anything hard to reverse.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'OpenAI computer-use docs describe models operating software through screenshots and returned interface actions, and recommend isolated browsers or VMs, allow lists, and human-in-the-loop review for high-impact actions: https://developers.openai.com/api/docs/guides/tools-computer-use.',
        'Anthropic computer-use docs describe an agent loop where Claude requests tool actions, an application executes them in a virtualized environment, and results are returned. They also emphasize user consent, sandboxing, and defenses for prompt injection in screenshots: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A support workflow can use browser actions to inspect an order page, pause before refund, and record the trace. A QA workflow can turn a natural-language bug report into a browser path. A data-entry workflow can navigate legacy software that has no API.',
        'The important implementation move is to separate the action space from the model prompt. The prompt can ask for intent; the harness owns execution, guardrails, state capture, and audit records.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat screenshots as trusted instructions. A web page can contain prompt injection. Do not run a browser agent in your normal signed-in profile. Do not allow arbitrary file access, extension access, or environment-variable inheritance in prototypes that might touch real accounts.',
        'Do not log only the final answer. Computer-use failures often happen in intermediate targeting, waiting, or stale-state decisions, so the trace needs each observation and action.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OpenAI Computer use at https://developers.openai.com/api/docs/guides/tools-computer-use, Anthropic Computer use at https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool, OSWorld at https://arxiv.org/abs/2404.07972, Mind2Web at https://arxiv.org/abs/2306.06070, and WebVoyager at https://arxiv.org/abs/2401.13919. Study Accessibility Tree Action Target Case Study, Browser Actionability Auto-Wait Case Study, Web Agent Evaluation Trace Ledger Case Study, Human Approval Interrupt Queue Case Study, Prompt Injection Threat Model, and Capability Security Attenuation next.',
      ],
    },
  ],
};
