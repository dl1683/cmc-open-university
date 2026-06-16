// DOM event dispatch: event path construction, capture/target/bubble phases,
// composedPath, shadow DOM retargeting, delegation, and propagation stops.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dom-event-propagation-composed-path-case-study',
  title: 'DOM Event Propagation & Path',
  category: 'Systems',
  summary: 'How DOM dispatch builds an event path, invokes capture, target, and bubble listeners, retargets across shadow DOM, and powers event delegation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['capture bubble', 'shadow retarget'], defaultValue: 'capture bubble' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function eventGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'window', label: 'window', x: 0.8, y: 4.0, note: notes.window ?? 'root' },
      { id: 'doc', label: 'doc', x: 2.1, y: 4.0, note: notes.doc ?? 'Document' },
      { id: 'app', label: 'app', x: 3.5, y: 4.0, note: notes.app ?? 'delegate' },
      { id: 'list', label: 'list', x: 5.0, y: 4.0, note: notes.list ?? 'parent' },
      { id: 'button', label: 'button', x: 6.6, y: 4.0, note: notes.button ?? 'target' },
      { id: 'path', label: 'path', x: 8.0, y: 2.5, note: notes.path ?? 'array' },
      { id: 'phase', label: 'phase', x: 8.0, y: 5.5, note: notes.phase ?? 'capture/bubble' },
    ],
    edges: [
      { id: 'e-window-doc', from: 'window', to: 'doc', weight: '' },
      { id: 'e-doc-app', from: 'doc', to: 'app', weight: '' },
      { id: 'e-app-list', from: 'app', to: 'list', weight: '' },
      { id: 'e-list-button', from: 'list', to: 'button', weight: '' },
      { id: 'e-button-path', from: 'button', to: 'path', weight: '' },
      { id: 'e-path-phase', from: 'path', to: 'phase', weight: '' },
    ],
  }, { title });
}

function shadowGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.8, y: 4.0, note: notes.doc ?? 'outside' },
      { id: 'host', label: 'host', x: 2.5, y: 4.0, note: notes.host ?? 'target out' },
      { id: 'shadow', label: 'shadow', x: 4.2, y: 4.0, note: notes.shadow ?? 'root' },
      { id: 'slot', label: 'slot', x: 5.8, y: 2.5, note: notes.slot ?? 'optional' },
      { id: 'inner', label: 'inner', x: 5.8, y: 5.5, note: notes.inner ?? 'real node' },
      { id: 'path', label: 'path', x: 7.7, y: 4.0, note: notes.path ?? 'composed' },
      { id: 'listener', label: 'listen', x: 9.0, y: 4.0, note: notes.listener ?? 'sees target' },
    ],
    edges: [
      { id: 'e-doc-host', from: 'doc', to: 'host', weight: '' },
      { id: 'e-host-shadow', from: 'host', to: 'shadow', weight: '' },
      { id: 'e-shadow-slot', from: 'shadow', to: 'slot', weight: '' },
      { id: 'e-shadow-inner', from: 'shadow', to: 'inner', weight: '' },
      { id: 'e-inner-path', from: 'inner', to: 'path', weight: '' },
      { id: 'e-path-listener', from: 'path', to: 'listener', weight: '' },
      { id: 'e-host-listener', from: 'host', to: 'listener', weight: '' },
    ],
  }, { title });
}

function* captureBubble() {
  yield {
    state: eventGraph('Dispatch builds an event path from target to root'),
    highlight: { active: ['button', 'list', 'app', 'doc', 'window', 'e-list-button', 'e-app-list', 'e-doc-app', 'e-window-doc'], found: ['path'] },
    explanation: 'When a DOM event is dispatched, the browser computes an event path. That path is the ordered list of EventTargets whose listeners may be invoked.',
    invariant: 'Dispatch walks a precomputed path, not a live selector query.',
  };

  yield {
    state: eventGraph('Capture runs from root toward the target', { phase: 'capture' }),
    highlight: { active: ['window', 'doc', 'app', 'list', 'e-window-doc', 'e-doc-app', 'e-app-list'], compare: ['button'] },
    explanation: 'Listeners registered with capture run on the way down. This lets ancestors observe or intercept an event before it reaches the target.',
  };

  yield {
    state: eventGraph('Target listeners run at the target node', { phase: 'at target', button: 'phase 2' }),
    highlight: { active: ['button', 'phase', 'e-button-path', 'e-path-phase'], found: ['button'] },
    explanation: 'At the target, capture and bubble listeners on the target can run according to the event dispatch rules. event.currentTarget is the listener node; event.target is the adjusted target.',
  };

  yield {
    state: eventGraph('Bubble runs back up if the event bubbles', { phase: 'bubble', app: 'delegate' }),
    highlight: { active: ['button', 'list', 'app', 'doc', 'window', 'e-list-button', 'e-app-list', 'e-doc-app', 'e-window-doc'], found: ['app'] },
    explanation: 'Bubbling lets a parent handle events from many children. This is event delegation: one listener on the list or app container can inspect the target path and route actions.',
  };

  yield {
    state: labelMatrix(
      'Propagation controls',
      [
        { id: 'stop', label: 'stopProp' },
        { id: 'immed', label: 'stopNow' },
        { id: 'prevent', label: 'prevent' },
        { id: 'passive', label: 'passive' },
      ],
      [
        { id: 'affects', label: 'affects' },
        { id: 'not' , label: 'not' },
      ],
      [
        ['later nodes', 'default'],
        ['same node', 'past done'],
        ['default', 'path'],
        ['scroll perf', 'prevent'],
      ],
    ),
    highlight: { active: ['stop:affects', 'immed:affects'], compare: ['prevent:affects', 'passive:not'] },
    explanation: 'stopPropagation changes path traversal. stopImmediatePropagation also stops later listeners on the current target. preventDefault cancels default action when allowed; it does not stop propagation.',
  };
}

function* shadowRetarget() {
  yield {
    state: shadowGraph('Shadow DOM changes what outside listeners see'),
    highlight: { active: ['inner', 'shadow', 'host', 'doc', 'e-shadow-inner', 'e-host-shadow', 'e-doc-host'], found: ['listener'] },
    explanation: 'A shadow tree has an internal structure. For outside listeners, the platform can retarget the event so component internals are not exposed as the public event target.',
    invariant: 'The path can cross a boundary while target identity is adjusted.',
  };

  yield {
    state: labelMatrix(
      'Event flags',
      [
        { id: 'bubbles', label: 'bubbles' },
        { id: 'composed', label: 'composed' },
        { id: 'open', label: 'open root' },
        { id: 'closed', label: 'closed root' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['can bubble', 'up path'],
        ['cross shadow', 'host out'],
        ['path shows', 'internals'],
        ['path hides', 'internals'],
      ],
    ),
    highlight: { found: ['composed:effect', 'closed:effect'], compare: ['bubbles:effect'] },
    explanation: 'bubbles controls upward propagation. composed controls whether an event can cross a shadow boundary. Open and closed shadow roots affect what composedPath exposes.',
  };

  yield {
    state: shadowGraph('composedPath returns the listener invocation path', { path: 'targets', listener: 'array' }),
    highlight: { active: ['inner', 'path', 'listener', 'e-inner-path', 'e-path-listener'], compare: ['host'] },
    explanation: 'Event.composedPath returns the EventTargets whose listeners will be invoked. MDN notes that closed shadow-root internals are not included.',
  };

  yield {
    state: shadowGraph('Outside a component, target may be the host', { host: 'public target', inner: 'private', listener: 'outside' }),
    highlight: { active: ['host', 'listener', 'e-host-listener'], removed: ['inner'], compare: ['shadow'] },
    explanation: 'Retargeting preserves encapsulation. Code outside the component can respond to the host-level event without depending on private nodes inside the shadow tree.',
  };

  yield {
    state: labelMatrix(
      'Delegation checklist',
      [
        { id: 'target', label: 'target' },
        { id: 'current', label: 'current' },
        { id: 'path', label: 'path' },
        { id: 'data', label: 'data attr' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'safeUse', label: 'safe use' },
      ],
      [
        ['who fired?', 'public node'],
        ['who listens?', 'handler node'],
        ['route?', 'inspect'],
        ['action id?', 'dispatch'],
      ],
    ),
    highlight: { found: ['current:safeUse', 'path:safeUse', 'data:safeUse'], compare: ['target:question'] },
    explanation: 'Robust delegation checks currentTarget, target, composedPath, and explicit data attributes. Do not assume internal DOM shape is part of a component API.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'capture bubble') yield* captureBubble();
  else if (view === 'shadow retarget') yield* shadowRetarget();
  else throw new InputError('Pick a DOM event view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DOM event propagation is the browser data structure behind clicks, keyboard events, form events, and many custom events. Dispatch builds an event path, then invokes listeners in capture, target, and bubble phases. The path is why one listener high in the DOM can handle events for many descendants.',
        'Shadow DOM adds another layer. Events can cross component boundaries when composed is true, but the event target can be retargeted so outside code sees the host rather than private implementation nodes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a normal click on a button inside a list, the browser builds a path that includes the button, list, app container, document, and window. Capture listeners run from root toward the target. Target listeners run at the button. If the event bubbles, bubble listeners run from target back toward the root.',
        'The DOM Standard dispatch algorithm appends invocation targets to the event path, invokes capture listeners in reverse path order, then invokes target and bubbling listeners in path order. stopPropagation and stopImmediatePropagation modify which later invocations occur; preventDefault affects the default action instead.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Event delegation is a performance and maintainability pattern. Instead of registering thousands of row-level listeners, a table can register one listener on a parent and route by target, composedPath, and data attributes. The tradeoff is routing complexity and care around retargeting.',
        'The path is also a correctness boundary. If a component uses Shadow DOM, outside code should treat the host and documented custom events as the API. Reaching into composedPath internals can couple app code to private component structure, especially with open shadow roots.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a file-tree component. One listener on the tree root handles clicks from thousands of rows. The handler reads event.currentTarget to know the delegate root, uses event.composedPath to find the nearest row action, and reads data-action plus data-node-id to dispatch open, rename, or delete. Adding or removing rows does not add or remove listeners.',
        'Now put each row action inside a web component. An outside listener may see the component host as event.target rather than the private internal button. The component should dispatch a composed custom event with a documented detail payload if it wants the app to react outside the shadow boundary.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'event.target and event.currentTarget are not the same. target is the adjusted event target; currentTarget is the node whose listener is currently running. stopPropagation does not cancel default behavior. preventDefault does not stop bubbling. passive listeners may not call preventDefault for scroll-sensitive events.',
        'Do not assume all custom events cross Shadow DOM boundaries. CustomEvent defaults are not a magic public API. Choose bubbles and composed deliberately, and document the detail payload rather than leaking private DOM.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DOM Standard event dispatch at https://dom.spec.whatwg.org/#concept-event-dispatch, MDN Event.composedPath at https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath, MDN Event bubbling guide at https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling, MDN stopPropagation at https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation, and MDN EventTarget.addEventListener at https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener. Study Tree Traversals, Browser Rendering, The Event Loop, Virtual DOM Reconciliation, React Fiber Scheduler Case Study, JavaScript Promise Microtask Queue, Browser Message Channels & Broadcast Coordination, and CSP Nonce & Hash Policy next.',
      ],
    },
  ],
};
