// Kubernetes ServiceAccount and RBAC: projected tokens authenticate workload
// identity, then RBAC authorizes verbs on resources.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-serviceaccount-rbac-token-boundary-case-study',
  title: 'Kubernetes ServiceAccount RBAC Token Boundary Case Study',
  category: 'Security',
  summary: 'How Pods use ServiceAccounts, projected TokenRequest JWTs, audiences, automount controls, Roles, RoleBindings, ClusterRoles, and least-privilege reviews.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['token boundary', 'rbac decision'], defaultValue: 'token boundary' },
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

function authGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pod', label: 'Pod', x: 0.7, y: 3.8, note: notes.pod ?? 'workload' },
      { id: 'sa', label: 'SA', x: 2.2, y: 3.8, note: notes.sa ?? 'identity' },
      { id: 'token', label: 'token', x: 3.9, y: 2.3, note: notes.token ?? 'JWT' },
      { id: 'aud', label: 'aud', x: 3.9, y: 5.3, note: notes.aud ?? 'scope' },
      { id: 'api', label: 'API', x: 5.8, y: 3.8, note: notes.api ?? 'authn' },
      { id: 'role', label: 'Role', x: 7.4, y: 2.3, note: notes.role ?? 'verbs' },
      { id: 'bind', label: 'Bind', x: 7.4, y: 5.3, note: notes.bind ?? 'subject' },
      { id: 'allow', label: 'allow?', x: 9.1, y: 3.8, note: notes.allow ?? 'authz' },
    ],
    edges: [
      { id: 'e-pod-sa', from: 'pod', to: 'sa' },
      { id: 'e-sa-token', from: 'sa', to: 'token' },
      { id: 'e-token-aud', from: 'token', to: 'aud' },
      { id: 'e-token-api', from: 'token', to: 'api' },
      { id: 'e-api-role', from: 'api', to: 'role' },
      { id: 'e-sa-bind', from: 'sa', to: 'bind' },
      { id: 'e-role-allow', from: 'role', to: 'allow' },
      { id: 'e-bind-allow', from: 'bind', to: 'allow' },
    ],
  }, { title });
}

function* tokenBoundary() {
  yield {
    state: authGraph('A Pod acts as a ServiceAccount'),
    highlight: { active: ['pod', 'sa', 'e-pod-sa'], compare: ['role', 'bind'] },
    explanation: 'A Pod can be assigned a ServiceAccount with spec.serviceAccountName. That account is the workload identity used when the Pod calls the Kubernetes API.',
    invariant: 'Authentication says who the workload is; RBAC says what it may do.',
  };

  yield {
    state: authGraph('Projected tokens are short-lived and audience-scoped', { token: 'bound', aud: 'api' }),
    highlight: { active: ['sa', 'token', 'aud', 'api', 'e-sa-token', 'e-token-aud', 'e-token-api'], compare: ['allow'] },
    explanation: 'Modern ServiceAccount tokens are requested through the TokenRequest API and mounted as projected volumes. They can have expiration, audience, and binding to a Pod lifetime.',
  };

  yield {
    state: labelMatrix(
      'Token checks',
      [
        { id: 'sig', label: 'sig' },
        { id: 'exp', label: 'exp' },
        { id: 'aud', label: 'aud' },
        { id: 'obj', label: 'obj' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['valid', 'forge'],
        ['fresh', 'stale'],
        ['match', 'reuse'],
        ['exists', 'orphan'],
      ],
    ),
    highlight: { active: ['sig:check', 'exp:check', 'aud:check'], found: ['obj:risk'] },
    explanation: 'The API server validates token signature, expiry, object binding, validity timing, and audience. External services should also check the audience they expect.',
  };

  yield {
    state: labelMatrix(
      'Mount policy',
      [
        { id: 'auto', label: 'auto' },
        { id: 'proj', label: 'proj' },
        { id: 'legacy', label: 'old' },
        { id: 'off', label: 'off' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['default', 'leak'],
        ['bound', 'safer'],
        ['Secret', 'long'],
        ['false', 'break'],
      ],
    ),
    highlight: { active: ['proj:mode', 'off:mode'], compare: ['legacy:risk'] },
    explanation: 'Not every Pod needs API credentials. automountServiceAccountToken false is a useful default for workloads that never call the API server.',
  };
}

function* rbacDecision() {
  yield {
    state: authGraph('RBAC combines Role rules with a binding subject'),
    highlight: { active: ['role', 'bind', 'allow', 'e-role-allow', 'e-bind-allow'], found: ['sa'] },
    explanation: 'RBAC authorization checks whether the authenticated ServiceAccount is bound to a Role or ClusterRole that allows the requested verb on the requested resource.',
  };

  yield {
    state: labelMatrix(
      'RBAC tuple',
      [
        { id: 'verb', label: 'verb' },
        { id: 'res', label: 'res' },
        { id: 'ns', label: 'ns' },
        { id: 'subj', label: 'subj' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['get', 'list'],
        ['pods', '*'],
        ['team', 'all'],
        ['SA', 'wrong'],
      ],
    ),
    highlight: { active: ['verb:ask', 'res:ask', 'subj:ask'], compare: ['res:risk'] },
    explanation: 'A useful review normalizes RBAC into tuples: subject, namespace, resource, verb, and scope. Wildcards and ClusterRoleBindings expand blast radius quickly.',
  };

  yield {
    state: authGraph('Least privilege binds narrow roles to narrow ServiceAccounts', { role: 'get pods', bind: 'team/sa', allow: 'yes' }),
    highlight: { active: ['sa', 'role', 'bind', 'allow'], compare: ['aud'] },
    explanation: 'The same workload identity should not carry admin permissions just because it runs in a privileged namespace. Narrow ServiceAccounts and RoleBindings reduce confused-deputy damage.',
  };

  yield {
    state: labelMatrix(
      'Complete case: controller',
      [
        { id: 'watch', label: 'watch' },
        { id: 'patch', label: 'patch' },
        { id: 'secret', label: 'secret' },
        { id: 'wild', label: 'wild' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'grant', label: 'grant' },
      ],
      [
        ['pods', 'yes'],
        ['status', 'yes'],
        ['none', 'no'],
        ['none', 'no'],
      ],
    ),
    highlight: { active: ['watch:grant', 'patch:grant'], compare: ['secret:grant', 'wild:grant'] },
    explanation: 'A custom controller may need watch on Pods and patch on status, but not list Secrets or wildcard access. The Role should express exactly that job.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'token boundary') yield* tokenBoundary();
  else if (view === 'rbac decision') yield* rbacDecision();
  else throw new InputError('Pick a Kubernetes ServiceAccount/RBAC view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Kubernetes ServiceAccount is workload identity. A Pod can act as a ServiceAccount, receive a projected token, and authenticate to the API server. RBAC then decides what that identity is allowed to do.',
        'The official ServiceAccounts documentation explains spec.serviceAccountName, automountServiceAccountToken, short-lived TokenRequest tokens, projected volume rotation, JWT validation, audience checks, and object-bound invalidation: https://kubernetes.io/docs/concepts/security/service-accounts/. The ServiceAccount task guide covers projected service account tokens for Pods: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The token side is an identity proof: ServiceAccount name, namespace, audience, expiry, object binding, signature, and validity. The authorization side is an RBAC tuple: subject, role rules, verbs, resources, namespace scope, and binding scope.',
        'RBAC good-practice documentation emphasizes least privilege, namespace-level bindings where possible, avoiding wildcards, and understanding privilege escalation risks: https://kubernetes.io/docs/concepts/security/rbac-good-practices/. Authentication documentation describes bearer-token use and JWT token behavior: https://kubernetes.io/docs/reference/access-authn-authz/authentication/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A custom controller watches Pods and patches a status subresource. It runs under serviceAccountName pod-status-controller. The Pod receives a short-lived projected token with the Kubernetes API audience. A Role allows get, list, and watch Pods plus patch on the specific status resource in one namespace. A RoleBinding binds that Role to only this ServiceAccount. The controller cannot read Secrets or mutate Deployments.',
        'The failure mode is accidental ambient power. If every Pod gets the default ServiceAccount token, and that ServiceAccount is broadly bound, an application bug becomes cluster API access. Disable automount for workloads that do not need it and bind narrow roles to purpose-specific ServiceAccounts.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study JWT/JWS/JWKS Verification for token validation, Capability Security and Attenuation for least authority, Zanzibar Authorization for relationship-based permissions, OPA Rego Policy Decision Graph for policy review, and Kubernetes Admission Policy Gate for request-time enforcement.',
      ],
    },
  ],
};
