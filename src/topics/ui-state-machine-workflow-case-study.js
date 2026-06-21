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
    {
      heading: 'Why this exists',
      paragraphs: [
        'A UI is not just data on a screen. It is a workflow that moves through modes: editing, validating, submitting, failed, retrying, cancelled, and done. Bugs appear when those modes are stored as unrelated flags instead of one explicit state.',
        'The hard part is not drawing the button. The hard part is deciding whether that button is legal now. A submit click, promise completion, retry timer, route change, or cancel action should mean different things in different modes.',
        'State machines make that contract visible. They name the legal states, the events that can move between them, the guards that block illegal moves, the actions that run on transitions, and the async work owned by a state.',
        {type:'callout', text:'State machines replace flag combinations with legal modes, making events ask the current state for permission before changing the UI.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/cf/Finite_state_machine_example_with_comments.svg', alt:'Finite state machine diagram showing open and closed states with labeled transitions.', caption:'Finite state machine example with comments. Wikimedia Commons, Macguy314; reworked by Perhelion, public domain.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The first implementation usually adds flags: `isDirty`, `isValid`, `isSubmitting`, `isDone`, `hasError`, and `canRetry`. Each event flips a few booleans. This is not a bad start. For one form and one request, the code is small and direct.',
        'The wall is multiplication. Five booleans can represent 32 combinations even if the product has six legal modes. Some combinations are nonsense: loading and done, failed and still sending, invalid and submitted, cancelled and then successfully completed by a stale promise.',
        'Scattered handlers make the problem worse. A DOM event, promise resolution, timer, and navigation callback can all mutate the same flags. Each handler knows its local intent, but no handler owns the whole workflow.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A state machine replaces the cross-product of flags with a finite transition table. Current state plus event selects the next state. If the transition is absent, the event is illegal in that state. If a guard fails, the state does not change.',
        'Actions belong to transitions. Async work belongs to states. That distinction is what keeps side effects from drifting through the UI. Enter `submitting`, start the payment request. Leave `submitting`, clean it up or ignore its completion.',
        'A statechart extends the same idea when a flat machine gets too large. Hierarchy groups common behavior. Parallel regions model independent concerns. History can return to the last child state. Invoked services attach async work to a specific state instead of to a random callback.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A checkout machine might start in `idle`. CHANGE moves it to `editing`. VALID moves it to `valid`. SUBMIT is legal only from `valid`, so it enters `submitting` and invokes `POST /pay`.',
        'While the machine is in `submitting`, the UI derives its rendering from that state: disable the submit button, show progress, keep the form stable, and expose cancellation if the product supports it. DONE moves to `success`. FAIL moves to `failure`. RETRY moves from `failure` back to `submitting`.',
        'CANCEL is not a boolean cleanup afterthought. It is a transition. The action may call an AbortController, clear a retry timer, or record that any late promise completion should be ignored. The next state says what the user can do after cancellation.',
        'Context stores extended data such as form values, error messages, request ids, or retry counts. State stores the mode. Mixing them is a common source of bad machines: not every data value deserves its own state, and not every mode should be hidden in context.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the checkout-flow view, start with the boolean table. The crossed-out combinations are the lesson: the UI can express states the product never designed. The graph replaces those combinations with named nodes and legal events.',
        'Watch the guard frame closely. SUBMIT does not become legal because the user clicked. It becomes legal only after the form reaches the valid state or a validation guard passes. That one transition prevents a large class of double-submit and invalid-request bugs.',
        'The async frame shows ownership. The payment request is active because the machine is in `submitting`. DONE and FAIL are not arbitrary callbacks; they are events that are meaningful only while that state owns the request.',
        'In the statecharts view, read hierarchy and parallel regions as compression tools. They are useful only if they make the real UI smaller to reason about. The testing table shows the payoff: state, event, guard, and action can be tested separately from rendering.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the machine is always in one legal state configuration. A transition function is the only way to change that configuration. Illegal flag combinations cannot appear unless the model itself allows them.',
        'Events become predictable because legality is state-dependent. A DONE event in `submitting` may move to `success`. The same DONE event in `editing` can be ignored because no request is owned by that state. This is how the model handles stale promise completions.',
        'Testing becomes finite. Instead of testing many accidental flag combinations, you test legal transitions, blocked transitions, guard predicates, and side effects. The workflow shape becomes a contract rather than an emergent property of handlers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user edits a checkout form. The machine receives CHANGE and enters `editing`. Validation passes, so it enters `valid`. SUBMIT enters `submitting`, records a request id, and starts the payment request.',
        'If the network rejects the card, FAIL moves to `failure` with an error in context. RETRY is legal from `failure`, so the machine re-enters `submitting` and starts a new request. If the user cancels while the request is in flight, CANCEL aborts the request and moves back to `editing`.',
        'The bug this prevents is stale success. If the cancelled request resolves later, its DONE event no longer matches the active request or the active state. The machine can ignore it instead of showing a receipt for an operation the user already abandoned.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Runtime cost is usually tiny compared with rendering and network work. The real cost is design. Someone must name the modes, events, guards, actions, and context, and those names must match product behavior.',
        'A flat machine can grow too large if every combination becomes its own node. Statecharts reduce that pressure with hierarchy and parallel regions, but they add their own tax: a reader must understand nesting, event bubbling, and history rules.',
        'Machines also move complexity earlier. That is the point. The team pays the modeling cost before bugs become production states that nobody can reproduce.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Machines win when the UI has meaningful modes, asynchronous work, cancellation, retries, timers, or navigation boundaries. Checkout, uploads, onboarding, approval queues, auth modals, media controls, and collaborative edit sessions are good fits.',
        'They also win when different people need to reason about the same behavior. A designer can point to a transition and ask what the user sees. QA can enumerate blocked events. An engineer can attach cleanup to the transition that leaves a state.',
        'They are especially useful when the UI must be resilient to out-of-order events. Promise completions, reconnects, tab restores, retries, and route changes are much easier to handle when every event asks the current state for permission.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A machine is overhead for a one-toggle component, a simple controlled input, or display state that has no legal workflow. A boolean is fine when the product really has two modes and no interesting transitions.',
        'Do not lift every pixel into one global machine. Local UI state, derived data, server cache state, and workflow state are different tools. A good machine models the user journey, not every CSS class.',
        'Do not use a statechart to hide unclear requirements. If the team cannot say when submit is legal or what cancellation means, the first job is product clarification, not more nesting.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common failure is putting arbitrary mutable work inside actions and calling the result deterministic. Actions can call APIs, mutate stores, or start timers, but the model should still make ownership and cleanup explicit.',
        'Another failure is stale context. History states and retries are useful only if the restored data is still valid. Returning to an old child state after permissions, inventory, route params, or form schema changed can resurrect a bad UI.',
        'A third failure is over-modeling. If every small value becomes a state, the machine becomes harder to understand than the flags it replaced. Modes should describe behavior that changes what events are legal.',
      ],
    },
    {
      heading: 'Primary references',
      paragraphs: [
        'David Harel, "Statecharts: A Visual Formalism for Complex Systems": https://www.state-machine.com/doc/Harel87.pdf.',
        'W3C SCXML state machine notation: https://www.w3.org/TR/scxml/.',
        'Stately state machines and statecharts documentation: https://stately.ai/docs/state-machines-and-statecharts. XState documentation: https://stately.ai/docs/xstate.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Finite State Machines first if transition tables are still new. Study DOM Event Propagation and Promise Microtask Queue next to understand where UI events come from.',
        'Study AbortController Cancellation Graph for async cleanup, History API Session Stack for navigation state, React Suspense Resource Cache for rendering around async resources, Optimistic UI Mutation Log for client/server reconciliation, and Form Validation Dependency Graph for guard design.',
      ],
    },
  ],
};
