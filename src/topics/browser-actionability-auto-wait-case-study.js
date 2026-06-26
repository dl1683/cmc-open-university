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
              {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'Web browser testing', caption:'Browser automation frameworks like Playwright auto-wait for actionability before clicking — visible, enabled, stable, and unobscured. Source: Wikimedia Commons, CC BY-SA 4.0'},,
        'Read the actionability pipeline as a proof before input. A locator is the rule used to find an element, such as text, role, CSS selector, or test id. A gate is one precondition that must be true before the browser action is delivered.',
        'The safe inference rule is all gates at once. A click is ready only when the target is unique, visible, stable, enabled, and receiving events at the click point. If one gate fails, the automation should wait, re-resolve the locator, and try the checks again.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
              {type:'callout', text:'An actionable click is not a selector match; it is a proof that the browser will deliver the event to the intended element at that moment.'},,
        'Browser automation exists in a moving page, not a static document. A button can exist in the DOM while an animation moves it, a spinner covers it, a form disables it, or a framework replaces the node. A raw click can therefore hit the wrong place even when the selector looked correct.',
        'Auto-waiting exists to remove timing guesses from tests and browser agents. The runtime should wait for mechanical readiness so failures mean the page or the plan is wrong, not that the script clicked 200 ms too early. This matters for end-to-end tests and for agents that choose actions from screenshots or accessibility trees.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is query then click. Find the first matching element and dispatch the event immediately. It works on static pages where the DOM is stable and no overlay appears.',
        'The next approach is fixed sleep. Wait 500 ms after navigation, then click. Sleeps sometimes hide races, but they do not prove the element can receive the event, and they waste time when the page was already ready.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that existence is not actionability. A node can match a selector while hidden, detached, disabled, covered, duplicated, or moving. The browser routes pointer events by rendered geometry and event hit testing, not by the fact that a test found a node.',
        'Retries without fresh checks repeat the same failure. If a framework replaced the element, a stale handle points to dead state. If a cookie banner covers the button, clicking the same coordinate again only clicks the banner again.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate target selection from event delivery. Target selection asks which element the user or agent intends. Event delivery asks whether the browser would deliver the event to that element now.',
        'An actionability gate vector makes that second question explicit. The runtime repeatedly re-resolves the locator, checks visibility, checks stability across frames, checks hit testing with elementFromPoint, checks enabled state, and only then dispatches the input. The wait log records which gate consumed time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loop starts with a deadline. Each iteration resolves the locator from the live DOM rather than reusing an old handle. If resolution gives zero or multiple candidates, the loop waits because the target is not uniquely defined.',
        'For one candidate, the runtime reads its bounding box and visibility. It compares layout across animation frames to ensure the element is not moving. It hit-tests the intended point to ensure no overlay receives the event, then checks whether the control is enabled and editable when the action requires editing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant on dispatch. No event is sent until the chosen element is the only candidate, occupies visible space, is not moving, is topmost at the action point, and can accept the action. Re-resolving each iteration prevents detached-node state from surviving retries.',
        'This does not prove the application result is correct. It proves delivery correctness: the click, fill, or check reached the intended UI target under explicit preconditions. Product assertions after the action still decide whether the application behaved correctly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The CPU cost is small: DOM queries, layout reads, hit tests, and frame waits. The real cost is latency. If the timeout is 5 seconds, a failing action can spend the full 5 seconds proving that no safe delivery point appeared.',
        'Cost behaves like a reliability budget. A 0 ms wait is fastest but flaky on animated pages. A 1,500 ms budget may catch normal transitions, while a 5,000 ms budget catches slow pages but makes failures expensive. Doubling the budget can double worst-case action latency without doubling reliability.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'End-to-end test runners use actionability to make UI tests less timing-sensitive. Browser agents use it so benchmark results measure planning and perception rather than whether the page finished animating. RPA workflows use the same idea for enterprise forms with overlays, disabled controls, and slow client-side routing.',
        'Actionability logs are also frontend telemetry. If many clicks wait on stability, animations are too long or layout shifts are happening. If many clicks wait on event reception, overlays or z-index layers are intercepting real users too.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Actionability fails when users bypass it with force clicks. A forced click can make a test pass even though a real user could not click the covered element. That creates false confidence and hides frontend bugs.',
        'It also fails when a disabled state is semantic rather than temporary. If a Submit button is disabled because the form is invalid or the user lacks permission, waiting longer will never make the action correct. The automation must distinguish not ready yet from not allowed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An agent tries to click Add to Cart. At iteration 1, the locator matches two buttons: one in a sticky header and one in the product card, so the uniqueness gate fails after 40 ms. At iteration 2, filtering by visible product-card context gives one candidate.',
        'The button is sliding from y = 620 to y = 580, so the stability gate waits two animation frames until the bounding box stops changing. At iteration 3, elementFromPoint at the button center returns a cookie banner, so the event-reception gate waits. At iteration 4, the banner is gone, the button is enabled, and the click dispatches after 847 ms total.',
        'A raw click would have failed three different ways: wrong duplicate, wrong coordinate, or overlay interception. The auto-wait trace turns those into named waits. That gives engineers a repair path instead of a generic flaky timeout.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Playwright actionability documentation, Playwright trace viewer docs, Cypress retry-ability docs, WebDriver BiDi, and W3C ARIA in HTML. Read them to separate locator semantics, browser input dispatch, and post-action assertions.',
        'Study next by role. For browser mechanics, study DOM event propagation, hit testing, layout, and requestAnimationFrame. For agents, study accessibility tree action targets and trace ledgers. For testing, study locator design, retries, and failure classification.',
      ],
    },
  ],
};
