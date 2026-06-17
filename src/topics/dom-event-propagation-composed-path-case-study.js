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
        'DOM event propagation is the browser mechanism that delivers an event to a target and to the ancestors that are allowed to observe it. A click on a button is not only a callback on that button. Dispatch builds a path of EventTargets, runs capture listeners from the outer side toward the target, runs target listeners, and then runs bubble listeners back outward when the event type bubbles.',
        'The composed path is the event path as exposed through Event.composedPath(). It matters because modern pages are not plain trees of public elements. Shadow DOM creates component boundaries. An event may cross those boundaries if it is composed, and the platform may retarget the event so outside code sees the host rather than private internal nodes.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to attach a listener to every interactive element and treat event.target as the element that was clicked. That works for a small static page. It becomes costly and brittle in large lists, virtualized tables, editors, menus, and applications that constantly add and remove nodes. Setup, teardown, and duplicated routing logic spread through the UI.',
        'The simple mental model also breaks at component boundaries. event.target is an adjusted target, not always the deepest internal node. Capture listeners may run before the target. stopPropagation and stopImmediatePropagation change later listener invocation. preventDefault affects default actions rather than traversal. Passive listeners cannot cancel some performance-sensitive defaults. A serious curriculum needs the dispatch algorithm, not just the word bubbling.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that dispatch walks a precomputed path of EventTargets. It is not a live selector query and not a fresh parent lookup for every listener. Once the event path is constructed, the browser invokes listeners in phases according to listener options, event flags, and propagation state.',
        'For handler code, the essential distinction is currentTarget versus target. currentTarget is the node whose listener is currently running. target is the adjusted public target for that listener context. composedPath() gives a path that is useful for routing, but closed shadow roots and retargeting mean it is not a promise to expose every private implementation node.',
      ],
    },
    {
      heading: 'Data structures and mechanism',
      paragraphs: [
        'The main data structure is the event path: an ordered list of invocation targets with enough metadata to handle shadow-including trees, slots, related targets, and adjusted targets. Capture listeners are invoked from the outer end of the path toward the target. At-target listeners run at the target. Bubble listeners run from the target side outward if the event bubbles.',
        'Listener registration adds more structure. addEventListener records a callback plus options such as capture, once, passive, and signal. capture decides which phase sees the listener. once removes the listener after the first invocation. passive tells the browser the listener will not cancel default behavior, which helps scroll and touch performance. AbortSignal can remove a set of listeners without manual bookkeeping.',
        'Shadow DOM adds composed and retargeting rules. The bubbles flag controls upward propagation. The composed flag controls whether the event can cross a shadow boundary. Retargeting preserves encapsulation by presenting the host as the target to outside listeners when the real node is private. composedPath() exposes the invocation path that the platform allows the current code to see.',
        'Default actions are separate from propagation. A link navigation, form submission, text selection, focus change, or scrolling behavior may run because the event was not canceled. The browser can finish listener invocation and still perform or skip the default action according to cancelability, passive listener promises, and event-specific rules.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Propagation works because it turns local interaction into structured tree traversal. Ancestors can observe or handle descendant events without direct wiring to each child. That makes delegation possible: one stable listener on a container can route clicks, keyboard actions, or input changes for many dynamic descendants.',
        'Encapsulation works because crossing a boundary and revealing internals are separate decisions. A composed event can leave a component so the application can respond. Retargeting can still keep the internal button, span, or input from becoming part of the public API. The component can expose a documented custom event instead of forcing outside code to depend on its internal DOM shape.',
      ],
    },
    {
      heading: 'Worked case study',
      paragraphs: [
        'A file tree is a clean example. Thousands of rows may appear, disappear, or move as folders expand. Attaching a click listener to every row works but creates churn. A single listener on the tree root can inspect composedPath(), find the nearest element with a data action and node id, and dispatch open, rename, select, or delete. currentTarget remains the tree root; the routed action comes from the path.',
        'Now put a row action inside a web component. Outside code may see the component host as event.target. If the internal click is meant to be public, the component can dispatch a composed custom event such as file-action with a detail payload. That event becomes the stable contract. The outside app listens at the tree root without knowing whether the component uses a button, icon, slot, or internal wrapper.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Event propagation is useful in large dynamic interfaces: tables, menus, autocomplete popovers, file trees, dashboards, document editors, drag handles, analytics hooks, and component shells. It keeps routing near the container that owns the behavior instead of scattering listeners across every child.',
        'It is also useful for framework internals. UI frameworks often centralize event handling, normalize event differences, or schedule updates from a small set of root listeners. Even when a framework hides the details, understanding DOM dispatch explains why handler order, stopPropagation, portals, shadow roots, and default actions can behave differently from a simple callback chain.',
        'It is useful for accessibility work too. Keyboard events, focus movement, ARIA-driven widgets, and form controls often need coordination between a leaf control and a composite parent. Delegation can keep that coordination centralized, but only if the component publishes stable events instead of relying on private markup.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Delegation fails when the event does not bubble, when it is not composed across the boundary that the listener sits outside, or when handler code assumes the raw deepest target is public. Some events have special behavior. focus and blur do not bubble in the same way as click, though focusin and focusout exist for delegation. Pointer capture can redirect later pointer events. Disabled form controls and default browser actions add more edge cases.',
        'Propagation controls are often misused. stopPropagation prevents the event from reaching later nodes in the path, but it does not cancel default behavior. stopImmediatePropagation also prevents later listeners on the same current target. preventDefault asks the browser not to run the default action when the event is cancelable. Passive listeners promise not to cancel. Mixing those up causes broken menus, stuck scroll handlers, and analytics that silently miss events.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'The browser does not expose a single purgatory-like metric for event propagation, so debugging is mostly structural. Useful signals are handler count, duplicate listeners, listeners attached inside render loops, long event-handler tasks, scroll blocking warnings, unexpected default actions, and propagation stops that prevent global handlers from seeing events. Performance tools can show long tasks and input delay caused by heavy synchronous handlers.',
        'For correctness, log currentTarget, target, eventPhase, bubbles, composed, cancelable, defaultPrevented, and a compact composedPath() when investigating. In component systems, document which custom events are public, whether they bubble, whether they are composed, and what detail payload they carry. That contract is more stable than asking consumers to inspect private nodes.',
        'Memory signals matter in single-page apps. Detached subtrees with retained listeners, handlers closed over large state, and repeated listener registration during render can cause leaks. AbortController-based listener cleanup and container-level delegation reduce that risk when nodes churn often.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Primary sources are the DOM Standard event dispatch algorithm at https://dom.spec.whatwg.org/#concept-event-dispatch, MDN Event.composedPath at https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath, MDN Event bubbling guidance at https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling, MDN stopPropagation at https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation, and MDN addEventListener at https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener.',
        'Study Tree Traversals for path walking, Browser Rendering for the work that may follow input, The Event Loop for task timing, JavaScript Promise Microtask Queue for post-handler scheduling, Virtual DOM Reconciliation and React Fiber Scheduler Case Study for framework response to events, Browser Message Channels & Broadcast Coordination for cross-context events, and CSP Nonce & Hash Policy for the security boundary around executable handlers.',
      ],
    },
  ],
};
