// Fetch Metadata: use Sec-Fetch-* request headers as a server-side request
// classification layer for CSRF, XS-leaks, resource abuse, and route policy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fetch-metadata-request-gate-case-study',
  title: 'Fetch Metadata Request Gate',
  category: 'Security',
  summary: 'How Sec-Fetch-Site, Mode, Dest, User, route classes, allowlists, CSRF defense, logging, and browser request context produce a server-side gate.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['request headers', 'resource gate'], defaultValue: 'request headers' },
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

function metadataGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'browser', label: 'UA', x: 0.5, y: 4.2, note: notes.browser ?? 'adds ctx' },
      { id: 'site', label: 'Site', x: 3.0, y: 5.5, note: notes.site ?? 'cross-site' },
      { id: 'mode', label: 'Mode', x: 3.0, y: 4.2, note: notes.mode ?? 'navigate' },
      { id: 'dest', label: 'Dest', x: 3.0, y: 2.9, note: notes.dest ?? 'document' },
      { id: 'route', label: 'route', x: 5.0, y: 4.2, note: notes.route ?? '/transfer' },
      { id: 'policy', label: 'policy', x: 6.7, y: 4.2, note: notes.policy ?? 'rules' },
      { id: 'csrf', label: 'CSRF', x: 8.1, y: 5.4, note: notes.csrf ?? 'token' },
      { id: 'log', label: 'log', x: 8.1, y: 3.0, note: notes.log ?? 'audit' },
      { id: 'decision', label: 'decision', x: 9.6, y: 4.2, note: notes.decision ?? 'allow/deny' },
    ],
    edges: [
      { id: 'e-browser-site', from: 'browser', to: 'site', weight: '' },
      { id: 'e-browser-mode', from: 'browser', to: 'mode', weight: '' },
      { id: 'e-browser-dest', from: 'browser', to: 'dest', weight: '' },
      { id: 'e-site-route', from: 'site', to: 'route', weight: '' },
      { id: 'e-mode-route', from: 'mode', to: 'route', weight: '' },
      { id: 'e-dest-route', from: 'dest', to: 'route', weight: '' },
      { id: 'e-route-policy', from: 'route', to: 'policy', weight: '' },
      { id: 'e-policy-csrf', from: 'policy', to: 'csrf', weight: '' },
      { id: 'e-policy-log', from: 'policy', to: 'log', weight: '' },
      { id: 'e-policy-decision', from: 'policy', to: 'decision', weight: '' },
    ],
  }, { title });
}

function* requestHeaders() {
  yield {
    state: metadataGraph('The browser sends request context as Sec-Fetch headers'),
    highlight: { active: ['browser', 'site', 'mode', 'dest', 'e-browser-site', 'e-browser-mode', 'e-browser-dest'], compare: ['policy'] },
    explanation: 'Fetch Metadata request headers tell the server what kind of browser context produced the request. They are not user identity; they are request-shape evidence.',
    invariant: 'Request context should influence route policy before business logic runs.',
  };

  yield {
    state: labelMatrix(
      'Header roles',
      [
        { id: 'site', label: 'Site' },
        { id: 'mode', label: 'Mode' },
        { id: 'dest', label: 'Dest' },
        { id: 'user', label: 'User' },
      ],
      [
        { id: 'asks' },
        { id: 'example' },
      ],
      [
        ['who started', 'cross-site'],
        ['how loaded', 'navigate'],
        ['target use', 'image'],
        ['user click', '?1'],
      ],
    ),
    highlight: { active: ['site:asks', 'mode:asks', 'dest:asks'], compare: ['user:example'] },
    explanation: 'Sec-Fetch-Site answers the initiator relationship. Sec-Fetch-Mode answers the request mode. Sec-Fetch-Dest answers the destination. Sec-Fetch-User marks user-activated navigations.',
  };

  yield {
    state: metadataGraph('A cross-site image request should not hit a JSON API', { site: 'cross-site', mode: 'no-cors', dest: 'image', route: '/api/pay', decision: 'deny' }),
    highlight: { active: ['site', 'mode', 'dest', 'route', 'policy', 'decision'], removed: ['csrf'] },
    explanation: 'A policy can reject suspicious combinations before handlers run. A cross-site no-cors image load to an account API is not a normal API call.',
  };

  yield {
    state: metadataGraph('A top-level navigation can be treated differently', { site: 'none', mode: 'navigate', dest: 'document', route: '/login', decision: 'allow' }),
    highlight: { active: ['site', 'mode', 'dest', 'route', 'policy', 'decision'], compare: ['csrf'] },
    explanation: 'Top-level navigations, same-origin API calls, webhook endpoints, OAuth redirects, and static assets often need different policies. The gate is route-aware.',
  };

  yield {
    state: metadataGraph('The complete request classifier feeds audit logs', { route: 'route class', log: 'sample', decision: 'policy' }),
    highlight: { active: ['browser', 'route', 'policy', 'log', 'decision', 'e-route-policy', 'e-policy-log'], found: ['site', 'mode', 'dest'] },
    explanation: 'A production rollout usually logs decisions first, then denies high-confidence bad shapes, then expands route coverage as false positives are understood.',
  };
}

function* resourceGate() {
  yield {
    state: metadataGraph('Begin with a default deny idea for unsafe cross-site shapes', { site: 'cross-site', mode: 'cors?', dest: 'empty', decision: 'review' }),
    highlight: { active: ['site', 'mode', 'dest', 'policy'], compare: ['decision'] },
    explanation: 'Fetch Metadata is most useful as an early request gate. It can reduce CSRF and cross-site probing before route handlers parse bodies or touch session state.',
    invariant: 'The gate is defense in depth, not a replacement for authentication or CSRF tokens.',
  };

  yield {
    state: labelMatrix(
      'Route policy',
      [
        { id: 'api', label: 'API' },
        { id: 'asset', label: 'asset' },
        { id: 'login', label: 'login' },
        { id: 'hook', label: 'webhook' },
        { id: 'oauth', label: 'OAuth' },
      ],
      [
        { id: 'allow' },
        { id: 'block' },
      ],
      [
        ['same-site', 'cross img'],
        ['no-cors ok', 'secret'],
        ['navigate', 'embed'],
        ['allowlist', 'browser'],
        ['redirect', 'bad state'],
      ],
    ),
    highlight: { active: ['api:allow', 'asset:allow', 'login:allow'], compare: ['api:block', 'oauth:block'] },
    explanation: 'The route map is the core data structure. Static assets, API writes, login pages, OAuth callbacks, and webhooks need different allowed request shapes.',
  };

  yield {
    state: metadataGraph('CSRF token checks still matter for state changes', { site: 'same-site', route: 'POST write', csrf: 'verify', decision: 'allow' }),
    highlight: { active: ['route', 'policy', 'csrf', 'decision', 'e-policy-csrf'], compare: ['site'] },
    explanation: 'Fetch Metadata can reject obviously cross-site abuse, but a same-site or same-origin shape may still need CSRF tokens, SameSite cookies, Origin checks, and business authorization.',
  };

  yield {
    state: metadataGraph('Missing headers need compatibility handling', { browser: 'legacy?', site: 'missing', mode: 'missing', dest: 'missing', decision: 'soft' }),
    highlight: { active: ['browser', 'site', 'mode', 'dest', 'log'], compare: ['decision'] },
    explanation: 'Not every client is a modern browser. APIs, native apps, webhooks, old browsers, and tests may lack Sec-Fetch headers. The policy should know which routes require browser context.',
  };

  yield {
    state: metadataGraph('The complete case study is a banking write gate', { route: 'POST /wire', csrf: 'token+origin', log: 'deny sample', decision: 'deny bad' }),
    highlight: { active: ['browser', 'site', 'mode', 'dest', 'route', 'policy', 'csrf', 'log', 'decision'], found: ['e-policy-decision'] },
    explanation: 'A bank denies cross-site no-cors and image/script-shaped requests to write endpoints, requires CSRF token and Origin checks for allowed browser writes, and logs denials by route class before broad enforcement.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'request headers') yield* requestHeaders();
  else if (view === 'resource gate') yield* resourceGate();
  else throw new InputError('Pick a Fetch Metadata view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Fetch Metadata request headers are browser-supplied context headers such as Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, and Sec-Fetch-User. They let servers classify how a request was initiated before serving it.',
        'The W3C Fetch Metadata specification says these headers give servers enough information to make early decisions about whether to service a request based on how it was made and the context in which it will be used: https://www.w3.org/TR/fetch-metadata/. MDN documents Sec-Fetch-Site at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site and Sec-Fetch-Mode at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'Treat Fetch Metadata as a route-aware classifier. The browser provides request context. The server maps routes into classes. The policy compares context against route class and produces allow, deny, log-only, or fallback behavior.',
        'This is not authentication. It is a request-shape filter that catches classes of cross-site abuse, cross-site leaks, and accidental exposure. It belongs before handler logic and alongside SameSite, CSRF tokens, Origin checks, CORS, and normal authorization.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A banking app adds middleware for write endpoints. Same-origin and same-site browser writes continue to handler-level CSRF token checks. Cross-site image, script, or no-cors loads to write endpoints are denied. Login and OAuth callback routes have explicit navigation allowances. Webhooks bypass browser-only rules through an allowlisted authentication path.',
        'The team ships report-only logging first, groups denials by route class, fixes false positives, and then enforces strict policy for money movement routes before broadening coverage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat missing Sec-Fetch headers as proof of attack everywhere. Non-browser clients and legacy environments may not send them. Route class and client type matter.',
        'Do not remove CSRF tokens or authorization checks. Fetch Metadata gives useful context, but a same-origin request can still be unauthorized and a same-site request can still be malicious.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Fetch Metadata at https://www.w3.org/TR/fetch-metadata/, MDN Sec-Fetch-Site at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site, MDN Sec-Fetch-Mode at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode, MDN Sec-Fetch-Dest at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest, and web.dev Fetch Metadata deployment guidance at https://web.dev/articles/fetch-metadata.',
        'Study SameSite Cookies & CSRF, CORS Preflight Cache, Storage Access API Third-Party Cookie Gate, Trusted Types DOM XSS Sink Guard, and Cross-Origin Isolation next.',
      ],
    },
  ],
};
