// Form validation as a dependency graph: field registry, watched values,
// native constraints, schema checks, error trees, and submit state.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'form-validation-dependency-graph-case-study',
  title: 'Form Validation Dependency Graph',
  category: 'Systems',
  summary: 'How complex forms use field registries, dependency edges, constraint checks, schema resolvers, subscription islands, error trees, and submit workflows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['field graph', 'validation flow'], defaultValue: 'field graph' },
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

function formGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'registry', label: 'registry', x: 0.9, y: 4.7, note: notes.registry ?? 'fields' },
      { id: 'email', label: 'email', x: 2.8, y: 5.9, note: notes.email ?? 'input' },
      { id: 'country', label: 'country', x: 2.8, y: 4.1, note: notes.country ?? 'select' },
      { id: 'postal', label: 'postal', x: 2.8, y: 2.3, note: notes.postal ?? 'input' },
      { id: 'rules', label: 'rules', x: 5.0, y: 5.2, note: notes.rules ?? 'constraints' },
      { id: 'schema', label: 'schema', x: 5.0, y: 3.0, note: notes.schema ?? 'resolver' },
      { id: 'errors', label: 'errors', x: 7.2, y: 4.1, note: notes.errors ?? 'tree' },
      { id: 'subs', label: 'subs', x: 9.0, y: 5.2, note: notes.subs ?? 'watchers' },
      { id: 'submit', label: 'submit', x: 9.0, y: 3.0, note: notes.submit ?? 'gate' },
    ],
    edges: [
      { id: 'e-reg-email', from: 'registry', to: 'email', weight: '' },
      { id: 'e-reg-country', from: 'registry', to: 'country', weight: '' },
      { id: 'e-reg-postal', from: 'registry', to: 'postal', weight: '' },
      { id: 'e-email-rules', from: 'email', to: 'rules', weight: '' },
      { id: 'e-country-schema', from: 'country', to: 'schema', weight: '' },
      { id: 'e-postal-schema', from: 'postal', to: 'schema', weight: '' },
      { id: 'e-rules-errors', from: 'rules', to: 'errors', weight: '' },
      { id: 'e-schema-errors', from: 'schema', to: 'errors', weight: '' },
      { id: 'e-errors-subs', from: 'errors', to: 'subs', weight: '' },
      { id: 'e-errors-submit', from: 'errors', to: 'submit', weight: '' },
    ],
  }, { title });
}

function* fieldGraph() {
  yield {
    state: formGraph('A field registry gives every control an address'),
    highlight: { active: ['registry', 'email', 'country', 'postal', 'e-reg-email', 'e-reg-country', 'e-reg-postal'], found: ['rules'] },
    explanation: 'A form library begins with a registry. Each field name points to value access, validation rules, touched state, dirty state, and subscribers that care about changes.',
    invariant: 'Names are the keys of form state.',
  };

  yield {
    state: formGraph('Native constraints catch local failures first', { email: 'user@', rules: 'type=email', errors: 'type err' }),
    highlight: { active: ['email', 'rules', 'errors', 'e-email-rules', 'e-rules-errors'], compare: ['schema'] },
    explanation: 'Some validation is local to one field: required, type=email, min, max, pattern, minlength, and maxlength. The browser Constraint Validation API exposes these checks before custom schema logic runs.',
  };

  yield {
    state: formGraph('Cross-field validation is a dependency edge', { country: 'US', postal: '9410', schema: 'country+zip', errors: 'zip err' }),
    highlight: { active: ['country', 'postal', 'schema', 'errors', 'e-country-schema', 'e-postal-schema', 'e-schema-errors'], compare: ['email'] },
    explanation: 'Postal code validity depends on country. That means country and postal code form a small dependency graph. When country changes, postal code may need to be revalidated even if postal itself did not change.',
  };

  yield {
    state: formGraph('Subscriptions isolate expensive re-renders', { subs: 'email msg', errors: 'email only', submit: 'disabled?' }),
    highlight: { found: ['subs', 'errors'], active: ['e-errors-subs'], compare: ['submit'] },
    explanation: 'Large forms should not re-render every field on every keystroke. Watchers and form-state subscriptions let a field error message update without redrawing the whole screen.',
  };

  yield {
    state: labelMatrix(
      'Form records',
      [
        { id: 'value', label: 'value' },
        { id: 'dirty', label: 'dirty' },
        { id: 'touched', label: 'touched' },
        { id: 'error', label: 'error' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'used', label: 'used for' },
      ],
      [
        ['field data', 'submit body'],
        ['changed?', 'save state'],
        ['visited?', 'show msg'],
        ['reason', 'block send'],
      ],
    ),
    highlight: { found: ['value:stores', 'error:used'], compare: ['dirty:used', 'touched:used'] },
    explanation: 'A form is not just values. It is values plus meta-state. Dirty, touched, validating, submitting, submitted, and errors drive the user experience around the values.',
  };
}

function* validationFlow() {
  yield {
    state: labelMatrix(
      'Validation layers',
      [
        { id: 'native', label: 'native' },
        { id: 'field', label: 'field' },
        { id: 'schema', label: 'schema' },
        { id: 'server', label: 'server' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['one input', 'cheap'],
        ['one field', 'cheap'],
        ['whole form', 'medium'],
        ['canonical', 'slow'],
      ],
    ),
    highlight: { found: ['native:scope', 'field:scope', 'schema:scope'], compare: ['server:cost'] },
    explanation: 'Validation is layered. Native constraints and field rules are cheap. Schema validation handles cross-field shape. Server validation is canonical because clients can be bypassed.',
    invariant: 'Client validation improves UX; server validation protects correctness.',
  };

  yield {
    state: formGraph('A validation queue coalesces noisy input', { email: 'typing', rules: 'debounce?', errors: 'pending', submit: 'wait' }),
    highlight: { active: ['email', 'rules', 'errors', 'submit', 'e-email-rules', 'e-rules-errors', 'e-errors-submit'], compare: ['postal'] },
    explanation: 'On every keystroke, the form may need to validate a field, update errors, and notify subscribers. Good forms coalesce expensive async checks and keep submit state honest while validation is pending.',
  };

  yield {
    state: formGraph('Submit runs the whole graph and gates side effects', { submit: 'handleSubmit', errors: 'none?', schema: 'all fields' }),
    highlight: { found: ['schema', 'errors', 'submit'], active: ['e-schema-errors', 'e-errors-submit'] },
    explanation: 'Submit is a state-machine transition. It should run validation, block side effects when errors exist, set submitting state while the request runs, and handle server errors on return.',
  };

  yield {
    state: formGraph('Server errors merge into the local error tree', { submit: 'POST', errors: 'email taken', subs: 'field msg', schema: 'client ok' }),
    highlight: { active: ['submit', 'errors', 'subs', 'e-errors-subs'], compare: ['schema'] },
    explanation: 'The server can reject data that passed the client: duplicate email, expired coupon, permission changes, or business rules. Those errors should be stored in the same error tree the UI already renders.',
  };

  yield {
    state: labelMatrix(
      'Case study',
      [
        { id: 'email', label: 'email' },
        { id: 'country', label: 'country' },
        { id: 'postal', label: 'postal' },
        { id: 'coupon', label: 'coupon' },
      ],
      [
        { id: 'dep', label: 'depends' },
        { id: 'result', label: 'result' },
      ],
      [
        ['unique', 'server err'],
        ['option', 'zip rules'],
        ['country', 'local err'],
        ['cart', 'async err'],
      ],
    ),
    highlight: { found: ['postal:dep', 'country:result'], compare: ['email:result', 'coupon:result'] },
    explanation: 'A checkout form combines all layers: email format locally, email uniqueness on the server, postal code rules by country, coupon validity by cart, and submit state from the workflow machine.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'field graph') yield* fieldGraph();
  else if (view === 'validation flow') yield* validationFlow();
  else throw new InputError('Pick a form-validation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Form validation is a dependency graph over named fields. Each field has a value, metadata, validation rules, subscriptions, and maybe dependencies on other fields. The graph decides what must be rechecked when a user types, blurs, changes a selector, submits, or receives a server error.',
        'Complex forms fail when everything becomes one global render and one global isValid flag. A better mental model is a field registry, local constraints, cross-field edges, async validators, an error tree, and a submit state machine.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Local validation checks one field. Cross-field validation reads a small set of dependencies: country affects postal code, password affects confirmPassword, cart affects coupon. When a dependency changes, affected fields should revalidate and notify only subscribers that need the result.',
        'The browser already supplies native constraint validation for common cases. Form libraries layer registration, subscriptions, controlled/uncontrolled integration, schema resolvers, dirty and touched state, and server error mapping on top.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A checkout form has email, shipping country, postal code, coupon, card, and terms. Email format is local, email uniqueness is server-side, postal code depends on country, coupon depends on cart contents, and card submission is an external side effect. The form should show field-level errors, prevent invalid submit, preserve dirty state, and surface server errors in the same error tree.',
        'This page links Signals Reactivity Dependency Graph to UI State Machine Workflow. Signals explain the subscription graph. State machines explain submit, pending, success, failure, cancellation, and retry. Query Cache and Optimistic UI explain how server state and writes interact with the form.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Client validation does not replace server validation. Users can bypass the form, mutate requests, disable scripts, or submit stale data. Client validation is for fast feedback and reduced accidental errors; the server still owns correctness.',
        'Do not re-render the whole form for every keystroke in a large workflow. Do not hide cross-field dependencies in random onChange handlers. Do not make submit depend on stale async validation. Treat validation state as explicit data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: React Hook Form useForm at https://react-hook-form.com/docs/useform, register at https://react-hook-form.com/docs/useform/register, subscribe at https://react-hook-form.com/docs/useform/subscribe, watch at https://react-hook-form.com/docs/useform/watch, useWatch at https://react-hook-form.com/docs/usewatch, formState at https://react-hook-form.com/docs/useform/formstate, MDN Constraint Validation API at https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation, and the HTML forms standard at https://html.spec.whatwg.org/multipage/forms.html. Study Signals Reactivity Dependency Graph, UI State Machine Workflow, DOM Event Propagation & Path, AbortController Cancellation Graph, and Optimistic UI Mutation Log next.',
      ],
    },
  ],
};
