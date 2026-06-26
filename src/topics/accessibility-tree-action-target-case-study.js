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
      heading: 'How to read the animation',
      paragraphs: [
        'The ax-snapshot view shows how a browser turns a rendered page into an accessibility tree. An accessibility tree is a simplified structure of user-facing controls, labels, roles, and states that assistive technologies use. Active nodes show the current source of evidence, such as DOM structure, CSS visibility, ARIA attributes, or layout bounds.',
        'The target-match view shows a browser agent converting an instruction into one action target. Watch the candidate rows, not the pixels. A candidate row joins role, name, state, bounding box, and parent region so the agent can score, verify, act, and observe.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'Web browser interface', caption:'Browsers build an accessibility tree from every page — merging DOM, CSS, ARIA, and native semantics into a structured representation. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'A browser agent needs to turn language such as click the billing ZIP field into one safe UI action. The page may contain duplicate labels, hidden controls, disabled buttons, overlays, and controls that move after rendering. A wrong target can submit a form, delete data, or send credentials to the wrong place.',
        'Pixels and raw HTML each miss part of the target. Pixels show location but not role or disabled state. Raw HTML shows implementation structure but not what is visible, reachable, or perceived by users.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is screenshot targeting. Send a screenshot to a model, ask for coordinates, and click the returned point. This works on sparse pages with one clear button and no timing change between observation and click.',
        'Another natural approach is to send raw HTML or let the model invent a CSS selector. This feels more precise because the page structure is textual. It still depends on implementation details such as generated class names, framework wrappers, and duplicate elements.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Coordinates have no semantic contract. The point (410, 320) might be a button now, but a re-render, font load, sticky header, or modal can move the target before the click. A coordinate also cannot prove that the element is enabled, visible, or the right copy among duplicates.',
        'Selectors are brittle in the opposite direction. A selector can match hidden templates, offscreen controls, or several elements with the same label. The invariant is stricter: the target must uniquely match the instruction, support the intended action, and remain actionable at click time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'The useful unit for browser agents is not a pixel coordinate or a CSS selector — it is a candidate row: role + name + state + bounding box + parent region. This is information retrieval over UI elements.'},
        'Action targeting is retrieval over UI elements. The instruction is the query, and candidate rows are the searchable documents. A row keeps the fields that matter for both meaning and mechanics: role, accessible name, state, parent region, bounding box, viewport membership, and locator.',
        'This representation shrinks the action space. A 1080p screenshot has about 2 million pixel positions, while a busy form may have 30 to 80 actionable candidates after filtering. The model no longer invents a location; it chooses among labeled controls and the runtime verifies the winner.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt:'Decision tree for element selection', caption:'Action targeting works like a decision tree: snapshot the page, extract candidates, rank by instruction match, verify actionability, and observe the result. Source: Wikimedia Commons, CC BY-SA 4.0'},
        {type:'callout', text:'The browser has already done the hard work. Chromium\\u2019s accessibility tree merges DOM structure, CSS visibility, ARIA attributes, and native HTML semantics. Browser agents reuse this existing computation instead of building their own page understanding from scratch.'},
        'The pipeline has five stages: snapshot, extract, rank, verify, and observe. Snapshot asks the browser for the current accessibility tree and layout data. Extract walks the tree, keeps actionable roles, and drops hidden, decorative, and structural-only nodes.',
        'Ranking scores candidates by name match, role match, parent context, state compatibility, spatial plausibility, and recent trajectory. Verification re-resolves the locator in the current page and checks that it is visible, enabled, stable, and unobscured. Observation takes a new snapshot after the action and checks whether the expected state changed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a reduction. The system reduces a continuous coordinate problem to a finite candidate-selection problem, then verifies the selected element against browser actionability rules. If the candidate is semantically matched, mechanically actionable, and produces the expected state change, the action is grounded.',
        'The accessibility tree also shares incentives with real accessibility. A button with a correct role and name helps screen-reader users and helps agents. If the agent cannot find Search through the accessibility tree, that is often evidence of the same missing label that would hurt a human using assistive technology.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is snapshot freshness. A full accessibility snapshot may take 50 to 200 ms on a complex page, extraction may take 5 to 20 ms, and verification may wait another 50 to 100 ms for stability. Ranking tens of candidates is usually cheap compared with those browser operations.',
        'The cost behaves linearly with accessible nodes for extraction, but not every DOM node becomes a candidate. Doubling the DOM can double snapshot time while leaving the candidate set almost unchanged. The extra latency is usually worth it because a wrong click can cost far more than a 100 ms verification wait.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Browser agents use this pattern for form filling, booking flows, internal dashboards, and web research tasks. End-to-end test tools use role-and-name locators for the same reason: they survive many DOM refactors that break CSS selectors. Robotic process automation uses similar fields when enterprise apps expose stable accessible names.',
        'The trace is useful for evaluation. A task result alone hides wrong clicks, retries, and lucky recoveries. Candidate-based traces record what the agent saw, which rows scored highest, what verification passed, and what changed after the action.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The tree fails when the page exposes poor accessibility data. Missing names, duplicate labels, wrong roles, closed shadow roots, canvas apps, and virtualized lists all remove or distort candidates. A model cannot retrieve a candidate that the representation never exposes.',
        'It also fails for instructions that are mainly visual. Click the red warning icon, drag the left handle, or choose the tallest bar may require pixel-level reasoning. The accessibility tree can find the chart or toolbar region, but fine targeting may need vision plus the candidate pipeline.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A travel page receives the instruction choose the refundable fare and continue. The snapshot has 47 accessible nodes and extraction keeps 12 actionable candidates. Three relevant rows are radio Refundable in group Outbound at y = 420, radio Refundable in group Return at y = 620, and link Refund Policy in the footer.',
        'The ranker gives the outbound radio 7 points: +3 for exact name, +2 for radio role, +1 for the current outbound step, and +1 for unchecked state. The return radio gets 6 because the group context is weaker, and the footer link gets 0 because it is not a selection control. Verification re-resolves the outbound radio, confirms it is visible and enabled, clicks it, and observes the state change to checked.',
        'The next instruction is continue, and the new snapshot contains two Continue buttons. One is in the booking form and enabled after fare selection; the other is in a cookie banner. Parent region and recent trajectory select the booking button, while verification prevents a stale or covered click.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the W3C WAI-ARIA specification for roles, states, properties, and accessible-name computation. Study Playwright ARIA snapshots for a practical serialization of role and name locators. Study Chrome DevTools accessibility documentation to inspect how Chromium builds the tree.',
        'Study next: Browser Actionability Auto-Wait for verification, DOM Event Propagation for what happens after a click, Virtual DOM Reconciliation for stale targets, Browser Rendering Pipeline for the pixel layer, and Computer-Use Agent Runtime Loop for observe-act-repair control.',
      ],
    },
  ],
};
