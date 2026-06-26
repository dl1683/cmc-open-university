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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the browser delivering one event along a precomputed path. The DOM is the document object model tree, an EventTarget is a node that can receive events, and Shadow DOM is a component boundary that can hide internal markup. Active state is the listener currently running, visited state is a path target whose listener phase is complete, and found state is the handler outcome or default-action decision.',
        'The safe inference is phase-based. Capture listeners run from the outer side toward the target, target listeners run at the target, and bubble listeners run outward only for event types that bubble. composedPath shows the path the platform exposes, but retargeting can make outside code see a host instead of a private internal node.',
        {type: 'callout', text: 'DOM dispatch is a precomputed path walk whose visible target can change at component boundaries, so robust handlers reason from currentTarget, event flags, and composedPath rather than raw descendants.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A browser page is a tree of nodes that changes while the user interacts with it. A click on a button may need to be handled by the button, a menu, an analytics layer, and the application shell. Directly wiring every leaf node makes large interfaces brittle.',
        'Event propagation exists so local interaction can be observed through the tree. The composed path exists because modern pages contain component boundaries. The browser must let useful events cross those boundaries without exposing every private implementation node as public API.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to attach a listener to every element that might be clicked or typed into. That works in a small static page. It is easy to see which callback belongs to which node.',
        'Large applications make that approach expensive. Lists virtualize rows, menus mount and unmount, editors create many nested controls, and frameworks rerender subtrees. Listener setup, teardown, and duplicated routing logic become a maintenance cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is churn. If 10,000 table rows each receive separate listeners, a rerender can create thousands of registrations and closures. One stable container listener can route the same clicks if it can inspect the event path.',
        'The second wall is encapsulation. event.target is not always the deepest node that caused the event. Shadow boundaries, slots, retargeting, stopPropagation, passive listeners, and default actions mean that simple bubbling vocabulary is not enough for correct handler code.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dispatch builds an event path before invoking listeners. The path is an ordered list of invocation targets with metadata for phases, shadow boundaries, related targets, and adjusted targets. Listener invocation then walks that path under the event flags and listener options.',
        'Handler code should distinguish currentTarget from target. currentTarget is the node whose listener is running now. target is the adjusted target visible in that listener context. composedPath gives a routing aid, not a promise to expose closed component internals.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'addEventListener stores a callback with options such as capture, once, passive, and signal. capture selects the capture phase, once removes the listener after one call, passive promises not to cancel default behavior, and AbortSignal can remove listeners as a group. These options are part of dispatch behavior, not decoration.',
        'When an event is dispatched, the browser constructs the path, runs capture listeners toward the target, runs target listeners, and runs bubble listeners outward if the event bubbles. The composed flag controls whether the event can cross a shadow boundary. Retargeting can present the host as the visible target outside the component.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Propagation works because a tree path gives ancestors a structured chance to observe descendant activity. A container can handle many child actions without knowing every child in advance. That is the correctness basis for event delegation.',
        'Encapsulation works because crossing a boundary and revealing internals are separate decisions. A component can dispatch a composed custom event with a stable detail payload while hiding its private button or wrapper. Outside code depends on the event contract rather than the component internal tree.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per-node listeners make registration cost grow with node count. If a list grows from 1,000 to 10,000 rows, separate click listeners grow by the same factor. Delegation can keep listener count constant for that interaction, but routing work moves into the container handler.',
        'Dispatch cost grows with path length and listener count on that path. stopPropagation reduces later path work but can break unrelated observers. Heavy synchronous handlers still block input response, and passive listeners matter because scroll and touch defaults are performance-sensitive.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Event propagation is useful in dynamic interfaces where children are created and destroyed often. A file tree can put one listener on the tree root and route row actions by reading composedPath and data attributes. That keeps behavior near the container that owns selection, expansion, and commands.',
        'It is also central to component systems. A web component can publish a composed custom event such as file-action with a detail payload. The application listens at a stable boundary and does not need to know whether the component used a button, a slot, or an internal wrapper.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Delegation fails when the event does not bubble or does not cross the boundary where the listener sits. focus and blur have special behavior, while focusin and focusout exist for delegation. Pointer capture can redirect later pointer events away from the original path.',
        'Propagation controls are easy to misuse. stopPropagation stops later nodes in the path, stopImmediatePropagation also stops later listeners on the same current target, and preventDefault asks the browser to skip the default action when the event is cancelable. Mixing those up causes menus, analytics, scrolling, and form behavior to fail in surprising ways.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a file tree has 5,000 visible rows and each row has open, rename, and delete controls. Per-control wiring creates 15,000 listeners. A delegated design uses one click listener on the tree root and finds the nearest path entry with a data-action field.',
        'A click on row 42 rename enters the path at an internal button, crosses the row, then reaches the tree root. At the root listener, currentTarget is the tree root, target may be the adjusted public target, and composedPath contains the visible route. The handler reads action = rename and node id = 42, then dispatches the command without adding thousands of listeners.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the DOM Standard dispatch algorithm at https://dom.spec.whatwg.org/#concept-event-dispatch, MDN composedPath at https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath, MDN addEventListener at https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener, and MDN stopPropagation at https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation. Study tree traversal, the browser event loop, Shadow DOM, and framework event systems after this topic.',
      ],
    },
  ],
};
