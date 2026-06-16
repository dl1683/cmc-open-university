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
      heading: 'What it is',
      paragraphs: [
        'Permissions Policy is a browser feature gate. A document can declare which origins are allowed to use policy-controlled features, including in iframes. The effective policy is evaluated by the browser before a feature API is exposed or allowed to proceed.',
        'The data structure is a feature-to-allowlist map applied over a document tree. Top-level headers, iframe allow attributes, inherited defaults, and browser-supported feature lists all contribute to the final decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A server can send Permissions-Policy headers such as feature=(allowlist). An embedding page can also use iframe allow to delegate a feature to a child frame. The browser intersects the relevant policy sources and decides whether the document may use the feature.',
        'This is not the same as the user permission prompt. A camera API might still require user consent, but policy can deny the feature before consent is requested. Policy can also generate reports for blocked feature use.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A marketplace page embeds ads, a payment iframe, a support chat widget, and a map. The owner denies camera and microphone by default, delegates payment only to the payment origin, considers geolocation only for the map origin, and keeps reports on during rollout. If an ad iframe tries to access a powerful feature, the browser blocks it at the policy gate.',
        'Permissions Policy is a least-privilege tool for the browser frame tree. It complements CSP Nonce & Hash Policy, Subresource Integrity Hash Manifest, iframe sandbox, and Capability Security Attenuation.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Browser support and feature names can vary, so production rollout needs compatibility checks. Policies should be monitored before being made strict where breakage would harm users.',
        'Do not treat Permissions Policy as authentication or data authorization. It controls browser features in documents and frames. It does not replace server-side access checks, CSP, sandboxing, or user consent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Permissions-Policy header at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy, MDN Permissions Policy guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy, W3C Permissions Policy at https://www.w3.org/TR/permissions-policy/, and Chrome permissions policy guide at https://developer.chrome.com/docs/privacy-security/permissions-policy. Study Capability Security Attenuation, CSP Nonce & Hash Policy, Subresource Integrity Hash Manifest, DOM Event Propagation & Path, and OAuth PKCE Token Lifecycle next.',
        'Storage Access API Third-Party Cookie Gate is the natural follow-up for embedded identity and payment flows: Permissions Policy can block a feature at the frame boundary, while Storage Access makes cookie access an explicit user-mediated capability.',
      ],
    },
  ],
};
