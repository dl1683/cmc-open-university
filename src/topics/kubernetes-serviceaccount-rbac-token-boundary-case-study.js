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
    explanation: 'A projected token narrows the credential in time and audience. If the Pod disappears or the wrong service receives the token, validation should fail instead of granting ambient cluster access.',
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
    explanation: 'RBAC review reduces a request to a tuple: subject, namespace, resource, verb, and scope. Wildcards and ClusterRoleBindings make many tuples true at once, so blast radius expands quickly.',
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
      heading: 'Why This Boundary Exists',
      paragraphs: [
        'Pods often need to call the Kubernetes API. A controller watches Pods, an operator patches custom resources, a backup agent reads VolumeSnapshots, and an admission helper may inspect configuration. The cluster needs a workload identity for each of those calls before it can decide whether the call should be allowed.',
        'A ServiceAccount supplies that workload identity. A Pod can run as a named ServiceAccount, receive a projected token, and authenticate to the API server as that account. RBAC then answers a separate question: is this authenticated subject allowed to perform this verb on this resource in this scope?',
        'The boundary matters because Kubernetes API access is operational authority. A token that can list Secrets, patch Deployments, create Pods, or update RoleBindings is not just a login artifact. It is a capability to change the cluster. The design goal is to give each workload the smallest usable slice of that authority.',
      ],
    },
    {
      heading: 'Why Broad Defaults Fail',
      paragraphs: [
        'The obvious shortcut is to let every Pod mount the default ServiceAccount token and bind broad permissions until applications stop failing authorization checks. Teams sometimes go further and share an administrative kubeconfig with automation because it is easy to understand and quick to unblock.',
        'That shortcut turns identity into ambient authority. If every workload uses the same account, audit logs cannot distinguish the controller from the metrics sidecar. If the account has broad rights, a single application bug can become read access to Secrets or write access to Deployments. If a long-lived bearer token leaks, anyone who holds it can act until it is revoked or expires.',
        'The hard wall is that authentication and authorization solve different problems. A valid token proves who the workload is. It does not prove that the workload should list Secrets, patch status, or create Jobs. The RoleBinding or ClusterRoleBinding must grant the requested action explicitly.',
      ],
    },
    {
      heading: 'Core insight: identity, token, and RBAC boundary',
      paragraphs: [
        'The ServiceAccount side stores workload identity. A Pod names the account through spec.serviceAccountName, or it falls back to the namespace default. The token side carries a signed JWT with claims such as issuer, subject, namespace, ServiceAccount name, audience, expiration, and sometimes object binding to a Pod or Secret.',
        'The RBAC side stores authorization policy. A Role contains rules inside a namespace. A ClusterRole contains cluster-scoped rules or reusable namespaced rules. A RoleBinding attaches a Role or ClusterRole to subjects within a namespace. A ClusterRoleBinding attaches a ClusterRole to subjects at cluster scope. The decision is allow-based: if no rule matches, the request is denied.',
      ],
    },
    {
      heading: 'Token Mechanism',
      paragraphs: [
        'Modern Pods normally use projected ServiceAccount tokens created through the TokenRequest flow. These tokens are short-lived, mounted into the Pod as a projected volume, and rotated by kubelet. They are also audience-scoped, which means a token intended for the Kubernetes API should not automatically authenticate to some unrelated internal service.',
        'Validation checks more than the signature. The receiver should verify issuer, signature, expiration, not-before timing, audience, and any relevant object binding. Object-bound tokens help reduce stale credential risk because a token tied to a Pod should stop being valid after the Pod is gone. External services that accept Kubernetes tokens should require their own audience instead of accepting any cluster token.',
        'The practical lesson is simple: a token is a bearer credential, so possession matters. Short lifetime, narrow audience, rotation, and disabling unnecessary mounts all reduce the damage from accidental exposure.',
      ],
    },
    {
      heading: 'RBAC Mechanism',
      paragraphs: [
        'RBAC reduces an API call to a tuple. The request has an authenticated subject, namespace, API group, resource or subresource, resource name when applicable, and verb such as get, list, watch, create, update, patch, delete, or escalate. Authorization checks whether any bound rule grants that exact kind of request.',
        'Scope is the main design pressure. A namespaced RoleBinding can grant a ServiceAccount permissions in one namespace. A ClusterRoleBinding can grant permissions across the cluster. Wildcards such as resources: ["*"] or verbs: ["*"] make many future requests possible, including requests the author may not have considered when the policy was created.',
        'Kubernetes RBAC has no normal deny rule that subtracts power after a broad allow. That makes least privilege a construction problem rather than a cleanup problem. Bind narrow roles to narrow identities first, and escalate only when the workload has a specific job that requires it.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The design works because it composes two small checks. Authentication says "this caller is system:serviceaccount:team-a:pod-status-controller." Authorization says "that subject is bound to a rule that permits list on pods in namespace team-a." If either part fails, the request does not proceed as authorized cluster work.',
        'This separation gives both auditability and blast-radius control. Audit logs can show which ServiceAccount acted. RBAC can grant only the verbs and resources required by that workload. Token audiences and expiry reduce the usefulness of stolen credentials. None of these controls is perfect alone, but together they make authority specific, inspectable, and shorter-lived.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'A custom controller in namespace team-a needs to watch Pods and patch a status subresource. It runs with serviceAccountName set to pod-status-controller. Its Role grants get, list, and watch on pods, plus patch on the required status subresource. A RoleBinding binds that Role only to system:serviceaccount:team-a:pod-status-controller.',
        'When the controller calls list pods, the API server authenticates the token, identifies the ServiceAccount, and finds the RoleBinding and rule that allow the request. When the same process tries to list Secrets, authentication still succeeds but RBAC denies the request because no matching rule grants secrets/list. This is the boundary doing useful work: the credential is valid, but the authority is limited.',
        'If the team later needs the controller to watch ConfigMaps, the right change is a narrow rule for that resource, not a wildcard. If it needs the same behavior in another namespace, the team can create another RoleBinding there. Each expansion is visible and reviewable.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Create purpose-specific ServiceAccounts instead of reusing the namespace default. Disable automountServiceAccountToken for Pods that never call the API server. Prefer Role and RoleBinding in a namespace over ClusterRoleBinding when the workload does not need cluster-wide access. Avoid wildcards unless the operational reason is written down and reviewed.',
        'Review permissions from the request shape backward. Ask which verbs the workload performs, on which resources, in which API groups, in which namespaces, and whether it needs list or watch rather than only get. Watch and list can reveal many objects. Patch and update can change behavior. Create pods can become powerful when combined with privileged admission gaps.',
        'Use kubectl auth can-i or SubjectAccessReview-style checks during development, but do not treat a passing can-i command as a complete review. Also inspect bindings, aggregated ClusterRoles, admission controls, token mount policy, and whether external services validate token audience.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'The first failure mode is accidental ambient power. A Pod that never calls the API still mounts a token. The default ServiceAccount later receives a broad binding. An application vulnerability exposes the token, and the attacker now has cluster API access that the application never needed.',
        'The second failure mode is scope creep through bindings. A ClusterRoleBinding grants a controller cluster-wide authority because one namespace needed it urgently. A wildcard rule allows new resources added later. An aggregated ClusterRole receives extra rules through labels. The policy still looks small in one file, but the effective permission set grows.',
        'The third failure mode is confusing ServiceAccounts with end-user identity. A web application may authenticate to the API as its backend ServiceAccount, but that does not prove which human clicked a button. Application-level authorization, impersonation controls, audit annotations, and admission policy may still be required.',
      ],
    },
    {
      heading: 'Implementation Checklist',
      paragraphs: [
        'For each workload, record the ServiceAccount name, namespace, whether the token is mounted, which audiences are used, expected token lifetime, and every RoleBinding or ClusterRoleBinding that names the account. This inventory catches two common mistakes: a workload with a token it never uses, and a workload with more bindings than its job requires.',
        'For each RBAC rule, record the business reason for each verb and resource. Get, list, and watch are read powers with different blast radii. Patch and update are write powers. Create pods, exec, secrets access, and role-binding powers deserve special review because they can become privilege-escalation paths when combined with other cluster settings.',
        'For external services that trust ServiceAccount tokens, require a dedicated audience, validate issuer and JWKS, reject expired tokens, and avoid using Kubernetes workload identity as a substitute for service-specific authorization. A valid token should identify the caller, not automatically grant every service action.',
      ],
    },
    {
      heading: 'Where It Matters',
      paragraphs: [
        'This boundary matters most for controllers, operators, CI agents, backup systems, monitoring agents, admission helpers, and any application that reaches back into the Kubernetes API. These workloads often need real authority, so the difference between exact authority and broad authority is the difference between a contained bug and a cluster incident.',
        'It also matters in multi-tenant clusters. Namespaces are not a complete security boundary by themselves. ServiceAccount identity, RBAC scope, token audience, admission policy, network policy, and secret handling all have to align. RBAC tells the API server which requests are allowed; the rest of the system must still reduce the ways a token can be stolen or misused.',
      ],
    },
    {
      heading: 'Cost And Tradeoffs',
      paragraphs: [
        'The runtime cost of token validation and RBAC checks is usually small compared with application work. The real cost is policy maintenance. Every narrow RoleBinding is another object to manage. Every broad binding is easier to manage but harder to defend. Good platforms make narrow grants easy through templates, review tools, and ownership conventions.',
        'Short-lived projected tokens improve safety but require clients and external validators to handle rotation and audience correctly. Disabling automount improves safety but breaks applications that quietly assumed in-cluster API credentials. Least privilege is not free; it forces the team to know what each workload actually does.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary Kubernetes references are the ServiceAccounts concept documentation, the configure-service-account task guide, the RBAC authorization documentation, and the TokenRequest API behavior. Read them with one question in mind: which part proves identity, and which part grants authority?',
        'Inside this curriculum, study JWT, JWS, and JWKS Verification for token validation, Capability Security and Attenuation for least authority, Zanzibar Authorization for relationship-based permissions, OPA Rego Policy Decision Graph for policy review, Kubernetes Admission Policy Gate for request-time enforcement, and Audit Log Tamper Evidence for investigation after a token or permission incident.',
      ],
    },
  ],
};
