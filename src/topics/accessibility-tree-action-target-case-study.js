// Accessibility-tree action targeting: use roles, names, states, bounding boxes,
// and candidate ranking to ground browser-agent actions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'accessibility-tree-action-target-case-study',
  title: 'Accessibility Tree Action Target Case Study',
  category: 'AI & ML',
  summary: 'A browser-agent grounding case study: accessibility snapshots, role/name/state trees, visible candidates, bounding boxes, locator ranking, and target verification.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ax snapshot', 'target match'], defaultValue: 'ax snapshot' },
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

function axGraph(title) {
  return graphState({
    nodes: [
      { id: 'dom', label: 'DOM', x: 0.8, y: 3.5, note: 'nodes' },
      { id: 'css', label: 'CSS', x: 2.1, y: 1.7, note: 'visible' },
      { id: 'aria', label: 'ARIA', x: 2.1, y: 5.3, note: 'roles' },
      { id: 'ax', label: 'AX', x: 3.7, y: 3.5, note: 'tree' },
      { id: 'role', label: 'role', x: 5.3, y: 1.4, note: 'button' },
      { id: 'name', label: 'name', x: 5.3, y: 3.5, note: 'text' },
      { id: 'state', label: 'state', x: 5.3, y: 5.6, note: 'enabled' },
      { id: 'bbox', label: 'box', x: 7.0, y: 2.3, note: 'coords' },
      { id: 'cand', label: 'cand', x: 7.0, y: 4.7, note: 'rank' },
      { id: 'model', label: 'model', x: 8.8, y: 3.5, note: 'choose' },
    ],
    edges: [
      { id: 'e-dom-css', from: 'dom', to: 'css' },
      { id: 'e-dom-aria', from: 'dom', to: 'aria' },
      { id: 'e-css-ax', from: 'css', to: 'ax' },
      { id: 'e-aria-ax', from: 'aria', to: 'ax' },
      { id: 'e-ax-role', from: 'ax', to: 'role' },
      { id: 'e-ax-name', from: 'ax', to: 'name' },
      { id: 'e-ax-state', from: 'ax', to: 'state' },
      { id: 'e-role-cand', from: 'role', to: 'cand' },
      { id: 'e-name-cand', from: 'name', to: 'cand' },
      { id: 'e-state-cand', from: 'state', to: 'cand' },
      { id: 'e-bbox-cand', from: 'bbox', to: 'cand' },
      { id: 'e-cand-model', from: 'cand', to: 'model' },
    ],
  }, { title });
}

function targetGraph(title) {
  return graphState({
    nodes: [
      { id: 'instr', label: 'goal', x: 0.7, y: 3.5, note: 'book trip' },
      { id: 'query', label: 'query', x: 2.0, y: 3.5, note: 'intent' },
      { id: 'filter', label: 'filter', x: 3.4, y: 2.0, note: 'role' },
      { id: 'rank', label: 'rank', x: 3.4, y: 5.0, note: 'name' },
      { id: 'loc', label: 'loc', x: 5.1, y: 3.5, note: 'selector' },
      { id: 'verify', label: 'check', x: 6.6, y: 2.0, note: 'visible' },
      { id: 'click', label: 'click', x: 6.6, y: 5.0, note: 'act' },
      { id: 'obs', label: 'obs', x: 8.2, y: 3.5, note: 'changed' },
      { id: 'repair', label: 'fix', x: 9.4, y: 3.5, note: 'retry' },
    ],
    edges: [
      { id: 'e-instr-query', from: 'instr', to: 'query' },
      { id: 'e-query-filter', from: 'query', to: 'filter' },
      { id: 'e-query-rank', from: 'query', to: 'rank' },
      { id: 'e-filter-loc', from: 'filter', to: 'loc' },
      { id: 'e-rank-loc', from: 'rank', to: 'loc' },
      { id: 'e-loc-verify', from: 'loc', to: 'verify' },
      { id: 'e-verify-click', from: 'verify', to: 'click' },
      { id: 'e-click-obs', from: 'click', to: 'obs' },
      { id: 'e-obs-repair', from: 'obs', to: 'repair' },
      { id: 'e-repair-query', from: 'repair', to: 'query' },
    ],
  }, { title });
}

function candidatePlot() {
  return plotState({
    axes: {
      x: { label: 'candidate count', min: 1, max: 80 },
      y: { label: 'grounding risk', min: 0, max: 10 },
    },
    series: [
      { id: 'risk', label: 'risk', points: [{ x: 2, y: 1 }, { x: 8, y: 2.2 }, { x: 20, y: 4.2 }, { x: 42, y: 7 }, { x: 64, y: 9 }] },
      { id: 'ranker', label: 'ranker', points: [{ x: 2, y: 0.9 }, { x: 8, y: 1.3 }, { x: 20, y: 2.1 }, { x: 42, y: 3.7 }, { x: 64, y: 5.4 }] },
    ],
    markers: [
      { id: 'topk', x: 16, y: 2.4, label: 'top-k' },
    ],
  });
}

function* axSnapshot() {
  yield {
    state: axGraph('The accessibility tree compresses UI meaning'),
    highlight: { active: ['dom', 'css', 'aria', 'ax', 'e-dom-css', 'e-dom-aria', 'e-css-ax', 'e-aria-ax'], found: ['cand'] },
    explanation: 'A browser agent should not see only pixels. The accessibility tree gives a compact structure of roles, names, states, and relationships that can make action targets more explicit.',
    invariant: 'Accessible role and name are target evidence, not decoration.',
  };

  yield {
    state: labelMatrix(
      'AX node',
      [
        { id: 'role', label: 'role' },
        { id: 'name', label: 'name' },
        { id: 'state', label: 'state' },
        { id: 'level', label: 'level' },
        { id: 'box', label: 'box' },
        { id: 'text', label: 'text' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'use', label: 'use' },
      ],
      [
        ['button', 'action'],
        ['Search', 'match'],
        ['enabled', 'gate'],
        ['depth', 'scope'],
        ['x/y/w/h', 'click'],
        ['label', 'intent'],
      ],
    ),
    highlight: { active: ['role:value', 'name:value', 'state:value', 'box:value'], compare: ['text:use'] },
    explanation: 'Playwright ARIA snapshots serialize accessible elements into a tree-like YAML form. For agents, the same idea becomes a target index: role, name, state, hierarchy, text, and bounding box.',
  };

  yield {
    state: axGraph('Candidate rows join tree meaning to screen geometry'),
    highlight: { active: ['role', 'name', 'state', 'bbox', 'cand', 'e-role-cand', 'e-name-cand', 'e-state-cand', 'e-bbox-cand'], compare: ['model'] },
    explanation: 'The agent should choose from candidate rows, not raw coordinates. A row can store accessible role, name, nearby text, disabled state, visibility, locator, bounding box, and screenshot crop.',
  };

  yield {
    state: candidatePlot(),
    highlight: { active: ['ranker', 'topk'], compare: ['risk'] },
    explanation: 'The more possible elements on a page, the higher the grounding risk. Candidate filtering and reranking reduce the action space before the model commits to a locator or coordinate.',
  };
}

function* targetMatch() {
  yield {
    state: targetGraph('Targeting is retrieval over UI candidates'),
    highlight: { active: ['instr', 'query', 'filter', 'rank', 'e-instr-query', 'e-query-filter', 'e-query-rank'], found: ['loc'] },
    explanation: 'A natural-language instruction becomes a query over candidate UI elements. Role filters, text similarity, visual position, and page context narrow the action target.',
  };

  yield {
    state: labelMatrix(
      'Rank',
      [
        { id: 'role', label: 'role' },
        { id: 'name', label: 'name' },
        { id: 'near', label: 'near' },
        { id: 'vis', label: 'vis' },
        { id: 'hist', label: 'hist' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['button', 'wrong type'],
        ['exact', 'synonym'],
        ['label', 'far text'],
        ['in view', 'hidden'],
        ['next step', 'stale'],
        ['low', 'unsafe'],
      ],
    ),
    highlight: { active: ['role:signal', 'name:signal', 'near:signal', 'vis:signal'], compare: ['hist:fail'] },
    explanation: 'Good target ranking blends semantic and mechanical signals: role, accessible name, nearby label, viewport visibility, prior trajectory, and policy risk.',
  };

  yield {
    state: targetGraph('Verify before acting, then observe the change'),
    highlight: { active: ['loc', 'verify', 'click', 'obs', 'e-loc-verify', 'e-verify-click', 'e-click-obs'], compare: ['repair'] },
    explanation: 'The chosen target still needs verification: it should be visible, stable, enabled, and unobscured. After the action, the agent should check whether the page state changed as expected.',
  };

  yield {
    state: targetGraph('Wrong targets become repair data'),
    highlight: { active: ['obs', 'repair', 'query', 'e-obs-repair', 'e-repair-query'], compare: ['click'] },
    explanation: 'If the click hits the wrong element or nothing changes, the failure should become a new candidate-ranking signal instead of a blind retry. Web-agent traces are training data for grounding.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ax snapshot') yield* axSnapshot();
  else if (view === 'target match') yield* targetMatch();
  else throw new InputError('Pick an accessibility target view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Accessibility-tree action targeting uses the browser accessibility tree as a structured index for web-agent actions. Instead of choosing only from pixels, the agent can reason over roles, accessible names, states, hierarchy, text, and bounding boxes.',
        'The accessibility tree does not replace screenshots. It complements them. Screenshots show layout and visual context; accessibility snapshots expose semantic structure that is often easier to rank and verify.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The browser derives accessibility nodes from DOM, CSS, ARIA attributes, and native HTML semantics. A candidate target row can include role, name, state, text, bounding box, locator, visibility, parent region, and screenshot crop.',
        'Target selection becomes retrieval. The user instruction is transformed into a query. The system filters candidates by role and state, ranks by name and context, verifies actionability, executes a locator or coordinate action, then checks whether the UI changed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Accessibility snapshots are compact compared with raw HTML, but they can still be large on complex pages. They can also omit purely visual hints that matter for layout. A robust system uses accessibility state for candidate generation and screenshots for visual confirmation.',
        'The ranking problem becomes hard when many elements share similar names, when components hide internals behind Shadow DOM, or when dynamic pages update between observation and action. This is why action ledgers need state hashes and retry reasons.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Playwright ARIA snapshot docs describe a YAML representation of the accessibility tree, including role, accessible name, attributes, and nested structure: https://playwright.dev/docs/aria-snapshots. Chrome DevTools accessibility docs explain how to inspect accessibility state in the browser: https://developer.chrome.com/docs/devtools/accessibility/reference.',
        'Mind2Web frames web-agent action selection over real websites and notes that raw HTML can be too large for LLMs, motivating filtering before model use: https://arxiv.org/abs/2306.06070. SeeAct studies visually grounded web agents and separates action generation from grounding: https://arxiv.org/abs/2401.01614.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A travel-booking browser agent can ask for buttons named Search, Continue, or Reserve instead of guessing coordinates. A form-filling agent can use labels and input roles to bind user data to the right fields. A QA agent can compare ARIA snapshots before and after a click to check structural changes.',
        'This also helps accessibility itself. If an agent cannot find a button by role and name, assistive technologies may struggle too. Browser-agent failures can reveal missing labels, ambiguous controls, and broken component semantics.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume the accessibility tree is complete ground truth. Some pages have broken ARIA, hidden text, duplicate names, or custom widgets with poor semantics. Do not use raw coordinates when a locator with role and name is available.',
        'Do not let the model invent selectors. Candidate rows should come from the harness, and the model should choose among verified candidates whenever possible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Playwright ARIA snapshots at https://playwright.dev/docs/aria-snapshots, Chrome DevTools accessibility reference at https://developer.chrome.com/docs/devtools/accessibility/reference, Mind2Web at https://arxiv.org/abs/2306.06070, SeeAct at https://arxiv.org/abs/2401.01614, and WebVoyager at https://arxiv.org/abs/2401.13919. Study Browser Actionability Auto-Wait Case Study, DOM Event Propagation & Path, Browser Rendering, Virtual DOM Reconciliation, and Computer-Use Agent Harness Loop Case Study next.',
      ],
    },
  ],
};
