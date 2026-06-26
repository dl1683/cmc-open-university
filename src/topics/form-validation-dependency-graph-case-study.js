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
    { heading: 'How to read the animation', paragraphs: [
        'The field-graph view shows form fields as nodes and validation dependencies as edges. Active nodes are fields whose value or error is being recomputed. Found nodes are fields with current valid state. Compare edges show one field invalidating another, such as password invalidating confirm password.',
        'The validation-flow view shows layers: native constraint, local rule, schema resolver, async check, submit gate, and server response. The safe rule is that client validation improves feedback, while the server remains the final correctness boundary.',
        {type:'callout', text:'A robust form treats validation as a graph of field dependencies, async facts, error paths, and submit-state transitions.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'Forms are small data systems. A checkout form may contain local rules, cross-field rules, async uniqueness checks, dirty state, pending validation, submit state, and server-only business rules. Validation exists to keep feedback fast without pretending the client owns truth.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is one isValid boolean and a submit handler that checks every field. That works for a tiny contact form. The next approach adds per-field errors, but dependencies soon leak into random change handlers.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is stale dependency state. Country changes postal-code rules, password changes confirm-password validity, cart contents change coupon validity, and an old email uniqueness response can arrive after the user typed a new value. Per-field validation alone cannot keep those facts coherent.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Treat validation as a dependency graph over field records. Each field has value, metadata, rules, errors, and subscribers. Edges say which fields must revalidate when another field changes. The error tree stores results in the same shape the UI renders.',
      ] },
    { heading: 'How it works', paragraphs: [
        'A field registry gives every control an address. Cheap native constraints run first. Schema rules handle cross-field logic. Async validators use abort signals, request versions, or value comparison so stale responses cannot overwrite current state. Submit runs the graph and merges server errors back into the same tree.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'The invariant is that every displayed error belongs to a named path and every cross-field rule declares the values it reads. When a dependency changes, affected validation results become untrusted until recomputed. The server boundary preserves correctness when clients are stale, disabled, or forged.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Local validation is usually O(1) for one field. Schema validation may be O(n) for n fields or proportional to the dependency slice. Async validation pays network latency and needs cancellation. Large forms also pay for subscriptions; rerendering 200 fields on each keystroke makes typing feel slow.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'Validation graphs fit checkout, onboarding, admin editors, medical intake, tax forms, loan applications, and any workflow where fields depend on other fields or server facts. They also align dirty warnings, disabled submit state, field messages, and retry behavior around one state model.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It is unnecessary for a two-field form with no dependencies. It also fails when dependencies hide in ad hoc handlers, when async responses lack identity, or when the UI treats pending checks as known facts. The graph can find a broken rule, but message text still has to help the user recover.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'A checkout form has country, postal code, email, coupon, password, and confirm password. Country points to postal code, password points to confirm password, cart points to coupon, and email points to an async uniqueness check. If the user changes email from old@example.com to new@example.com before the first request returns, request version 17 must not overwrite version 18. Only affected fields revalidate, and the submit gate waits or falls back to server enforcement.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: React Hook Form useForm at https://react-hook-form.com/docs/useform, register at https://react-hook-form.com/docs/useform/register, subscribe at https://react-hook-form.com/docs/useform/subscribe, formState at https://react-hook-form.com/docs/useform/formstate, MDN Constraint Validation API at https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation, and the HTML forms standard at https://html.spec.whatwg.org/multipage/forms.html.',
        'Study Signals Reactivity Dependency Graph, UI State Machine Workflow, DOM Event Propagation and Path, AbortController Cancellation Graph, and Optimistic UI Mutation Log next.',
      ] },
  ],
};
