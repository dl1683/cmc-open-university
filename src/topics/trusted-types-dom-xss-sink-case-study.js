// Trusted Types: turn DOM injection sinks into typed capability boundaries
// backed by CSP enforcement, policy registries, sanitizers, and rollout reports.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'trusted-types-dom-xss-sink-case-study',
  title: 'Trusted Types DOM XSS Sink Guard',
  category: 'Security',
  summary: 'How Trusted Types, CSP enforcement, named policies, sanitizers, DOM XSS sinks, report-only rollout, and legacy adapters fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sink guard', 'policy rollout'], defaultValue: 'sink guard' },
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

function ttGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'raw', x: 0.5, y: 4.2, note: notes.input ?? 'HTML string' },
      { id: 'sink', label: 'sink', x: 2.5, y: 4.2, note: notes.sink ?? 'innerHTML' },
      { id: 'csp', label: 'CSP', x: 4.1, y: 5.5, note: notes.csp ?? 'require TT' },
      { id: 'registry', label: 'registry', x: 4.1, y: 2.9, note: notes.registry ?? 'names' },
      { id: 'policy', label: 'policy', x: 6.1, y: 2.9, note: notes.policy ?? 'factory' },
      { id: 'sanitize', label: 'sanitize', x: 8.0, y: 2.9, note: notes.sanitize ?? 'clean' },
      { id: 'trusted', label: 'THTML', x: 8.0, y: 5.5, note: notes.trusted ?? 'HTML' },
      { id: 'dom', label: 'DOM', x: 9.5, y: 4.2, note: notes.dom ?? 'render' },
    ],
    edges: [
      { id: 'e-input-sink', from: 'input', to: 'sink', weight: '' },
      { id: 'e-sink-csp', from: 'sink', to: 'csp', weight: '' },
      { id: 'e-reg-policy', from: 'registry', to: 'policy', weight: '' },
      { id: 'e-policy-sanitize', from: 'policy', to: 'sanitize', weight: '' },
      { id: 'e-sanitize-trusted', from: 'sanitize', to: 'trusted', weight: '' },
      { id: 'e-trusted-sink', from: 'trusted', to: 'sink', weight: '' },
      { id: 'e-sink-dom', from: 'sink', to: 'dom', weight: '' },
      { id: 'e-csp-registry', from: 'csp', to: 'registry', weight: '' },
    ],
  }, { title });
}

function* sinkGuard() {
  yield {
    state: ttGraph('Without enforcement, a string can flow into a dangerous sink', { input: 'comment', csp: 'off', dom: 'script?' }),
    highlight: { active: ['input', 'sink', 'dom', 'e-input-sink', 'e-sink-dom'], removed: ['csp'] },
    explanation: 'DOM XSS often happens when untrusted strings reach injection sinks such as innerHTML. Trusted Types changes the sink contract so raw strings are no longer accepted when enforcement is enabled.',
    invariant: 'The sink boundary is the key data structure: raw strings should not cross it.',
  };

  yield {
    state: ttGraph('CSP enforcement rejects raw strings at the sink', { csp: 'enforce', sink: 'guarded', dom: 'blocked' }),
    highlight: { active: ['sink', 'csp', 'e-sink-csp'], removed: ['e-input-sink', 'dom'] },
    explanation: 'With require-trusted-types-for enabled, the browser can throw instead of assigning a plain string to a protected DOM sink. That turns an audit finding into a runtime boundary.',
  };

  yield {
    state: ttGraph('Named policies are capability factories', { registry: 'allowlist', policy: 'safeHTML', sanitize: 'DOMPurify', trusted: 'TrustedHTML' }),
    highlight: { active: ['registry', 'policy', 'sanitize', 'trusted', 'e-reg-policy', 'e-policy-sanitize', 'e-sanitize-trusted'] },
    explanation: 'A policy is a named factory for trusted values. The application should keep policy names few, reviewed, and tied to real sanitization or escaping behavior.',
  };

  yield {
    state: labelMatrix(
      'Sink map',
      [
        { id: 'html', label: 'HTML' },
        { id: 'script', label: 'script' },
        { id: 'url', label: 'scriptURL' },
        { id: 'template', label: 'template' },
      ],
      [
        { id: 'type' },
        { id: 'risk' },
      ],
      [
        ['TrustedHTML', 'DOM XSS'],
        ['TrustedScript', 'eval path'],
        ['TrustedURL', 'loader'],
        ['TrustedHTML', 'markup'],
      ],
    ),
    highlight: { active: ['html:type', 'url:type'], compare: ['script:risk'] },
    explanation: 'Trusted Types is not one sanitizer. It is a typed contract around several dangerous sink families, with different trusted value classes for different target contexts.',
  };

  yield {
    state: ttGraph('A trusted value crosses the sink boundary intentionally', { input: 'markdown', policy: 'mdPolicy', sanitize: 'strip JS', trusted: 'TrustedHTML', dom: 'safe render' }),
    highlight: { active: ['input', 'registry', 'policy', 'sanitize', 'trusted', 'sink', 'dom', 'e-trusted-sink', 'e-sink-dom'], compare: ['csp'] },
    explanation: 'The final flow is explicit: raw content goes through a reviewed policy, the policy returns TrustedHTML, and the sink accepts that typed value. The review surface becomes smaller.',
  };
}

function* policyRollout() {
  yield {
    state: ttGraph('Start in report-only mode to discover sink traffic', { csp: 'report-only', registry: 'observe', dom: 'still works' }),
    highlight: { active: ['sink', 'csp', 'registry', 'e-sink-csp', 'e-csp-registry'], compare: ['dom'] },
    explanation: 'Legacy apps often have many hidden sink writes. Report-only CSP lets teams collect violations before enforcement so they can prioritize high-traffic paths.',
    invariant: 'A Trusted Types rollout is an inventory problem before it is an enforcement problem.',
  };

  yield {
    state: labelMatrix(
      'Rollout queue',
      [
        { id: 'render', label: 'render' },
        { id: 'cms', label: 'CMS' },
        { id: 'widget', label: 'widget' },
        { id: 'ads', label: 'ads' },
      ],
      [
        { id: 'fix' },
        { id: 'risk' },
      ],
      [
        ['escape', 'low'],
        ['sanitize', 'stored XSS'],
        ['adapter', 'vendor'],
        ['isolate', 'high'],
      ],
    ),
    highlight: { active: ['render:fix', 'cms:fix', 'widget:fix'], compare: ['ads:risk'] },
    explanation: 'The migration queue classifies each sink by owner, fix strategy, and risk. Some paths need escaping, some need sanitization, and some third-party code should move to a sandboxed frame.',
  };

  yield {
    state: ttGraph('Trusted policy names should be few and reviewed', { registry: '2 names', policy: 'cmsHTML', sanitize: 'allowlist' }),
    highlight: { active: ['registry', 'policy', 'sanitize', 'trusted', 'e-reg-policy', 'e-policy-sanitize'], compare: ['input'] },
    explanation: 'The trusted-types CSP directive can restrict which policy names may be created. That prevents arbitrary libraries from minting their own bypass policy after enforcement begins.',
  };

  yield {
    state: ttGraph('A default policy can hide debt if it is too broad', { registry: 'default', policy: 'catch all', sanitize: 'weak', dom: 'masked' }),
    highlight: { active: ['registry', 'policy', 'sanitize'], compare: ['sink', 'dom'], removed: ['csp'] },
    explanation: 'A default policy may help compatibility, but it can also turn a strict type boundary into a silent sanitizer call everywhere. Use it carefully and remove it as owners fix call sites.',
  };

  yield {
    state: ttGraph('The complete case study is a CMS preview surface', { input: 'article', policy: 'cmsHTML', sanitize: 'allow tags', trusted: 'TrustedHTML', dom: 'preview' }),
    highlight: { active: ['input', 'registry', 'policy', 'sanitize', 'trusted', 'sink', 'dom'], found: ['csp'] },
    explanation: 'A CMS preview app enables Trusted Types in report-only mode, fixes the markdown preview path with a reviewed policy, sandboxes ad previews, restricts policy names, and then enforces CSP.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sink guard') yield* sinkGuard();
  else if (view === 'policy rollout') yield* policyRollout();
  else throw new InputError('Pick a Trusted Types view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Trusted Types is a browser security mechanism for DOM XSS. Instead of letting arbitrary strings flow into dangerous DOM sinks, a CSP directive can require typed values such as TrustedHTML. Application-defined policies create those values after sanitization, escaping, or other reviewable transformations.',
        'MDN describes require-trusted-types-for as a CSP directive that controls data passed to DOM XSS sink functions: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for. MDN Trusted Types API explains policy creation and enforcement: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'The useful data structure is a typed capability boundary. The DOM sink is the boundary. The policy registry is the capability factory. A policy converts raw data into a trusted value only through reviewed code. CSP decides whether untyped values are rejected and which policy names can exist.',
        'This complements nonce-based CSP. A nonce can prevent unauthorized script execution from network-loaded script tags. Trusted Types narrows client-side injection paths where application JavaScript accidentally writes attacker-controlled strings into executable DOM contexts.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A CMS has an article preview that converts markdown and selected HTML into preview DOM. Historically it assigned strings to innerHTML in several components. The team enables Trusted Types in report-only mode, groups violations by component, adds one cmsHTML policy around a sanitizer, and moves ad preview code into a sandboxed iframe.',
        'After violations fall, the site enforces require-trusted-types-for and restricts trusted-types policy names. New sink writes fail during development unless they go through the approved policy.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Trusted Types does not make a weak sanitizer strong. It makes unsafe sink writes visible and enforceable. The policy implementation still needs real context-aware sanitization or escaping.',
        'Do not create broad bypass policies for convenience. Too many policy names, a permissive default policy, or wrappers that just return raw input will erase the benefit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN require-trusted-types-for at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/require-trusted-types-for, MDN Trusted Types API at https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API, MDN trusted-types directive at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/trusted-types, and W3C Trusted Types at https://www.w3.org/TR/trusted-types/.',
        'Study CSP Nonce & Hash Policy, Subresource Integrity Hash Manifest, Cross-Origin Isolation, SameSite Cookies & CSRF, Capability Security & Attenuation, and DOM Event Propagation & Path next.',
      ],
    },
  ],
};
