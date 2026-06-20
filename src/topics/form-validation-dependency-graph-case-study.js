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
      heading: 'Why this exists',
      paragraphs: [
        'Forms are small data systems. A checkout form may have local rules, cross-field rules, async checks, server-only business rules, dirty state, touched state, pending validation, and submit state.',
        'Validation exists to keep feedback fast while keeping submission honest. The user should learn about fixable local mistakes early, and the app should still treat the server as the final correctness boundary.',
        {type:'callout', text:'A robust form treats validation as a graph of field dependencies, async facts, error paths, and submit-state transitions.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is one `isValid` boolean and a submit handler that checks every field. That works for a small contact form.',
        'The next attempt adds per-field errors, but cross-field rules soon leak into random `onChange` handlers: country changes postal-code rules, password changes confirm-password validity, and cart changes coupon validity.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Global validation does too much work and gives poor feedback. Per-field validation alone misses dependencies. A stale async uniqueness check can mark submit valid after the user has already typed a different email.',
        'The missing structure is a graph of named fields, dependencies, validation layers, subscribers, and an error tree. The graph tells the form what must be rechecked and who must be notified.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Form validation is a dependency graph over field records. Each field has a name, value, metadata, local rules, maybe schema dependencies, maybe async validators, and subscribers that care about its value or error.',
        'Local constraints handle one field. Cross-field edges tell the runtime which other fields must revalidate when a dependency changes. The error tree stores the result in the same shape the UI uses to render messages and gate submit.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the field-graph view, read each edge as a reason one field can invalidate another. Country changes postal-code rules. Password changes confirm-password validity. Cart contents change coupon validity. The graph is what prevents those dependencies from hiding in random handlers.",
        "In the validation-flow view, follow the layers: native constraint, local rule, schema resolver, async check, submit gate, and server response. Each layer answers a different question, and none of the client layers replaces server validation.",
        "The highlighted error tree is the user-facing proof. A useful validation system can explain which field or form-level path failed, which rule produced the failure, and what state must change before submit can proceed.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout form asks for country, postal code, email, coupon, password, and confirm password. Changing country changes the postal-code pattern. Changing password invalidates confirm password. Changing cart contents can invalidate a coupon. Typing email launches a debounced uniqueness check that must be ignored if the user changes the email before the response returns.',
        'A dependency graph makes those updates explicit. Country points to postal code. Password points to confirm password. Cart points to coupon. Email points to an async validator with a version token or abort signal. When a source changes, only the affected slice of validation work reruns, and the error tree stays aligned with the UI.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A field registry gives every control an address. `email` maps to value, rules, dirty state, touched state, current error, and subscribers. Native constraints catch cheap local failures such as required, type=email, min, max, pattern, minlength, and maxlength.',
        'Schema or resolver validation handles form shape and cross-field rules. Country affects postal code. Password affects confirm password. Cart contents affect coupon validity. When a dependency changes, affected fields revalidate even if their own input did not change.',
        'Submit runs the whole graph and acts like a state-machine transition. It blocks side effects when errors exist, marks pending validation or submitting honestly, sends the request only when the client state is valid enough, and merges server errors back into the same error tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every displayed error belongs to a named field or form-level path, and every cross-field rule declares the values it reads. If a dependency changes, the affected validation result is no longer trusted until it is recomputed.',
        'Client and server validation have different jobs. Client validation improves feedback and prevents accidental mistakes. Server validation owns correctness because requests can be forged, scripts can be disabled, and client state can be stale.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Local validation is cheap and usually proportional to one field. Schema validation can be proportional to the whole form or to the touched dependency slice. Async validation pays network latency and needs cancellation, debouncing, or version checks to avoid stale results.',
        'The space cost is field records, metadata, dependency edges, subscriptions, validation queues, and an error tree. Subscription islands matter in large forms because re-rendering every field on every keystroke turns typing into a global update.',
        'Validation timing is part of the user experience. Validate too early and the form scolds before the user has finished typing. Validate too late and the submit button becomes the first honest feedback. Good systems choose per-field timing: immediate for cheap format checks, blur for noisy checks, and submit for expensive or server-owned rules.',
      ],
    },
    {
      heading: 'Async safety',
      paragraphs: [
        'Async validation needs identity. A response for `old@example.com` must not mark `new@example.com` valid. Use abort signals, monotonically increasing request versions, or compare the returned value with the current field value before committing the result.',
        'Pending state should be honest. If a field has a uniqueness check in flight, the UI should not silently treat the whole form as valid. The submit gate can wait, allow optimistic submit with server enforcement, or show a pending marker, but it should not pretend the async fact is already known.',
      ],
    },
    {
      heading: 'Server boundary',
      paragraphs: [
        'The server is the final validator because it owns authorization, current inventory, uniqueness, fraud policy, and business rules. The client graph can make the experience fast and clear, but it cannot prove that a request is allowed at the moment it reaches the backend.',
        'A strong form system therefore maps server errors back into the same error tree. If the server rejects `coupon.code`, the UI should show that path. If the whole submit is rejected because the cart changed, the form should represent that as a form-level error and refresh the affected dependencies.',
        'That shared shape is what keeps recovery understandable. The user should see the affected field, the reason, and the next action, regardless of which validation layer found the problem.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A validation graph wins in checkout, onboarding, admin editors, medical intake, tax forms, and any form where fields depend on other fields or server facts.',
        'It also makes UI behavior consistent. Field messages, submit disabled state, dirty warnings, server errors, and retry all read from explicit validation and workflow state instead of ad hoc flags.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not build a heavy validation graph for a two-field form with no dependencies. The structure pays off when the form has cross-field rules, async checks, many subscribers, or high cost for bad submission.',
        'Do not hide dependencies in random handlers, re-render the whole form for every keystroke, or let submit depend on stale async validation. Treat validation state as data, and still validate on the server.',
        'It also fails when validation messages are technically correct but unhelpful. The graph can identify the broken rule, but the article, form, or curriculum still has to teach the user how to recover. Good validation explains the fix, not only the failure.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: React Hook Form useForm at https://react-hook-form.com/docs/useform, register at https://react-hook-form.com/docs/useform/register, subscribe at https://react-hook-form.com/docs/useform/subscribe, watch at https://react-hook-form.com/docs/useform/watch, useWatch at https://react-hook-form.com/docs/usewatch, formState at https://react-hook-form.com/docs/useform/formstate, MDN Constraint Validation API at https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation, and the HTML forms standard at https://html.spec.whatwg.org/multipage/forms.html. Study Signals Reactivity Dependency Graph, UI State Machine Workflow, DOM Event Propagation & Path, AbortController Cancellation Graph, and Optimistic UI Mutation Log next.',
      ],
    },
  ],
};
