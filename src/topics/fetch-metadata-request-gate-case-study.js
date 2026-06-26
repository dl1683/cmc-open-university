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
    explanation: 'Each header turns browser context into a policy column. Route handlers cannot infer this shape from cookies alone, so the gate records it before business logic sees the request.',
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
    explanation: 'The route map is the core data structure. It makes the policy explicit: static assets, API writes, login pages, OAuth callbacks, and webhooks each declare which request shapes are normal.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a server-side decision table. Active marks the header, route class, or policy cell currently being checked. Visited means a request shape has already been classified; found means the gate has enough evidence to allow, deny, or report before business logic runs.',
        'Fetch Metadata request headers are browser-supplied fields such as Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, and Sec-Fetch-User. The safe inference rule is route-specific: a cross-site no-cors image request can be normal for an image asset and impossible for a money-transfer API.',
        {type:"callout", text:"Fetch Metadata works when browser-supplied request context is joined to server-owned route intent before business logic runs."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A browser can send requests because of images, scripts, forms, navigations, iframes, fetch calls, and stylesheets. Cookies can ride along with those requests because the user is logged in. The server sees method, path, cookies, and headers, but it may not know what browser action caused the request.',
        'Fetch Metadata exists so the server can inspect request shape before route handlers parse bodies or touch state. Sec-Fetch-Site tells how the initiator relates to the target site, Sec-Fetch-Mode tells the fetch mode, and Sec-Fetch-Dest tells the destination such as image, script, document, or empty.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to rely on authentication, authorization, CSRF tokens, SameSite cookies, Origin checks, CORS, and per-route validation. Those defenses remain necessary because they decide identity, permission, and state-change legitimacy. They do not always reject impossible browser shapes early.',
        'CORS controls whether a cross-origin page can read a response through browser APIs. It does not mean every cross-site request is blocked from being sent. A bank transfer endpoint should not be reachable as an image load even before the CSRF token is examined.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is missing route intent at the edge. A CDN or middleware layer can see headers quickly, but it cannot know whether /login, /api/wire, /static/logo.png, and /oauth/callback should accept the same browser shapes unless the server declares route classes. Without that map, policy scatters across handlers.',
        'Scattered policy creates inconsistent behavior. One handler may reject a cross-site image-shaped POST, another may parse the body first, and a third may forget the distinction. The request has already consumed application work before the system proves that the shape was impossible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat Fetch Metadata as a route-aware request classifier. The browser contributes context columns; the server contributes route intent. The gate compares them and returns allow, deny, report-only, or compatibility fallback.',
        'The data structure is a policy matrix. Rows are route classes such as static asset, document navigation, read API, write API, login, OAuth callback, webhook, and internal service. Columns are predicates over site, mode, destination, user activation, method, content type, and allowlists.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Middleware runs before route handlers. It reads Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, Sec-Fetch-User, method, URL, and any deployment-specific allowlist. It maps the URL to a route class and checks whether the observed shape is allowed for that class.',
        'For a write API, the policy might allow same-origin fetch-shaped requests and deny cross-site no-cors image, script, iframe, and style loads. For a login route, a top-level navigation from another site may be normal. For webhooks, missing browser headers may be expected, so signature verification should own that route.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is narrow: deny only shapes that the route has declared impossible or unsafe. A cross-site image request to a write endpoint is rejected because no legitimate browser flow for that endpoint should have destination image and mode no-cors. An image request to a public image route can still pass.',
        'The browser knows how the request was initiated, and the server knows what the route is for. Neither side has the full policy alone. Allowed requests still continue to CSRF, authorization, business validation, and server-side permission checks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is small: a few header reads, one route-class lookup, and one matrix decision. The behavioral cost is maintenance. New routes, old browsers, native clients, OAuth redirects, monitoring systems, and webhooks need explicit policy rather than accidental denial.',
        'Rollout cost is why report-only mode matters. If 1,000,000 requests per day hit a site and 0.2 percent lack expected headers, that is 2,000 requests to inspect before enforcement. Logging route class, header values, decision, user agent family, and sample id makes false positives visible before users are blocked.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Fetch Metadata fits reverse proxies, CDNs, API gateways, edge middleware, and application middleware. It is strongest for browser-facing endpoints where a route has a clear normal shape. Sensitive write APIs, private JSON endpoints, and leak-prone routes are good candidates.',
        'It also documents boundary intent. A policy table tells security reviewers which routes expect navigations, which expect subresources, and which expect API fetches. That is easier to audit than route handlers that each invent their own header logic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fetch Metadata is not an identity system. Same-origin requests can still be malicious after XSS, and same-site requests can still carry unsafe intent. A request with the right shape still needs CSRF checks, authorization, and business rules.',
        'It also does not cover every legitimate client. Command-line tools, native apps, monitoring systems, and webhook providers may omit these browser headers. Routes that serve those clients need explicit compatibility rules and should not inherit browser-only policy by accident.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider POST /wire in a banking app. The route class is write API, and the policy allows same-origin fetch-shaped requests with CSRF checks. An attacker embeds an image pointing at /wire from another site, so the browser sends Sec-Fetch-Site: cross-site, Sec-Fetch-Mode: no-cors, and Sec-Fetch-Dest: image.',
        'The gate does one route lookup and sees that image plus no-cors is impossible for money movement. It returns deny before the transfer handler reads the body. The same site can still allow GET /login with mode navigate and destination document because that route has a different normal shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: W3C Fetch Metadata at https://www.w3.org/TR/fetch-metadata/, MDN Sec-Fetch-Site at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site, MDN Sec-Fetch-Mode at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode, MDN Sec-Fetch-Dest at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest, and web.dev deployment guidance at https://web.dev/articles/fetch-metadata.',
        'Study next by boundary. For state-changing browser requests, read SameSite Cookies and CSRF. For response-reading permissions, read CORS Preflight Cache. For provenance checks, read Origin and Referer Validation. For same-origin script compromise, read Trusted Types DOM XSS Sink Guard.',
      ],
    },
  ],
};