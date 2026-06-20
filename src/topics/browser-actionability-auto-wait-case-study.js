// Browser actionability auto-wait: locate an element, prove it is ready for an
// action, execute, and retry safely when the page moves underneath the agent.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'browser-actionability-auto-wait-case-study',
  title: 'Browser Actionability Auto-Wait Case Study',
  category: 'Systems',
  summary: 'A browser automation case study: locator resolution, visibility, stability, event reception, enabled state, scroll, timeout, retry, and flaky-click repair.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['action gate', 'flaky click'], defaultValue: 'action gate' },
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

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'loc', label: 'loc', x: 0.7, y: 3.5, note: 'query' },
      { id: 'one', label: 'one', x: 2.0, y: 1.5, note: 'unique' },
      { id: 'vis', label: 'vis', x: 2.0, y: 3.5, note: 'shown' },
      { id: 'stable', label: 'stable', x: 2.0, y: 5.5, note: 'no anim' },
      { id: 'events', label: 'events', x: 3.8, y: 2.0, note: 'not cover' },
      { id: 'enabled', label: 'enable', x: 3.8, y: 5.0, note: 'ready' },
      { id: 'scroll', label: 'scroll', x: 5.6, y: 3.5, note: 'into view' },
      { id: 'click', label: 'click', x: 7.1, y: 3.5, note: 'action' },
      { id: 'obs', label: 'obs', x: 8.6, y: 2.0, note: 'state' },
      { id: 'trace', label: 'trace', x: 8.6, y: 5.0, note: 'waits' },
    ],
    edges: [
      { id: 'e-loc-one', from: 'loc', to: 'one' },
      { id: 'e-loc-vis', from: 'loc', to: 'vis' },
      { id: 'e-loc-stable', from: 'loc', to: 'stable' },
      { id: 'e-one-events', from: 'one', to: 'events' },
      { id: 'e-vis-events', from: 'vis', to: 'events' },
      { id: 'e-stable-enabled', from: 'stable', to: 'enabled' },
      { id: 'e-events-scroll', from: 'events', to: 'scroll' },
      { id: 'e-enabled-scroll', from: 'enabled', to: 'scroll' },
      { id: 'e-scroll-click', from: 'scroll', to: 'click' },
      { id: 'e-click-obs', from: 'click', to: 'obs' },
      { id: 'e-click-trace', from: 'click', to: 'trace' },
    ],
  }, { title });
}

function flakyGraph(title) {
  return graphState({
    nodes: [
      { id: 'act', label: 'act', x: 0.8, y: 3.5, note: 'click' },
      { id: 'anim', label: 'anim', x: 2.3, y: 1.6, note: 'moving' },
      { id: 'cover', label: 'cover', x: 2.3, y: 3.5, note: 'overlay' },
      { id: 'detach', label: 'gone', x: 2.3, y: 5.4, note: 'DOM' },
      { id: 'timeout', label: 'time', x: 4.0, y: 3.5, note: 'fail' },
      { id: 'retry', label: 'retry', x: 5.6, y: 3.5, note: 'fresh loc' },
      { id: 'wait', label: 'wait', x: 7.0, y: 2.0, note: 'signal' },
      { id: 'ok', label: 'ok', x: 7.0, y: 5.0, note: 'done' },
      { id: 'trace', label: 'trace', x: 8.8, y: 3.5, note: 'cause' },
    ],
    edges: [
      { id: 'e-act-anim', from: 'act', to: 'anim' },
      { id: 'e-act-cover', from: 'act', to: 'cover' },
      { id: 'e-act-detach', from: 'act', to: 'detach' },
      { id: 'e-anim-timeout', from: 'anim', to: 'timeout' },
      { id: 'e-cover-timeout', from: 'cover', to: 'timeout' },
      { id: 'e-detach-timeout', from: 'detach', to: 'timeout' },
      { id: 'e-timeout-retry', from: 'timeout', to: 'retry' },
      { id: 'e-retry-wait', from: 'retry', to: 'wait' },
      { id: 'e-wait-ok', from: 'wait', to: 'ok' },
      { id: 'e-ok-trace', from: 'ok', to: 'trace' },
      { id: 'e-timeout-trace', from: 'timeout', to: 'trace' },
    ],
  }, { title });
}

function waitPlot() {
  return plotState({
    axes: {
      x: { label: 'wait budget ms', min: 0, max: 5000 },
      y: { label: 'success probability', min: 0, max: 1 },
    },
    series: [
      { id: 'ok', label: 'pass', points: [{ x: 0, y: 0.35 }, { x: 500, y: 0.62 }, { x: 1200, y: 0.82 }, { x: 2400, y: 0.91 }, { x: 4200, y: 0.94 }] },
      { id: 'slow', label: 'cost', points: [{ x: 0, y: 0.08 }, { x: 500, y: 0.18 }, { x: 1200, y: 0.34 }, { x: 2400, y: 0.58 }, { x: 4200, y: 0.82 }] },
    ],
    markers: [
      { id: 'knee', x: 1600, y: 0.86, label: 'knee' },
    ],
  });
}

function* actionGate() {
  yield {
    state: gateGraph('Actionability is a gate before input'),
    highlight: { active: ['loc', 'one', 'vis', 'stable', 'events', 'enabled', 'e-loc-one', 'e-loc-vis', 'e-loc-stable', 'e-one-events', 'e-vis-events', 'e-stable-enabled'], found: ['click'] },
    explanation: 'A browser automation action should not click as soon as a selector exists. It should prove the target is unique, visible, stable, able to receive events, and enabled.',
    invariant: 'A click is a state transition with preconditions.',
  };

  yield {
    state: labelMatrix(
      'Checks',
      [
        { id: 'unique', label: 'one' },
        { id: 'visible', label: 'vis' },
        { id: 'stable', label: 'still' },
        { id: 'events', label: 'hit' },
        { id: 'enabled', label: 'on' },
        { id: 'edit', label: 'edit' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['1 elem', 'ambig'],
        ['box', 'hidden'],
        ['no anim', 'moving'],
        ['topmost', 'covered'],
        ['enabled', 'disabled'],
        ['writable', 'readonly'],
      ],
    ),
    highlight: { active: ['unique:ask', 'visible:ask', 'stable:ask', 'events:ask', 'enabled:ask'], compare: ['events:fail'] },
    explanation: 'Playwright auto-waits for actionability checks before actions. Agent runtimes should copy this discipline rather than sending raw mouse events into unstable UI.',
  };

  yield {
    state: gateGraph('Scroll, act, observe, and record wait reasons'),
    highlight: { active: ['scroll', 'click', 'obs', 'trace', 'e-events-scroll', 'e-enabled-scroll', 'e-scroll-click', 'e-click-obs', 'e-click-trace'], compare: ['loc'] },
    explanation: 'After checks pass, the runner can scroll the target into view, execute the action, observe the new state, and record how long each gate waited.',
  };

  yield {
    state: waitPlot(),
    highlight: { active: ['ok', 'knee'], compare: ['slow'] },
    explanation: 'More waiting can reduce flaky failures, but long waits make agents slow. The trace should show which checks consumed the budget so teams can fix the UI or adjust the runner.',
  };
}

function* flakyClick() {
  yield {
    state: flakyGraph('Flaky clicks have mechanical causes'),
    highlight: { active: ['act', 'anim', 'cover', 'detach', 'e-act-anim', 'e-act-cover', 'e-act-detach'], found: ['timeout'] },
    explanation: 'A failed browser action usually has a concrete cause: the element was moving, covered, detached from the DOM, disabled, outside the viewport, or no longer matched the locator.',
  };

  yield {
    state: labelMatrix(
      'Repair',
      [
        { id: 'move', label: 'move' },
        { id: 'cover', label: 'cover' },
        { id: 'gone', label: 'gone' },
        { id: 'disable', label: 'off' },
        { id: 'nav', label: 'nav' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bbox drift', 'wait still'],
        ['hit test', 'close/wait'],
        ['stale loc', 'requery'],
        ['disabled', 'await data'],
        ['new page', 'wait load'],
      ],
    ),
    highlight: { active: ['move:fix', 'cover:fix', 'gone:fix', 'nav:fix'], compare: ['disable:signal'] },
    explanation: 'The repair should match the cause. Requery for detached nodes, wait for animations, close overlays, wait for navigation, or escalate if the disabled state is the product decision.',
  };

  yield {
    state: flakyGraph('Retries need fresh locators and explicit waits'),
    highlight: { active: ['timeout', 'retry', 'wait', 'ok', 'e-timeout-retry', 'e-retry-wait', 'e-wait-ok'], compare: ['act'] },
    explanation: 'A blind retry repeats the same failure. A useful retry reacquires candidates, waits on a page signal, and verifies that the resulting state changed in the intended direction.',
  };

  yield {
    state: flakyGraph('Trace the failure cause, not only the timeout'),
    highlight: { active: ['timeout', 'ok', 'trace', 'e-timeout-trace', 'e-ok-trace'], compare: ['retry'] },
    explanation: 'The trace should distinguish moving, covered, detached, disabled, and navigation failures. Those buckets become runner tuning, UI fixes, and benchmark error analysis.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'action gate') yield* actionGate();
  else if (view === 'flaky click') yield* flakyClick();
  else throw new InputError('Pick a browser actionability view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'Web browser testing', caption:'Browser automation frameworks like Playwright auto-wait for actionability before clicking — visible, enabled, stable, and unobscured. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'The action-gate view traces a single browser action through its precondition pipeline. Active nodes are the gate currently being evaluated. Found nodes (green) mark the final action dispatch. Compare nodes (orange) mark the locator origin, reminding you that every gate re-resolves from a fresh query -- never a stale DOM handle.',
        'The flaky-click view traces a failed action backward to its mechanical cause. Active nodes are the failure diagnosis path. Compare nodes mark the original action attempt that triggered the failure. The trace node collects classified failure reasons so retries can be targeted.',
        'The wait-budget plot shows success probability (pass) against wait time, with a cost curve overlaid. The knee marker is the diminishing-returns point where longer waits buy little reliability but add latency.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'quote', text: 'The selector matched is not the same as the browser will deliver this event to the intended element.', attribution: 'Playwright actionability documentation, core design principle'},
        'A browser action is a state transition against a moving target. Between the moment an agent or test decides to click a button and the moment the mouse event fires, the page can re-render the element, animate it to a new position, cover it with a cookie banner, disable it during validation, or replace the DOM node entirely via a framework reconciliation pass.',
        'Traditional automation sends raw input events and hopes the page is ready. That works on static demos. On production UIs with transitions, lazy loading, skeleton screens, modals, and client-side routing, the gap between "element exists" and "element is ready for input" is the entire reliability problem.',
        {type: 'note', text: 'This matters more for browser agents than for human-authored tests. A test author sees flake and fixes the selector. An agent chooses targets from pixels, accessibility trees, and DOM text on every run. The runtime must remove mechanical flake so evaluation measures planning quality, not animation timing.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Click the selector as soon as it matches. On a static page this works because the DOM, viewport, and overlay stack are stable.',
        'The next step up is fixed sleeps: wait 500ms after navigation, click, wait 500ms again. Sleeps mask some races but prove nothing about the element state at the action point.',
        {type: 'table', headers: ['Strategy', 'What it handles', 'What it misses'], rows: [
          ['querySelector + click', 'Static pages, no overlays', 'Animations, overlays, disabled state, detached nodes, ambiguous selectors'],
          ['Fixed sleep + click', 'Slow navigations on fast machines', 'Fast machines that finish early (wasted time), slow machines that need longer (still flaky)'],
          ['waitForSelector + click', 'Element existence', 'Visibility, stability, event reception, enabled state, viewport position'],
        ]},
        'Each row adds a condition but none reaches the threshold where the browser will actually route the event to the intended target.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Existence is not readiness. Five distinct failures prove this:',
        {type: 'bullets', items: [
          'Ambiguity: the locator matches two "Submit" buttons -- one in a hidden form, one visible. querySelector returns the first in DOM order, which may be the wrong one.',
          'Visibility: the element has display:none, zero dimensions, or sits behind overflow:hidden. The DOM node exists; the user cannot see it.',
          'Instability: a CSS transition is sliding the button from off-screen to its final position. Clicking mid-animation hits the wrong coordinate.',
          'Interception: a cookie-consent overlay or a loading spinner sits on top. The element passes visibility checks but elementFromPoint returns the overlay, not the target.',
          'Detachment: React or Vue unmounts the old node and mounts a new one during reconciliation. The stored reference points to a garbage-collected fragment.',
        ]},
        'Blind retry compounds the problem. Retrying with the same stale handle or the same coordinate repeats the identical failure and hides the root cause behind a generic timeout.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the action request from the action delivery. The request carries intent: which element, what action, what the expected state change is, and how long to wait. The delivery passes through a gate vector of preconditions that must all hold simultaneously before the browser event fires.',
        {type: 'diagram', text: 'Action Request                    Gate Vector\n+-----------------------+         +------------------+\n| locator               |         | unique?     bool |\n| action_type (click,   |  -----> | visible?    bool |\n|   fill, check, ...)   |         | stable?     bool |\n| expected_state_change |         | receives    bool |\n| timeout_budget_ms     |         |   events?        |\n| observation_id        |         | enabled?    bool |\n+-----------------------+         | editable?   bool |\n                                  | viewport?   bool |\n                                  +------------------+\n                                         |\n                          all true?      |\n                          +----yes-----> scroll + dispatch\n                          +----no------> wait, re-resolve, retry', label: 'Action request vs. gate vector'},
        {type: 'note', text: 'This separation is the key architectural insight. A model can choose the wrong button and the gate still delivers that wrong action reliably. Or the model can choose the right button and the gate refuses because the page is not ready. Keeping target-selection errors apart from delivery errors is how you improve agents and UIs independently.'},
        'The trace row records both the final action and every gate wait. Without wait reasons, a timeout is only a symptom. With wait reasons, it becomes a classified bucket: ambiguous selector, hidden target, moving box, overlay interception, disabled control, detached node, or navigation race.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The actionability loop runs inside the timeout budget. Each iteration re-resolves the locator from scratch, evaluates the gate vector, and either dispatches or waits.',
        {type: 'code', text: '// Pseudocode: actionability loop\nasync function actionableClick(locator, timeout) {\n  const deadline = Date.now() + timeout;\n  while (Date.now() < deadline) {\n    const candidates = locator.resolveAll();    // fresh DOM query\n    if (candidates.length !== 1) {\n      record(\'ambiguous\', candidates.length);\n      await nextAnimationFrame(); continue;\n    }\n    const el = candidates[0];\n    const box = el.getBoundingClientRect();\n    if (box.width === 0 || box.height === 0) {\n      record(\'invisible\'); await nextAnimationFrame(); continue;\n    }\n    if (boxMovedSince(el, lastBox)) {\n      record(\'unstable\'); lastBox = box;\n      await nextAnimationFrame(); continue;\n    }\n    const topEl = document.elementFromPoint(box.x + box.width/2,\n                                             box.y + box.height/2);\n    if (!el.contains(topEl) && !topEl?.contains(el)) {\n      record(\'intercepted\', topEl); await nextAnimationFrame(); continue;\n    }\n    if (el.disabled || el.ariaDisabled === \'true\') {\n      record(\'disabled\'); await nextAnimationFrame(); continue;\n    }\n    scrollIntoViewIfNeeded(el);\n    el.click();\n    return { success: true, waits: getWaitLog() };\n  }\n  return { success: false, waits: getWaitLog() };\n}', language: 'javascript'},
        'Key details in the loop:',
        {type: 'bullets', items: [
          'Fresh resolution: the locator re-queries the DOM every iteration. This prevents stale-handle failures where a framework replaced the node between iterations.',
          'Stability check: the bounding box is compared across two consecutive animation frames. If it moved, the element is still animating. Two identical boxes prove the element has settled.',
          'Hit-test check: elementFromPoint at the center of the target box reveals whether an overlay intercepts the click. This catches cookie banners, loading spinners, and z-index stacking bugs that visibility checks alone miss.',
          'Wait classification: each failed gate records its specific reason. The final wait log distinguishes "waited 800ms for animation to settle" from "waited 1200ms for overlay to close" instead of collapsing everything into "click timed out."',
        ]},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on one invariant: no browser event is dispatched until the target is the only matching element, visible, stationary, topmost at the action point, and enabled. Re-resolving the locator each iteration prevents stale handles from surviving across retries.',
        {type: 'table', headers: ['Property', 'What it guarantees', 'Proof mechanism'], rows: [
          ['Uniqueness', 'The click goes to the intended element, not a same-name sibling', 'resolveAll().length === 1'],
          ['Visibility', 'The element occupies screen space a user could see', 'Bounding box has nonzero width and height'],
          ['Stability', 'The element is not mid-animation', 'Bounding box unchanged across two consecutive frames'],
          ['Event reception', 'No overlay intercepts the event', 'elementFromPoint returns the target or a descendant'],
          ['Enabled', 'The control accepts input', 'disabled === false and ariaDisabled !== "true"'],
        ]},
        'This does not prove the product behaved correctly after the click. It proves the click reached the intended UI target under explicit preconditions. Post-action assertions handle product correctness. The actionability layer handles delivery correctness.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The per-action overhead is a few DOM queries, one layout read (getBoundingClientRect), one hit test (elementFromPoint), and at least two animation frames for the stability check. The computation is negligible; the real cost is waiting.',
        {type: 'table', headers: ['Budget', 'Effect on reliability', 'Effect on speed'], rows: [
          ['0ms (no wait)', '~35% success on dynamic pages', 'Fastest possible, most flake'],
          ['500ms', '~62% success', 'Catches fast animations, misses slow navigations'],
          ['1500ms (knee)', '~85% success', 'Best reliability per unit of wait time'],
          ['3000ms', '~92% success', 'Diminishing returns; slow agents feel sluggish'],
          ['5000ms', '~94% success', 'Catches nearly everything but adds 5s worst-case per action'],
        ]},
        {type: 'note', text: 'The numbers above are representative of a mid-complexity SPA with transitions, lazy loading, and occasional modals. Static pages converge near 100% at 0ms. Heavy SPAs with client-side routing may need 3-5s budgets for navigation-triggered actions.'},
        'Production traces should report p50, p95, and p99 wait time per gate type. If p95 stability-wait exceeds 1s, the UI has a transition performance problem. If p95 interception-wait exceeds 2s, the overlay dismissal logic is broken. The wait budget is diagnostic, not just a reliability knob.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'bullets', items: [
          'E2E test runners (Playwright, Cypress): actionability turns UI tests from timing games into state-machine checks. Playwright auto-waits on every action by default; Cypress retries command chains with built-in assertions.',
          'Browser agents (WebVoyager, BrowserGym, AgentQ): model decisions are already noisy. The runtime removes mechanical flake so evaluation benchmarks measure planning and perception, not whether the page finished animating before the screenshot.',
          'RPA workflows: enterprise form-filling bots hit the same overlay, animation, and disabled-state problems at scale. Actionability replaces per-step sleep tuning with declarative preconditions.',
          'Accessibility auditing tools: the gate vector doubles as an interaction-readiness audit. Elements that consistently fail the enabled or event-reception gate are likely inaccessible to keyboard and assistive-technology users too.',
          'Frontend quality telemetry: aggregating wait reasons across thousands of agent runs turns "the agent is flaky" into a concrete bug report -- "the cookie banner intercepts 12% of checkout clicks" or "the Add to Cart button is disabled for 1.8s during price calculation."',
        ]},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Scenario: a browser agent clicks "Add to Cart" on a product page. The page has a cookie banner, the button animates in via CSS transition, and React re-renders the price component while the agent acts.',
        {type: 'table', headers: ['Iteration', 'Gate check', 'Result', 'Wait log entry'], rows: [
          ['1', 'resolveAll("Add to Cart")', '2 matches (one in sticky nav, one in product card)', 'ambiguous: 2 candidates'],
          ['2', 'resolveAll with visible filter', '1 match (product card button)', 'resolved to unique visible candidate'],
          ['2', 'getBoundingClientRect', 'width=120, height=40, y=580', 'visible: nonzero box'],
          ['2', 'stability (compare with previous frame)', 'y was 620 last frame, now 580', 'unstable: y moved 40px (CSS slide-in)'],
          ['3', 'stability', 'box unchanged: y=580 both frames', 'stable: settled after 2 frames'],
          ['3', 'elementFromPoint(center)', 'returns <div class="cookie-banner">', 'intercepted: cookie banner overlay'],
          ['4', 'elementFromPoint(center)', 'returns <button>Add to Cart</button>', 'receivesEvents: overlay dismissed'],
          ['4', 'el.disabled', 'false', 'enabled: true'],
          ['4', 'scrollIntoViewIfNeeded', 'no-op (already in viewport)', '(no scroll needed)'],
          ['4', 'el.click()', 'dispatched', 'action delivered after 4 iterations, 847ms total wait'],
        ]},
        {type: 'note', text: 'Without actionability, iteration 1 would click the wrong button (nav duplicate), iteration 2 would click mid-animation (wrong coordinate), and iteration 3 would click the cookie banner. Only iteration 4 delivers the event to the intended target under correct preconditions.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {type: 'table', headers: ['Failure mode', 'Mechanism', 'Consequence'], rows: [
          ['force: true bypass', 'Skips the event-reception gate and dispatches directly', 'Creates false passes no real user could reproduce; masks overlay bugs'],
          ['Fixed sleep instead of gate', 'Waits a constant time regardless of page state', 'Too short on slow machines (still flaky), too long on fast machines (wasted time)'],
          ['Stale handle retry', 'Retry reuses the old element reference instead of re-resolving', 'Repeats the same failure; detached nodes throw or click garbage-collected fragments'],
          ['Disabled = just wait longer', 'Treats disabled controls as temporarily blocked', 'Some controls are disabled by design (no permission, invalid form); waiting forever is wrong'],
          ['Hidden wait debt', 'Passes after 8s of waiting but reports success', 'Hides frontend instability; agent benchmarks report high accuracy with unusable latency'],
        ]},
        'The subtlest failure is treating success-after-long-wait as equivalent to success. A checkout flow that passes after 8 seconds of hidden waiting per action is technically correct but unusable for real users or agent benchmarks. Wait budgets should be tracked as latency debt: high p95 wait times signal broken UI, weak locators, or missing page-ready signals.',
        {type: 'code', text: '// Anti-pattern: force click bypasses the gate\nawait page.click(\'#submit\', { force: true });  // skips all checks\n// The click "succeeds" even if a modal covers the button.\n// The test passes. The user cannot reproduce.\n\n// Correct: let the gate refuse and diagnose\nawait page.click(\'#submit\', { timeout: 5000 });\n// If this times out, the trace shows WHY:\n//   "intercepted by .cookie-overlay for 5000ms"\n// That is a frontend bug report, not a test flake.', language: 'javascript'},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'note', text: 'Primary sources for the actionability model and its implementations:'},
        {type: 'bullets', items: [
          'Playwright actionability documentation: https://playwright.dev/docs/actionability -- defines the six checks (visible, stable, enabled, receives events, editable, unique) that gate every action.',
          'Playwright trace viewer: https://playwright.dev/docs/trace-viewer -- shows per-action snapshots, locator resolution, wait reasons, and timing after a run.',
          'WebDriver BiDi specification: https://www.w3.org/TR/webdriver-bidi/ -- defines asynchronous browser automation commands that can complete out of order, motivating trace IDs and wait-reason logging.',
          'Cypress retry-ability: https://docs.cypress.io/app/core-concepts/retry-ability -- Cypress retries command chains with built-in assertions rather than using explicit waits, a different approach to the same actionability problem.',
          'W3C ARIA in HTML: https://www.w3.org/TR/html-aria/ -- defines disabled, hidden, and interactive states that inform the enabled and editable gates.',
        ]},
        'Related topics on this site: Accessibility Tree Action Target Case Study for semantic locator resolution. DOM Event Propagation and Path for how the browser routes pointer events through the DOM tree. Browser Rendering for layout, paint, and composite timing that determines when getBoundingClientRect returns stable values. requestAnimationFrame Frame Budget for the stability-check timing model. Web Agent Evaluation Trace Ledger Case Study for how wait-reason logs feed benchmark-level replay and error analysis.',
      ],
    },
  ],
};

