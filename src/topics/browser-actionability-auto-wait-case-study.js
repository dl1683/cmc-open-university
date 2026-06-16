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
    explanation: 'Playwright auto-waits for actionability checks before actions. Agent harnesses should copy this discipline rather than sending raw mouse events into unstable UI.',
  };

  yield {
    state: gateGraph('Scroll, act, observe, and record wait reasons'),
    highlight: { active: ['scroll', 'click', 'obs', 'trace', 'e-events-scroll', 'e-enabled-scroll', 'e-scroll-click', 'e-click-obs', 'e-click-trace'], compare: ['loc'] },
    explanation: 'After checks pass, the harness can scroll the target into view, execute the action, observe the new state, and record how long each gate waited.',
  };

  yield {
    state: waitPlot(),
    highlight: { active: ['ok', 'knee'], compare: ['slow'] },
    explanation: 'More waiting can reduce flaky failures, but long waits make agents slow. The trace should show which checks consumed the budget so teams can fix the UI or adjust the harness.',
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
    explanation: 'The trace should distinguish moving, covered, detached, disabled, and navigation failures. Those buckets become harness tuning, UI fixes, and benchmark error analysis.',
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
      heading: 'What it is',
      paragraphs: [
        'Browser actionability is the precondition layer between an intended action and an actual browser input event. It asks whether a locator resolves to the right element and whether that element is ready to receive the action.',
        'For computer-use agents, actionability is the difference between a repeatable action ledger and a pile of flaky clicks. The model can pick a target, but the harness should prove the target is unique, visible, stable, enabled, and not covered.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The action gate starts with a locator or candidate target. It checks uniqueness, visibility, stability, hit testing, enabled state, editability when needed, viewport position, and timeout budget. Only then does it scroll and click, type, select, drag, or press.',
        'The result should be observed and compared to the intended state change. If the action fails, the trace should classify the cause: moving element, overlay, detached DOM node, disabled state, navigation race, or selector ambiguity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Waiting improves reliability but increases latency. Too little waiting creates flaky agents; too much waiting makes agents unusable. A production harness should record which checks consumed time and tune by route, app, and action type.',
        'This is especially important for browser agents because the model step is already expensive. Mechanical browser waits should be precise and cheap, while the model should be reserved for decisions that actually need reasoning.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Playwright actionability docs list the checks it performs before actions such as locator.click: unique resolution, visibility, stability, event reception, and enabled state: https://playwright.dev/docs/actionability.',
        'W3C WebDriver BiDi defines a bidirectional protocol for remote browser control: https://www.w3.org/TR/webdriver-bidi/. MDN describes WebDriver BiDi as event-driven communication between automation client and browser: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A browser agent that clicks Reserve should not fire while a sticky cookie banner covers the button. A data-entry agent should not type into an input that has been detached and re-rendered. A test-repair agent should tell the difference between an app bug and a harness wait bug.',
        'Actionability traces also improve UI quality. If many users or agents wait on the same disabled button, overlay, or animation, the product has a measurable interaction problem.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat a coordinate click as equivalent to a semantic click. Coordinates are fragile under scrolling, responsive layout, zoom, and animation. Do not suppress actionability checks just to make a demo faster.',
        'Do not retry without refreshing the target. Modern frontend frameworks detach and replace nodes frequently, so a stale element is not repaired by clicking harder.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Playwright actionability at https://playwright.dev/docs/actionability, Playwright trace viewer at https://playwright.dev/docs/trace-viewer, WebDriver BiDi at https://www.w3.org/TR/webdriver-bidi/, and MDN WebDriver BiDi reference at https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi. Study Accessibility Tree Action Target Case Study, DOM Event Propagation & Path, Browser Rendering, requestAnimationFrame Frame Budget, and Web Agent Evaluation Trace Ledger Case Study next.',
      ],
    },
  ],
};
