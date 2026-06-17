// Permissions Policy as a feature-gate lattice: top-level headers, iframe
// allow attributes, inherited defaults, allowlists, API checks, and reports.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'permissions-policy-feature-gate-case-study',
  title: 'Permissions Policy Feature Gate',
  category: 'Security',
  summary: 'How Permissions Policy gates powerful browser features across top-level documents and iframes with allowlists, inherited defaults, container policy, and reports.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['feature gate', 'iframe delegation'], defaultValue: 'feature gate' },
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

function policyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'top', label: 'top doc', x: 0.8, y: 4.6, note: notes.top ?? 'publisher' },
      { id: 'header', label: 'header', x: 2.6, y: 5.7, note: notes.header ?? 'policy' },
      { id: 'iframe', label: 'iframe', x: 2.6, y: 3.5, note: notes.iframe ?? 'embed' },
      { id: 'allow', label: 'allow', x: 4.8, y: 3.5, note: notes.allow ?? 'container' },
      { id: 'feature', label: 'feature', x: 4.8, y: 5.7, note: notes.feature ?? 'camera' },
      { id: 'ua', label: 'UA', x: 6.9, y: 4.6, note: notes.ua ?? 'gate' },
      { id: 'api', label: 'API', x: 8.6, y: 5.7, note: notes.api ?? 'request' },
      { id: 'report', label: 'report', x: 8.6, y: 3.5, note: notes.report ?? 'violation' },
      { id: 'result', label: 'result', x: 9.8, y: 4.6, note: notes.result ?? 'allow/deny' },
    ],
    edges: [
      { id: 'e-top-header', from: 'top', to: 'header', weight: '' },
      { id: 'e-top-iframe', from: 'top', to: 'iframe', weight: '' },
      { id: 'e-iframe-allow', from: 'iframe', to: 'allow', weight: '' },
      { id: 'e-header-feature', from: 'header', to: 'feature', weight: '' },
      { id: 'e-allow-feature', from: 'allow', to: 'feature', weight: '' },
      { id: 'e-feature-ua', from: 'feature', to: 'ua', weight: '' },
      { id: 'e-ua-api', from: 'ua', to: 'api', weight: '' },
      { id: 'e-ua-report', from: 'ua', to: 'report', weight: '' },
      { id: 'e-api-result', from: 'api', to: 'result', weight: '' },
    ],
  }, { title });
}

function* featureGate() {
  yield {
    state: policyGraph('A document declares browser feature allowlists'),
    highlight: { active: ['top', 'header', 'feature', 'e-top-header', 'e-header-feature'], found: ['ua'] },
    explanation: 'Permissions Policy lets a document define which origins can use policy-controlled browser features such as camera, microphone, geolocation, fullscreen, or payment.',
    invariant: 'Policy is a feature-to-origin allowlist.',
  };

  yield {
    state: policyGraph('The user agent gates API access before the API runs', { feature: 'geolocation', api: 'getCurrentPosition', result: 'deny' }),
    highlight: { active: ['feature', 'ua', 'api', 'result', 'e-feature-ua', 'e-ua-api', 'e-api-result'], compare: ['report'] },
    explanation: 'The policy check is separate from user permission prompts. A denied policy can prevent an API from being available even before the user is asked for permission.',
  };

  yield {
    state: policyGraph('Violations can be reported for operational feedback', { header: 'report-to', report: 'JSON report', result: 'blocked' }),
    highlight: { found: ['report'], active: ['header', 'ua', 'e-ua-report'], removed: ['api'] },
    explanation: 'Policies can produce violation reports. That makes rollout observable: a site can see which embeds or features would be blocked before relying on the policy as a hard gate.',
  };

  yield {
    state: labelMatrix(
      'Policy records',
      [
        { id: 'camera', label: 'camera' },
        { id: 'geo', label: 'geo' },
        { id: 'pay', label: 'payment' },
        { id: 'full', label: 'fullscreen' },
      ],
      [
        { id: 'allow', label: 'allowlist' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['self only', 'privacy'],
        ['partner', 'location'],
        ['self', 'money'],
        ['embed ok', 'spoofing'],
      ],
    ),
    highlight: { found: ['camera:allow', 'pay:allow'], compare: ['geo:risk', 'full:risk'] },
    explanation: 'Each feature has different risk. Permissions Policy gives a per-feature map rather than one coarse iframe sandbox switch.',
  };

  yield {
    state: labelMatrix(
      'Security layers',
      [
        { id: 'csp', label: 'CSP' },
        { id: 'perm', label: 'PermPolicy' },
        { id: 'sandbox', label: 'sandbox' },
        { id: 'user', label: 'user perm' },
      ],
      [
        { id: 'controls', label: 'controls' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['loads', 'feature use'],
        ['features', 'script load'],
        ['frame caps', 'top APIs'],
        ['consent', 'embed allow'],
      ],
    ),
    highlight: { found: ['csp:controls', 'perm:controls', 'sandbox:controls'], compare: ['user:misses'] },
    explanation: 'Permissions Policy is complementary to CSP and iframe sandbox. CSP controls resource execution. Permissions Policy controls powerful browser features. User permission still decides consent where applicable.',
  };
}

function* iframeDelegation() {
  yield {
    state: policyGraph('Iframe delegation needs both inherited policy and allow', { iframe: 'partner', allow: 'camera', feature: 'camera' }),
    highlight: { active: ['top', 'iframe', 'allow', 'feature', 'ua', 'e-top-iframe', 'e-iframe-allow', 'e-allow-feature'], compare: ['header'] },
    explanation: 'Embedded documents inherit policy from their parent and can also receive container policy through iframe allow. Cross-origin embeds should receive only the features they truly need.',
    invariant: 'Delegation should be explicit and minimal.',
  };

  yield {
    state: policyGraph('Default allowlists decide what happens with no policy', { header: 'none', feature: 'default', ua: 'inherit' }),
    highlight: { found: ['feature', 'ua'], compare: ['header', 'allow'] },
    explanation: 'Every policy-controlled feature has a default allowlist. Some features may be broadly available by default, while others are limited to self or disabled in cross-origin children unless delegated.',
  };

  yield {
    state: labelMatrix(
      'Embed design',
      [
        { id: 'ads', label: 'ads' },
        { id: 'maps', label: 'maps' },
        { id: 'pay', label: 'pay frame' },
        { id: 'chat', label: 'chat' },
      ],
      [
        { id: 'features', label: 'features' },
        { id: 'stance', label: 'stance' },
      ],
      [
        ['none', 'deny'],
        ['geo?', 'ask hard'],
        ['payment', 'narrow'],
        ['mic?', 'explicit'],
      ],
    ),
    highlight: { removed: ['ads:features'], found: ['pay:features'], compare: ['maps:stance', 'chat:stance'] },
    explanation: 'A production embed inventory should name feature needs per partner. Ads usually need almost none. Payment, maps, chat, and video embeds need targeted delegation and review.',
  };

  yield {
    state: policyGraph('A denied child cannot escalate itself', { iframe: 'third party', allow: 'none', feature: 'camera', api: 'request', result: 'denied' }),
    highlight: { removed: ['api', 'result'], active: ['iframe', 'allow', 'feature', 'ua', 'e-iframe-allow', 'e-allow-feature', 'e-feature-ua'] },
    explanation: 'A child frame cannot grant itself a feature the inherited/container policy denies. That makes the parent document the authority boundary for powerful browser capabilities.',
  };

  yield {
    state: policyGraph('Policy links capability security to browser embeds', { top: 'owner', header: 'least privilege', report: 'audit', result: 'bounded' }),
    highlight: { found: ['top', 'header', 'iframe', 'allow', 'ua', 'report'], active: ['e-top-header', 'e-ua-report'] },
    explanation: 'The data-structure lesson is an allowlist lattice over the frame tree. The effective policy is the intersection of defaults, headers, inherited policy, and container delegation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'feature gate') yield* featureGate();
  else if (view === 'iframe delegation') yield* iframeDelegation();
  else throw new InputError('Pick a Permissions Policy view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'A modern page is rarely one document. It is a tree of documents: the top-level page, payment frames, ad slots, maps, chat widgets, video tools, analytics tags, and internal dashboards embedded inside each other. Some of those documents can try to use powerful browser features such as camera, microphone, geolocation, fullscreen, payment, sensors, or storage-related capabilities.',
        'User permission prompts are not enough to model that authority. A prompt can ask whether the user wants to share location, but it does not know whether the publisher intended an ad frame, a map frame, or a support-chat frame to be allowed to ask. Permissions Policy gives the page owner a browser-enforced way to say which documents may even attempt specific features.',
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        'The browser already has several security layers. Same-origin policy protects many cross-origin reads. CSP controls where scripts, images, frames, and other resources may load from. iframe `sandbox` can remove broad powers from a child frame. User permissions still decide whether the user consents to a feature when a feature needs consent.',
        'Permissions Policy fills a different gap: capability delegation across the frame tree. The top-level page can set a `Permissions-Policy` header, and an embedding document can use an iframe `allow` attribute to delegate selected features to a child. The useful mental model is not authentication or data authorization. It is a feature gate placed before browser APIs run.',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'The core data structure is a feature-to-origin allowlist evaluated over a document tree. For each policy-controlled feature, the browser can ask: what does the feature allow by default, what did the top-level response say, what policy did this child inherit, and what did the parent delegate through the iframe container?',
        'That creates a least-privilege lattice. Each boundary can narrow what survives. A child frame cannot grant itself a capability that the inherited policy or container policy denied, and a parent should delegate only the capabilities the child actually needs.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'At the top level, the server can send a `Permissions-Policy` header that names features and allowlists. An allowlist might allow only `self`, allow specific origins, or disable a feature entirely. The exact set of policy-controlled features changes across browsers, so production code should treat feature names as part of a compatibility contract, not as an abstract list that works everywhere.',
        'For iframes, the browser combines inherited policy with container policy from the iframe `allow` attribute. When code calls a policy-controlled API, the user agent checks the effective policy before the feature proceeds. If policy denies the feature, the call may fail or the feature may be unavailable before any user prompt appears. Reporting can make violations observable during rollout.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a publisher page with four embeds: an ad frame, a map frame, a payment frame, and a support-chat frame. The page disables camera for everyone, delegates geolocation only to the map partner, delegates payment only to the payment provider, and leaves the ad frame with no powerful features. The browser now has a per-feature decision table instead of a vague trust relationship with every partner.',
        'If the ad frame calls a geolocation API, the user agent checks the effective policy for the ad frame and denies it before a location prompt matters. If the map frame calls the same API and the inherited policy plus iframe delegation allow that origin, then policy passes and the normal user permission path can still decide whether the user shares location.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because feature access follows the frame authority graph. The browser, not the child script, computes the effective policy. A third-party child can use only the features that survive defaults, headers, inherited restrictions, and explicit container delegation.',
        'The safety property is monotonic narrowing. Moving down the frame tree should not magically create new authority. That is the capability-security lesson: delegation is explicit, narrower than the parent authority, and enforced at the boundary where the protected API would run.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'In the feature-gate view, follow the path from top document to header, feature, user agent, API, report, and result. The important split is between policy and consent: policy decides whether this document is eligible to ask; user permission, where applicable, comes after that.',
        'In the iframe-delegation view, focus on the parent-to-child boundary. The `allow` node is not a local preference inside the child frame. It is container policy supplied by the embedder. The final lattice frame is the whole lesson: defaults, headers, inherited policy, and iframe delegation intersect into one effective decision.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'The main cost is inventory. A real page has to know which partners need which features, which frames are cross-origin, which features are policy-controlled in the target browsers, and which existing embeds rely on browser defaults.',
        'Strict policies can break embeds that were silently relying on default access. A careful rollout usually starts with reporting and narrow exceptions. The dangerous failure is turning a least-privilege policy into a long broad allowlist because nobody wants to own the partner-by-partner review.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'Permissions Policy is not authentication, data authorization, CSP, or user consent. It controls browser-exposed features in documents and frames; it does not decide who may read database rows, call server APIs, load scripts, or access data that application code already handed to the frame.',
        'It also cannot protect features that are not exposed through policy, and support varies by browser and feature. Treat it as one browser capability layer. Pair it with CSP, iframe sandboxing where appropriate, server-side authorization, and clear partner contracts.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A common failure mode is a missing delegation. A partner iframe works in staging because defaults happen to allow something, then fails in production when the header tightens or the frame becomes cross-origin. Reporting and synthetic checks should cover the important embedded flows before the policy becomes a hard gate.',
        'Another failure mode is assuming policy denial is the same as privacy. If the parent passes sensitive data to a frame through URLs, postMessage, DOM content, or server APIs, Permissions Policy will not claw that data back. It prevents certain browser capabilities; it does not sanitize the application design.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use Permissions Policy when a page owns many embeds and wants the browser to enforce partner boundaries: marketplaces, publisher pages, SaaS dashboards, payment flows, maps, video calls, and support widgets. Start from an embed inventory, list the features each partner actually needs, deny the rest, and keep exceptions tied to named origins and product flows.',
        'Operationally, treat the policy as code. Review it when a new iframe ships, monitor violation reports, test in the browsers your users actually run, and document why each delegated feature exists. The best policies are boring: small, explicit, and easy to audit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Permissions-Policy header at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy, MDN Permissions Policy guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy, W3C Permissions Policy at https://www.w3.org/TR/permissions-policy/, and Chrome permissions policy guide at https://developer.chrome.com/docs/privacy-security/permissions-policy.',
        'Study Capability Security Attenuation, CSP Nonce & Hash Policy, Subresource Integrity Hash Manifest, DOM Event Propagation & Path, Storage Access API Third-Party Cookie Gate, and OAuth PKCE Token Lifecycle next. They separate capability delegation, resource loading, embedded identity, and user authorization, which are often confused in browser security work.',
      ],
    },
  ],
};
