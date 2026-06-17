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
      heading: 'Why this exists',
      paragraphs: [
        `A browser agent has to turn language into a safe UI action. A user says "book the trip," "click Search," or "enter the email address," and the agent must choose one target among many visible and hidden interface elements. Pixels alone are a weak representation for that job. A button, link, disabled control, decorative icon, input placeholder, and menu item can look similar in a screenshot while having very different browser semantics.`,
        `The accessibility tree exists to expose those semantics. Browsers derive it from the rendered DOM, CSS, ARIA attributes, and native HTML behavior so assistive technologies can understand roles, names, states, and relationships. A browser agent can use the same structure as grounding evidence. Instead of selecting from every coordinate on the screen or every node in raw HTML, the agent can select from candidate action targets with meaningful fields.`,
        `This case study treats action targeting as retrieval over accessible candidates. The system builds a snapshot, extracts elements with role, name, state, hierarchy, bounding box, and locator, ranks them against the instruction, verifies that the chosen target is currently actionable, performs the action, and then observes whether the page changed as expected. That loop is the difference between a blind clicker and a browser agent that can be debugged.`,
      ],
    },
    {
      heading: 'Why the obvious approaches fail',
      paragraphs: [
        `The simplest baseline sends a screenshot to a model and asks for click coordinates. That can work on small static pages where the target is visually obvious. It fails on dense forms, admin tools, custom controls, repeated buttons, sticky headers, hidden overlays, and responsive layouts. Coordinates also age badly: a re-render, scroll, font load, or viewport change can move the target before the click lands.`,
        `The next baseline sends raw HTML. That gives more structure, but modern web pages can contain thousands of nodes, generated class names, hidden templates, framework wrappers, portals, Shadow DOM, duplicate text, and elements that are not action targets. Raw DOM is too much structure in the wrong shape. It describes implementation details, not necessarily the user-perceived control.`,
        `A third baseline lets the model invent selectors. That is unsafe because the model may produce a selector that happens to match a stale element, a hidden element, the wrong duplicate, or nothing at all. The runtime should generate verified candidates and locators. The model can rank and choose among them, but the browser automation layer should own the mechanics of finding, checking, and acting on the target.`,
      ],
    },
    {
      heading: 'Core insight and data model',
      paragraphs: [
        `The useful unit is a candidate row. A row can store accessible role, accessible name, state, hierarchy, nearby text, visibility, enabled or disabled status, selected or expanded state, bounding box, viewport membership, locator, screenshot crop, source snapshot ID, and risk annotations. This joins semantic evidence to mechanical actionability.`,
        `Role answers what kind of thing the element is: button, link, textbox, checkbox, menu item, heading, dialog, table cell, and so on. Name answers how the user or assistive technology would identify it: Search, Email, Continue, Billing address. State answers whether it is disabled, checked, selected, expanded, pressed, hidden, required, invalid, or otherwise constrained. Geometry answers where it is and whether a click or input can physically reach it.`,
        `The candidate table is intentionally smaller and more opinionated than raw page data. It discards decorative nodes, hidden nodes, and implementation wrappers when they are not useful action targets. It keeps enough context to distinguish duplicates: parent region, nearby label, form ownership, list position, bounding box, and recent trajectory. The goal is not to represent the whole page. The goal is to represent plausible actions.`,
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        `The browser first renders the page and builds an accessibility tree. The runtime snapshots that tree, joins it with bounding boxes and visibility information, and turns it into candidate rows. It then filters candidates by the instruction. A request to "click Search" should prefer visible enabled buttons or links named Search, not hidden templates, disabled controls, or unrelated text nodes.`,
        `Ranking blends semantic and spatial signals. Exact accessible-name matches are strong, but synonyms, nearby labels, parent regions, form context, and task history also matter. If the user asks for "billing ZIP code," the best candidate may be a textbox named "ZIP" inside a Billing address region, not the first textbox named ZIP on the page. If the instruction is the next step in a checkout flow, trajectory can help distinguish the correct Continue button from a newsletter modal.`,
        `Before acting, the system verifies the candidate mechanically. The element should still exist in the current observation, be visible, enabled, stable, unobscured, and appropriate for the intended operation. After the click or input, the system observes again and checks for the expected state change. If nothing changes, the wrong dialog opens, or validation fails, that failure becomes repair data for a new candidate query rather than a blind retry.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The reliability gain comes from reducing the action space. A screenshot has thousands or millions of possible coordinates. Raw HTML can have thousands of nodes. A candidate table may have dozens of plausible controls, each with role, name, state, and geometry. The model is much better at choosing among labeled candidates than inventing a coordinate from scratch.`,
        `The second gain is independent verification. A semantic match is not enough because the right-looking target might be disabled, offscreen, covered by a modal, stale after re-render, or only a label rather than the input itself. Mechanical checks catch those problems before the action. Post-action observation catches cases where the click technically happened but did not advance the task.`,
        `The third gain is shared benefit with accessibility. If a control has a correct role and accessible name, both assistive technology and browser agents can identify it. If an agent cannot find button "Search" or textbox "Email" through the accessibility tree, that may reveal the same missing label or ambiguous control that would hurt a screen-reader user. Good action grounding and good accessibility often depend on the same source facts.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a travel booking page. The instruction is "choose the refundable fare and continue." A screenshot-only agent may see several price cards and several Continue buttons. A raw-DOM agent may see every nested div in the fare table. An accessibility-targeting runtime builds candidates: radio buttons or buttons for fare choices, names such as "Refundable," state values such as selected or disabled, parent regions for each flight option, and bounding boxes for action.`,
        `The ranker first finds candidates related to "Refundable." It prefers a visible enabled fare option inside the current flight card. After selecting it, the page may update the state of the option and enable a Continue button. The runtime observes again, then ranks Continue candidates. If there are multiple Continue buttons, parent region, viewport position, enabled state, and recent interaction history distinguish the one associated with the booking flow from a cookie banner or newsletter panel.`,
        `If the click fails because a modal covers the button, the post-action observation shows no expected transition. The repair step can add the modal dismiss button to the candidate set or choose a different visible Continue button. The failure is not just "the model clicked wrong." It is evidence that the candidate row was stale, obstructed, under-contextualized, or missing a relevant overlay state.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The accessibility tree can be wrong, incomplete, or misleading. Broken ARIA can assign the wrong role. Duplicate accessible names can make two controls indistinguishable. Custom widgets can expose only a generic container. Canvas applications may provide little meaningful tree structure. Virtualized lists may omit offscreen options until the page scrolls. Localization can change labels while the task instruction remains in another language.`,
        `Candidate ranking can also fail when the target is defined visually rather than semantically. Instructions such as "click the red warning icon," "drag the left handle," or "choose the largest chart bar" require visual grounding. The accessibility tree may still help locate the chart region or toolbar, but it cannot replace vision when color, shape, or spatial comparison is the essence of the task.`,
        `Automation introduces stale-state failures. A candidate can be correct when extracted and wrong a moment later after a React render, route transition, animation, or validation update. This is why observation hashes, freshness checks, and actionability checks matter. The system should not click a candidate from an old snapshot without proving that it still refers to the current page state.`,
      ],
    },
    {
      heading: 'Operational and implementation guidance',
      paragraphs: [
        `Generate candidates in the runtime, not in the model. Use browser APIs, accessibility snapshots, locators, and bounding boxes to produce a bounded set of options. Include enough fields for ranking, but avoid dumping the entire page when a filtered table would do. For most tasks, viewport-visible actionable roles should be considered before hidden or purely structural nodes.`,
        `Prefer durable locators over coordinates when possible. A coordinate can be the last-mile action point, but the candidate should carry a locator that can be re-resolved and checked. Playwright-style role and name locators are valuable because they align with user-perceived semantics. When the locator cannot represent the target, keep the screenshot crop and geometry as explicit fallback evidence.`,
        `Make verification a required stage. Before a click, verify visibility, enabled state, stability, and obstruction. Before typing, verify that the target accepts text and is focused. Before selecting, verify that the option exists in the open control, not merely in a hidden template. After acting, observe for a state change tied to the task. Store failures with the candidate fields that caused the decision so the ranker can improve.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `This pattern matters in browser-use agents, end-to-end test generation, robotic process automation, accessibility auditing, form filling, data entry, booking flows, support dashboards, and enterprise admin software. These domains punish wrong clicks. A mistaken target can submit a form, delete data, purchase the wrong item, leak information, or leave the system in an unknown state.`,
        `It also matters for evaluation. A benchmark that only checks whether an agent eventually completes a task can hide how often it clicked irrelevant elements, relied on brittle coordinates, or recovered by luck. Candidate-based targeting gives evaluators more inspectable traces: what the agent saw, which candidates were considered, why one was selected, what verification passed, and what changed after the action.`,
        `For product teams, the same traces can become accessibility feedback. Unlabeled buttons, duplicate names, controls without state, and hidden interactive elements are not only bad for agents. They are signs that the UI may be hard for keyboard users and assistive-technology users as well.`,
      ],
    },
    {
      heading: 'Concrete failures',
      paragraphs: [
        `A page with two buttons named Submit can send the agent to the wrong form unless parent region, nearby labels, form ownership, and bounding boxes are part of ranking. A disabled Submit button can be the best semantic match and still fail the actionability check. A hidden Submit in a template can match raw DOM text but should never be a candidate for a visible click.`,
        `A custom dropdown often requires a two-step state machine. Before opening, the accessibility tree may expose only the collapsed combobox or button. After opening, the options become visible candidates. An agent that searches for the option before opening the control may conclude the target is missing. The repair policy should know that some targets appear only after an intermediate action.`,
        `A canvas editor is the opposite case. The accessible tree may expose a toolbar and one canvas region, while the real target is a shape inside the canvas. Candidate targeting can still choose the canvas or tool button, but fine-grained action needs visual analysis and coordinate geometry. A robust browser agent treats the accessibility tree as one evidence source, not a universal replacement for vision.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Playwright ARIA snapshots at https://playwright.dev/docs/aria-snapshots and Chrome DevTools accessibility reference at https://developer.chrome.com/docs/devtools/accessibility/reference. Read them as implementation handles: snapshots expose role and name structure, while browser debugging tools show how DOM, CSS, ARIA, and rendered state become accessibility information.`,
        `Study Browser Actionability Auto-Wait Case Study for visibility, stability, and enabled checks. Study DOM Event Propagation & Path for what happens after a click. Study Browser Rendering for how pixels and boxes appear. Study Virtual DOM Reconciliation for stale candidate failures. Study Computer-Use Agent Runtime Loop Case Study for observe-act-repair loops. Study Information Retrieval and Ranking if you want the scoring model behind candidate selection.`,
      ],
    },
  ],
};
