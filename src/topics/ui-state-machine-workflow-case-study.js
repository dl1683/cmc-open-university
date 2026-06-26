// UI state machines and statecharts: explicit states, events, guards, actions,
// invoked async work, hierarchical states, and impossible-state reduction.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ui-state-machine-workflow-case-study',
  title: 'UI State Machine Workflow',
  category: 'Systems',
  summary: 'Model UI flows with explicit states, events, guarded transitions, invoked async work, hierarchy, parallel regions, history, and tests.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['checkout flow', 'statecharts'], defaultValue: 'checkout flow' },
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

function machineGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'idle', label: 'idle', x: 0.8, y: 4.8, note: notes.idle ?? 'cart open' },
      { id: 'editing', label: 'editing', x: 2.6, y: 5.8, note: notes.editing ?? 'form dirty' },
      { id: 'valid', label: 'valid', x: 4.4, y: 5.8, note: notes.valid ?? 'can submit' },
      { id: 'submit', label: 'submit', x: 5.8, y: 3.9, note: notes.submit ?? 'invoke API' },
      { id: 'success', label: 'success', x: 7.8, y: 5.2, note: notes.success ?? 'receipt' },
      { id: 'failure', label: 'failure', x: 7.8, y: 2.8, note: notes.failure ?? 'retry' },
      { id: 'cancel', label: 'cancel', x: 3.0, y: 2.5, note: notes.cancel ?? 'abort' },
    ],
    edges: [
      { id: 'e-idle-editing', from: 'idle', to: 'editing', weight: 'CHANGE' },
      { id: 'e-editing-valid', from: 'editing', to: 'valid', weight: 'VALID' },
      { id: 'e-valid-submit', from: 'valid', to: 'submit', weight: 'SUBMIT' },
      { id: 'e-submit-success', from: 'submit', to: 'success', weight: 'DONE' },
      { id: 'e-submit-failure', from: 'submit', to: 'failure', weight: 'FAIL' },
      { id: 'e-failure-submit', from: 'failure', to: 'submit', weight: 'RETRY' },
      { id: 'e-submit-cancel', from: 'submit', to: 'cancel', weight: 'CANCEL' },
      { id: 'e-cancel-editing', from: 'cancel', to: 'editing', weight: 'BACK' },
    ],
  }, { title });
}

function* checkoutFlow() {
  yield {
    state: labelMatrix(
      'Boolean flags',
      [
        { id: 'loading', label: 'loading' },
        { id: 'error', label: 'error' },
        { id: 'done', label: 'done' },
        { id: 'dirty', label: 'dirty' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'problem', label: 'problem' },
      ],
      [
        ['T', 'err?'],
        ['T', 'done?'],
        ['F', 'pend?'],
        ['T', 'sub?'],
      ],
    ),
    highlight: { removed: ['loading:problem', 'error:problem', 'done:problem'], compare: ['dirty:problem'] },
    explanation: 'Many UI bugs begin as boolean soup. loading, error, done, dirty, and valid can combine into states the product never intended, such as loading and done at the same time.',
    invariant: 'Explicit states delete impossible combinations.',
  };

  yield {
    state: machineGraph('Checkout as explicit states and events'),
    highlight: { active: ['idle', 'editing', 'valid', 'submit', 'e-idle-editing', 'e-editing-valid', 'e-valid-submit'], found: ['success', 'failure'] },
    explanation: 'A state machine names the legal states and events. The current state plus the event selects the next state, optional action, and optional invoked work.',
  };

  yield {
    state: machineGraph('Guards keep invalid transitions out', { editing: 'invalid', valid: 'guard pass', submit: 'only valid' }),
    highlight: { active: ['editing', 'valid', 'e-editing-valid'], compare: ['e-valid-submit'], removed: ['submit'] },
    explanation: 'A guard is a predicate on a transition. SUBMIT should be impossible from an invalid form, so the transition either does not exist or is guarded by validation.',
  };

  yield {
    state: machineGraph('Invoked async work returns DONE or FAIL', { submit: 'POST /pay', success: 'order id', failure: 'declined' }),
    highlight: { active: ['submit', 'e-submit-success', 'e-submit-failure'], found: ['success'], compare: ['failure'] },
    explanation: 'Async work can be modeled as an invoked service owned by a state. The payment request is active only while the machine is in submitting; completion events move to success or failure.',
  };

  yield {
    state: machineGraph('Cancellation has a concrete transition', { submit: 'in flight', cancel: 'AbortSignal', editing: 'restore form' }),
    highlight: { active: ['submit', 'cancel', 'editing', 'e-submit-cancel', 'e-cancel-editing'], found: ['failure'] },
    explanation: 'Cancellation is not a side note. It is a transition with an action, often using AbortController Cancellation Graph to stop the in-flight request and return the UI to an editable state.',
  };
}

function* statecharts() {
  yield {
    state: labelMatrix(
      'Statechart tools',
      [
        { id: 'hier', label: 'hierarchy' },
        { id: 'parallel', label: 'parallel' },
        { id: 'history', label: 'history' },
        { id: 'invoke', label: 'invoke' },
      ],
      [
        { id: 'solves', label: 'solves' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['nest states', 'too broad'],
        ['regions', 'sync bugs'],
        ['resume', 'stale ctx'],
        ['async work', 'leaks'],
      ],
    ),
    highlight: { found: ['hier:solves', 'parallel:solves', 'invoke:solves'], compare: ['history:risk'] },
    explanation: 'Statecharts extend finite state machines with hierarchy, parallel regions, history, and invoked work. These features reduce state explosion when a flat FSM becomes too large.',
    invariant: 'Use hierarchy to compress behavior, not to hide ambiguity.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'checkout', label: 'checkout', x: 1.0, y: 4.0, note: 'parent' },
        { id: 'form', label: 'form', x: 3.0, y: 5.2, note: 'child' },
        { id: 'payment', label: 'payment', x: 3.0, y: 3.0, note: 'child' },
        { id: 'ui', label: 'UI', x: 5.4, y: 5.2, note: 'parallel' },
        { id: 'network', label: 'network', x: 5.4, y: 3.0, note: 'parallel' },
        { id: 'done', label: 'done', x: 8.0, y: 4.0, note: 'final' },
      ],
      edges: [
        { id: 'e-checkout-form', from: 'checkout', to: 'form', weight: '' },
        { id: 'e-form-payment', from: 'form', to: 'payment', weight: 'NEXT' },
        { id: 'e-payment-ui', from: 'payment', to: 'ui', weight: '' },
        { id: 'e-payment-network', from: 'payment', to: 'network', weight: '' },
        { id: 'e-network-done', from: 'network', to: 'done', weight: 'DONE' },
      ],
    }, { title: 'Hierarchy and parallel regions describe real UI' }),
    highlight: { active: ['checkout', 'form', 'payment', 'e-checkout-form', 'e-form-payment'], found: ['ui', 'network'] },
    explanation: 'A checkout flow has nested behavior and parallel concerns. The visible UI can be in a spinner or disabled form while the network region is sending or retrying.',
  };

  yield {
    state: labelMatrix(
      'Testing surface',
      [
        { id: 'state', label: 'state' },
        { id: 'event', label: 'event' },
        { id: 'guard', label: 'guard' },
        { id: 'action', label: 'action' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'value' , label: 'value' },
      ],
      [
        ['snapshot', 'visible UI'],
        ['transition', 'next state'],
        ['predicate', 'blocked path'],
        ['effect', 'called once'],
      ],
    ),
    highlight: { found: ['event:test', 'guard:test', 'action:test'] },
    explanation: 'A machine makes testing finite. You can enumerate legal events, assert illegal transitions are rejected, and test actions separately from rendering.',
  };

  yield {
    state: machineGraph('Events from DOM, promises, and timers use one queue', { idle: 'DOM click', submit: 'invoke', failure: 'timer retry' }),
    highlight: { active: ['idle', 'submit', 'failure', 'e-valid-submit', 'e-submit-failure', 'e-failure-submit'], compare: ['success'] },
    explanation: 'UI events, promise completions, and timer events all become machine events. The benefit is one transition table instead of scattered event handlers mutating flags.',
  };

  yield {
    state: labelMatrix(
      'When to use',
      [
        { id: 'form', label: 'form' },
        { id: 'wizard', label: 'wizard' },
        { id: 'modal', label: 'modal' },
        { id: 'simple', label: 'simple' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['good', 'async states'],
        ['good', 'steps'],
        ['good', 'escape rules'],
        ['maybe no', 'overhead'],
      ],
    ),
    highlight: { found: ['form:fit', 'wizard:fit', 'modal:fit'], compare: ['simple:fit'] },
    explanation: 'The case-study conclusion is pragmatic: use machines when the flow has meaningful modes, async work, cancellation, retries, guards, or collaboration. Plain state is fine for a one-toggle component.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'checkout flow') yield* checkoutFlow();
  else if (view === 'statecharts') yield* statecharts();
  else throw new InputError('Pick a UI state-machine view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the checkout view as a workflow. Active nodes show the current state or transition, removed cells show impossible flag combinations, and found nodes show legal outcomes.',
      'A state is a named mode. An event is an input such as CHANGE, SUBMIT, DONE, FAIL, or CANCEL. The safe rule is: an event is legal only when the current state has a transition for it and its guard passes.',
      {type:'callout', text:'State machines replace flag combinations with legal modes, making events ask the current state for permission before changing the UI.'},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/cf/Finite_state_machine_example_with_comments.svg', alt:'Finite state machine diagram showing open and closed states with labeled transitions.', caption:'Finite state machine example with comments. Wikimedia Commons, Macguy314; reworked by Perhelion, public domain.'},
    ]},
    { heading: 'Why this exists', paragraphs: ['A UI is a workflow with modes: editing, valid, submitting, failed, retrying, cancelled, and done. Bugs appear when those modes are stored as unrelated flags instead of one explicit state.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is boolean state: isDirty, isValid, isSubmitting, hasError, isDone, and canRetry. Each event handler flips the flags it cares about, which is direct for one small form.']},
    { heading: 'The wall', paragraphs: ['Five booleans can represent 32 combinations even if the product has only 6 legal modes. Some combinations are nonsense, such as submitting and done or failed and still sending.']},
    { heading: 'The core insight', paragraphs: ['Replace flag combinations with a transition table. Current state plus event selects the next state, optional guard, optional action, and optional invoked async work.']},
    { heading: 'How it works', paragraphs: ['A checkout machine can start in idle. CHANGE moves to editing, VALID moves to valid, and SUBMIT from valid moves to submitting and starts the payment request. DONE moves to success, FAIL moves to failure, RETRY resubmits, and CANCEL runs cleanup before returning to editing.']},
    { heading: 'Why it works', paragraphs: ['The invariant is that the UI is always in one legal state configuration. The transition function is the only way to change it, so a late DONE after cancellation can be ignored because editing does not own that request.']},
    { heading: 'Cost and complexity', paragraphs: ['Runtime cost is tiny compared with rendering and network work. The real cost is modeling names for states, events, guards, actions, context, and cleanup rules. Statecharts reduce large flat machines with hierarchy and parallel regions, but add concepts the team must test.']},
    { heading: 'Real-world uses', paragraphs: ['State machines fit checkout, uploads, auth modals, onboarding, approval queues, media controls, wizards, retry flows, and collaborative editing. The common pattern is meaningful modes plus events that are legal only in some modes.']},
    { heading: 'Where it fails', paragraphs: ['A machine is overhead for a one-toggle component or display-only value. It also fails when unclear product rules are hidden inside nested states instead of clarified first.']},
    { heading: 'Worked example', paragraphs: [
      'A checkout form starts in idle. CHANGE moves to editing, VALID moves to valid, and SUBMIT starts request id 41 in submitting. The API fails after 700 ms, RETRY starts request id 42, and CANCEL after 120 ms marks id 42 inactive and returns to editing.',
      'If request id 42 resolves later, DONE is ignored because the active state is editing and there is no active request id. That prevents a stale receipt for an operation the user already cancelled.',
    ]},
    { heading: 'Sources and study next', paragraphs: ['Read David Harel, Statecharts: A Visual Formalism for Complex Systems, the W3C SCXML specification, Stately state machine documentation, and XState documentation. Study Finite State Machine, DOM Event Propagation, Promise Microtask Queue, History API Session Stack, React Suspense Resource Cache, Optimistic UI Mutation Log, and Form Validation Dependency Graph next.']},
  ],
};
