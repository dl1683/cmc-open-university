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
      heading: 'Why this exists',
      paragraphs: [
        'A browser action is a state transition against a moving system. The page can re-render, animate, cover a button with a banner, disable a field during validation, or replace a DOM node between the model decision and the mouse event.',
        'Actionability exists because "the selector matched" is weaker than "the browser will deliver this action to the intended element." The runtime needs a precondition layer between intent and input.',
        'This matters even more for browser agents than for normal tests. A test author can fix a selector by hand. An agent often chooses a target from pixels, accessibility nodes, DOM text, and prior state. The runtime should remove mechanical flake so the evaluation measures planning and perception, not whether the page happened to finish animating.',
      ],
    },
    {
      heading: 'Baseline approach',
      paragraphs: [
        'The obvious approach is to click the selector or coordinate as soon as the agent chooses it. That works on static pages and small demos because the DOM, viewport, and overlay stack barely move.',
        'A slightly better version adds fixed sleeps: wait 500 ms after navigation, click, then wait again. Sleeps reduce some races, but they don\'t prove that the target is visible, stable, enabled, or topmost at the action point.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Existence is not readiness. A locator can match two buttons. A visible element can be moving. An enabled button can be covered by a cookie banner. A handle can point to a node that the framework just detached and replaced.',
        'Blind retry makes the wall worse. If the retry uses the same stale element or same coordinate, it repeats the same failure and hides the cause behind a timeout.',
      ],
    },
    {
      heading: 'Core state model',
      paragraphs: [
        'The useful state is not a click; it is an action request plus a gate vector. The request stores action type, locator or target evidence, intended state change, timeout budget, and observation id. The gate vector stores unique resolution, visibility, stability, event reception, enabled state, editability when needed, viewport position, and wait reason.',
        'The trace row should keep both the final action and the waits that made it safe. Without wait reasons, a timeout is only a symptom. With wait reasons, it becomes a bucket: ambiguous selector, hidden target, moving box, overlay, disabled control, detached node, or navigation race.',
        'That state model also separates target selection from action delivery. A model can be wrong about which button to press, and the gate can still deliver that wrong action reliably. Or the model can choose the right semantic target, while the gate refuses because the page is not ready. Keeping those errors separate is important for improving agents.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Resolve the locator fresh. Check that it points to exactly one candidate. Check that the candidate has a non-empty visible box, has stopped moving, receives pointer events at the action point, and is enabled. For text entry, also check editability.',
        'When the checks pass, scroll the target into view, dispatch the action, observe the next page state, and compare it with the intended state change. When a check fails until timeout, record the failed gate instead of collapsing every cause into "click failed."',
        'Retries should be conditional. Requery after detachment. Wait on animation frames for movement. Wait on a response, URL, or DOM predicate for navigation. Close or report an overlay instead of clicking through it. The repair should match the failed precondition.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reliability argument is an invariant: no browser event is sent until the target is the only matching element and the browser would route the event to that element now. Re-resolving the locator also prevents stale DOM handles from surviving across retries.',
        'This does not prove that the product did the right thing after the click. It proves the action was delivered to the intended UI target under explicit preconditions. The next observation and assertion handle product correctness.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Actionability adds DOM queries, layout checks, hit testing, scrolling, and at least a few animation frames for stability checks. The dominant cost is usually waiting, not computation. A 5 second timeout is cheap when it prevents a flaky checkout failure, but expensive when it fires on every step of an agent loop.',
        'The budget should be per action class and route. A login page may need longer navigation waits. A local settings toggle should not. Production traces should show p50, p95, and p99 wait time by gate so teams can tune the runner or fix the UI.',
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        'End-to-end test runners use actionability to turn UI tests from timing games into state checks. Browser agents need the same layer because model decisions are already noisy; the runtime should remove mechanical flake before blaming the model.',
        'The same trace improves product quality. If many actions wait on the same overlay, disabled button, or animation, the UI has a measurable interaction problem. Actionability telemetry turns "the agent is flaky" into a concrete frontend bug report.',
      ],
    },
    {
      heading: 'Concrete examples',
      paragraphs: [
        'A hotel agent clicks Reserve while a sticky cookie banner covers the lower viewport. A coordinate click may hit the banner. An actionability gate classifies the target as not receiving events, waits or closes the overlay, then retries from a fresh locator.',
        'A data-entry agent types into an email input just as React replaces the form after validation. A stale handle fails. A useful retry re-queries the locator, checks editability, types once, and verifies that the value appears in the next observation.',
        'A shopping agent presses Checkout while the page is still computing shipping rates. The button exists and is visible, but it is disabled because required data has not arrived. The correct repair is not a faster click; it is waiting on the rate-loaded condition or reporting that checkout is blocked.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Represent every action as a small record: target evidence, action type, precondition results, wait durations, dispatched input, and post-action observation. That record should survive in the trace so failures can be replayed without guessing.',
        'Prefer semantic locators when possible, such as accessible name and role, then fall back to DOM structure or coordinates when the page gives no better target. A strong runner combines semantic target choice with physical actionability checks because users need both: the right object and a deliverable event.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Forced clicks are a diagnostic tool, not a reliability strategy. They can bypass the event-reception check and create false passes that no user could reproduce.',
        'Fixed sleeps are also weak. They wait whether the page is ready or not, and they fail when the slow case takes longer than expected. Predicate waits age better because they wait for the condition that makes the action safe.',
        'Disabled controls deserve special treatment. If a button is disabled because the app is still loading, wait on the data signal. If it is disabled because the user lacks permission or the form is invalid, clicking harder is wrong.',
        'The most subtle failure is measuring only final success. A run can pass after ten seconds of hidden waiting and still be unusable for an agent benchmark or a real product workflow. Treat long wait budgets as debt: they may hide frontend instability, weak locators, or missing page-state signals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Playwright documents actionability checks for actions such as locator.click: unique resolution, visible, stable, receiving events, and enabled: https://playwright.dev/docs/actionability. Its trace viewer shows action snapshots, logs, locators, and timing after a run: https://playwright.dev/docs/trace-viewer. WebDriver BiDi defines asynchronous browser automation commands that can finish out of order, which is another reason trace ids and wait reasons matter: https://www.w3.org/TR/webdriver-bidi/.',
        'Study Accessibility Tree Action Target Case Study for semantic targets, DOM Event Propagation & Path for event delivery, Browser Rendering for layout and paint timing, requestAnimationFrame Frame Budget for stability checks, and Web Agent Evaluation Trace Ledger Case Study for benchmark-level replay.',
      ],
    },
  ],
};
