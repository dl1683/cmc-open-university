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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the loop as observe, decide, gate, execute, wait, and record. The model proposes an action, but the harness owns the environment and decides whether the action can run.',
        'Active nodes are the observation bundle, model action, policy gate, or execution result being processed. Found nodes are ledger rows that prove what the agent saw, proposed, and changed.',
        'The safe inference rule is that page content is untrusted input. Text on the screen can guide the task, but it can not change the harness policy or grant new authority.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many workflows still live behind graphical interfaces rather than APIs. Legacy ERP screens, support portals, government forms, desktop apps, and internal admin tools expose buttons and fields that a normal integration can not call directly.',
        'A computer-use agent operates those interfaces by reading screenshots or accessibility trees and proposing clicks, keystrokes, navigation, waits, uploads, or downloads. That gives it useful reach and dangerous authority.',
        {type:'callout', text:'A computer-use agent is safer when the harness owns observation, policy, execution, and trace, while the model only proposes actions.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/67/Basic_model_of_HCI.png', alt:'A simple loop showing computer output becoming user input and user output becoming computer input across an interface.', caption:'Basic model of human-computer interaction. Source: Wikimedia Commons, Dr. Greywolf, CC BY-SA 4.0.'},
        'The harness exists to separate proposal from execution. It captures observations, validates action schema, applies policy, pauses risky actions, executes in an isolated environment, and records a trace.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a screenshot loop. Capture the screen, send it to the model, receive coordinates or text, replay the input event, then capture the next screen.',
        'That works for demos because it is simple and close to how a human uses a computer. It breaks when coordinates drift, pages load slowly, modals appear, or the agent touches accounts, money, personal data, or production settings.',
        'A better version adds structure such as DOM nodes, accessibility roles, bounding boxes, URL state, focus, console messages, and network status. The model can target an element rather than only a pixel.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is authority. A browser profile may contain cookies, saved passwords, extensions, email access, admin sessions, and payment surfaces, so a bare agent inherits the whole identity.',
        'The second wall is reliability. A 95 percent per-step success rate sounds high, but over 20 steps the end-to-end success rate is about 36 percent because all steps must work.',
        'The third wall is auditability. If the system records only the final answer, nobody can tell which observation, model output, gate, or action caused a bad side effect.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The harness is the main data structure. The model is a decision function called inside a loop that the harness controls.',
        'The harness needs an observation bundle, an environment contract, and an action ledger. The observation bundle stores what the agent saw, the contract stores allowed authority, and the ledger stores every proposed and executed mutation.',
        'The invariant is separation of proposal and execution. The model never directly mutates the browser or desktop; every action passes through schema validation, policy gates, and trace recording first.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The harness captures a screenshot plus structured state such as accessibility tree, DOM excerpt, URL, viewport, selected text, focused element, console errors, and pending network requests. That bundle gives the model visual context while giving the harness machine-checkable targets.',
        'The model receives the task goal and observation bundle, then returns a structured action. Examples include click target, type value, navigate URL, scroll direction, wait condition, download request, or request for human approval.',
        'The policy engine checks domain allow-lists, credential scope, file rules, clipboard rules, network rules, risky-action types, and human-approval requirements. Only approved actions reach the browser or desktop.',
        'After execution, the harness waits for the stated condition, captures the next observation, and writes a ledger row linking previous observation, action, gate, result, and next observation. The next model call is conditioned on that fresh state rather than on the stale screen before the click.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a trace invariant. Every environment mutation must be attributable to a preceding observation, a model action request, a policy decision, an execution result, and a following observation.',
        'That chain does not make the model always correct. It makes failures bounded and diagnosable because the agent can not act outside the harness and each action has evidence.',
        'Treating page content as untrusted data blocks prompt injection from becoming authority. A web page can display instructions, but it can not edit the domain allow-list, credential scope, or human-approval rule.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A computer-use step is expensive. A screenshot can add about 1,000 vision tokens, structured extraction may take 100 ms, model inference may take seconds, and waits can dominate wall-clock time.',
        'For a 15-step workflow, USD 0.02 of model cost per step becomes USD 0.30 before retries. If per-step success is 95 percent, expected full-run success is about 46 percent for 15 steps, so failures can double effective cost.',
        'Trace storage also grows quickly. At 500 KB per step, a 15-step run stores about 7.5 MB; keeping every failure trace is usually more valuable than keeping every successful trace forever.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Computer-use harnesses fit customer support workflows, QA reproduction, compliance audits, legacy data entry, desktop-app automation, and web-agent benchmarks. These tasks are valuable because the GUI is the real integration surface and a human would otherwise repeat the same navigation.',
        'The best tasks have clear boundaries: one start page, one goal condition, limited domains, reversible or reviewable actions, and a manual workflow that is expensive enough to justify agent overhead. Those boundaries let the harness decide when the run is complete or unsafe.',
        'High-risk actions such as submit, delete, purchase, account change, upload, download, or data export should pause for human approval or be blocked by default. The harness should make that rule enforceable even when page text asks the model to continue.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when run in a normal signed-in profile. Saved credentials, cookies, open tabs, and extensions become part of the agent attack surface.',
        'It fails when retries are not idempotent. If the agent clicks submit, times out, and clicks again, it may create two orders, refunds, filings, or account changes.',
        'It fails when wait conditions are weak. Observing too early feeds stale state to the model; observing too late wastes latency and can hide race conditions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A refund agent starts on order 4821 with an isolated browser profile and a contract allowing only support.example.com. It can read order details and draft a refund, but submit requires human approval.',
        'The agent fills reason duplicate charge and amount USD 49.99, then proposes clicking Submit Refund. The gate classifies submit as high risk, pauses execution, records the screenshot and action, and asks a human reviewer.',
        'If approved, the harness clicks submit, waits for the confirmation page, captures reference RF-9021, and seals the ledger. If a page tries to send the agent to another domain, the policy blocks navigation before the browser leaves the allowed site.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include Anthropic computer-use tool documentation, OpenAI computer-use guidance, OSWorld, Mind2Web, and WebVoyager. Read them for environment contracts, observation formats, benchmark tasks, and safety boundaries.',
        'Study Accessibility Tree Action Target, Browser Actionability Auto-Wait, Prompt Injection Threat Model, Human Approval Interrupt Queue, Web Agent Evaluation Trace Ledger, and Agent Tool Permission Lattice next. Each topic deepens one part of the harness boundary: target grounding, waiting, adversarial content, approval, audit, or permission.',
      ],
    },
  ],
};
