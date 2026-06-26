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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a browser-enforced capability decision. Active nodes show policy sources, found nodes show allowed or reported outcomes, and removed nodes show API paths blocked before the feature runs.',
        'A policy-controlled feature is a browser capability such as camera, geolocation, fullscreen, or payment. The safe inference rule is that a child frame cannot grant itself a feature that the effective parent and container policy deny.',
        {type:'callout', text:'Permissions Policy turns browser features into a least privilege allowlist evaluated across the frame tree before powerful APIs run.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A modern page is a tree of documents. The top page may embed ads, maps, payment frames, support chat, dashboards, and video tools, and some of those frames can request powerful browser features.',
        'User permission prompts do not express publisher intent. A browser may ask whether the user wants to share location, but the site owner still needs a way to say which embedded document is eligible to ask.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust partners or rely on iframe sandbox alone. That can block broad powers, but it does not provide a precise per-feature allowlist for camera, geolocation, payment, and similar APIs.',
        'Another obvious approach is to depend on user consent prompts. That misses the authority question because the wrong frame may be able to trigger the prompt in the first place.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is delegation. A top-level document may need to let a map frame use geolocation while denying the same feature to an ad frame and a comments frame.',
        'The second wall is browser enforcement across origins. Application code inside a third-party frame should not be the authority for deciding whether that frame can use a powerful feature.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model browser features as allowlists evaluated over the frame tree. Defaults, top-level headers, inherited policy, and iframe allow attributes intersect into an effective policy for each document.',
        'The structure is a least-privilege lattice. Moving down the tree can preserve or narrow authority, but it should not create new authority that the parent did not delegate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A server can send a Permissions-Policy header that names features and allowed origins. An embedder can also put an allow attribute on an iframe to delegate selected features to that child.',
        'When code calls a policy-controlled API, the user agent checks the effective policy before the feature proceeds. If policy denies the feature, the API may be unavailable or fail before any user permission prompt appears.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is authority monotonicity. A child document can use only the capabilities that survive defaults, headers, inherited restrictions, and explicit container delegation.',
        'The browser computes that decision at the API boundary, so a denied child cannot bypass policy by changing its own script. Reporting helps verify rollout by showing attempted uses that policy blocked or would block.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is inventory and compatibility work. A site must know which frames exist, which origins own them, which features they need, and which browsers support each policy-controlled feature.',
        'Strict policies can break silent dependencies. If 40 partner frames have relied on defaults for years, moving to explicit allowlists requires reporting, staged rollout, and owners for each exception.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Permissions Policy fits publisher pages, SaaS dashboards, embedded payments, maps, video calls, marketplace widgets, and support tools. The access pattern is browser capability delegation across document boundaries.',
        'It is strongest when combined with an embed inventory. Ads may need no powerful features, a map may need geolocation, a payment frame may need payment, and a video tool may need camera and microphone only on its own origin.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a substitute for authentication, CSP, server authorization, or user consent. Permissions Policy controls browser-exposed features; it does not decide who may read database rows or which scripts may load.',
        'It also cannot protect data the application already handed to a frame. If sensitive data is sent through URL parameters, postMessage, DOM content, or server APIs, feature denial will not remove that disclosure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A publisher page embeds 4 partners: ads.example, maps.example, pay.example, and chat.example. The policy denies camera everywhere, delegates geolocation only to maps.example, and delegates payment only to pay.example.',
        'When ads.example calls geolocation, the browser computes the effective policy and denies the call before a prompt. When maps.example calls geolocation, policy passes, and the normal user permission layer can still ask whether the user wants to share location.',
        'If a new video partner needs camera, the site must add a specific delegation for that origin. That change should be reviewed like code because it expands the browser capability set available to a frame.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study MDN Permissions-Policy header at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy, the MDN guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Permissions_Policy, W3C Permissions Policy at https://www.w3.org/TR/permissions-policy/, and the Chrome guide at https://developer.chrome.com/docs/privacy-security/permissions-policy.',
        'Next, study Capability Security Attenuation, CSP Nonce and Hash Policy, Subresource Integrity Hash Manifest, DOM Event Propagation and Path, Storage Access API Third-Party Cookie Gate, and OAuth PKCE Token Lifecycle. These topics separate browser capability delegation from resource loading, embedded identity, and server authorization.',
      ],
    },
  ],
};