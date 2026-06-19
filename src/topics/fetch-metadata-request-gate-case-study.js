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
        "Read the animation as the execution trace for Fetch Metadata Request Gate. How Sec-Fetch-Site, Mode, Dest, User, route classes, allowlists, CSRF defense, logging, and browser request context produce a server-side gate..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Browsers send many requests automatically. An image tag, script tag, form post, iframe, navigation, fetch call, or stylesheet load can all reach a server. Cookies may be attached because the user is logged in. The server receives a method, path, cookies, and headers, but without extra context it may not know what kind of browser action produced the request.`,
        `Fetch Metadata exists to give the server that missing shape. Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest, and Sec-Fetch-User let a server classify browser requests before route handlers parse bodies, touch session state, or run expensive application code.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The normal defenses are still necessary: authentication, authorization, CSRF tokens, SameSite cookies, Origin checks, CORS, and route-level validation. Those checks decide who the user is, what they may do, and whether a state-changing request is legitimate.`,
        `The problem is timing and scope. CORS mainly controls what a cross-origin page can read, not whether every cross-site request can be sent. CSRF tokens protect explicit state changes, but they do not tell the edge that a bank transfer endpoint is being requested as an image. Route handlers can reject bad requests, but by then the request has already reached application code.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A banking write endpoint should never be loaded as a cross-site image. A JSON API should not be reached through a script tag. A login page may allow a top-level navigation. An OAuth callback may allow a redirect shape. A webhook may be a legitimate non-browser request with no Fetch Metadata headers at all.`,
        `If every handler rediscovers those facts independently, policy becomes scattered and inconsistent. The edge or middleware cannot reject obvious abuse early because it does not have a route-class map. The exact wall is missing request shape plus missing route intent.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Treat Fetch Metadata as a route-aware request classifier. The browser supplies context columns. The server owns a route-class matrix. The gate compares the observed shape with the declared normal shape for that route and returns allow, deny, report-only, or compatibility fallback.`,
        `The data structure is a policy table. Rows are route classes: static asset, document navigation, read API, write API, login, OAuth callback, webhook, internal service. Columns are predicates over site, mode, destination, user activation, method, content type, and allowlists. The table is useful because it makes the normal shape of each route explicit.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The request-headers view shows what the browser contributes. Sec-Fetch-Site says how the request initiator relates to the target site. Sec-Fetch-Mode says the fetch mode, such as navigate, cors, no-cors, or same-origin. Sec-Fetch-Dest says the destination, such as document, image, script, style, or empty. Sec-Fetch-User can mark a user-activated top-level navigation.`,
        `The resource-gate view shows what the server contributes. The server maps a path to a route class, applies the class policy, keeps CSRF and authorization checks for allowed shapes, and logs decisions. The main lesson is that browser context and server intent have to meet before business logic runs.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `A middleware layer runs before route handlers. It reads the Sec-Fetch headers, method, URL, and any deployment-specific allowlist. It maps the URL to a route class. Then it checks whether the observed site, mode, destination, and user-activation shape is allowed for that class.`,
        `For a write API, the policy might allow same-origin or same-site CORS/fetch-shaped requests and deny cross-site no-cors image, script, iframe, and style loads. For static assets, the policy might allow no-cors image and style loads. For login, it might allow top-level document navigations. For webhooks, it might bypass browser-shape checks and use signature verification instead.`,
        `The gate should usually have report-only mode. In report-only mode it logs what would have been denied: route class, header values, decision, user agent family, client type, and sample request ID. After false positives are understood, enforcement can begin on high-confidence classes such as authenticated write APIs.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider POST /wire in a banking app. A legitimate browser flow is a same-origin or same-site request from the bank's UI, with a CSRF token, Origin check, authenticated session, and business authorization. A cross-site image load to that same path has the wrong shape before the application even reads the body.`,
        `The Fetch Metadata gate maps /wire to write API. It sees Sec-Fetch-Site: cross-site, Sec-Fetch-Mode: no-cors, and Sec-Fetch-Dest: image. The route class says that shape is impossible for a legitimate money movement action. The gate denies the request and logs the sample. It does not need to parse a transfer form to know the browser context is wrong.`,
        `Now consider /login. A top-level navigation from outside the site may be normal. The policy for login can allow navigate plus document, then let the login route handle the rest. The point is not default paranoia against all cross-site traffic. The point is route-specific normality.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The safety invariant is narrow: deny only shapes that the route has declared impossible or unsafe. A cross-site image request to a write endpoint is rejected because no legitimate browser flow for that route should have destination image and mode no-cors.`,
        `The correctness comes from combining browser-provided context with server-owned route intent. The browser can describe how the request was initiated. The server knows what each route is for. Neither side alone has the full policy.`,
        `Allowed shapes still continue to normal security checks. Fetch Metadata is defense in depth. Authentication, authorization, CSRF tokens, SameSite cookies, Origin checks, webhook signatures, and business rules remain the authority for whether the action may happen.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The runtime cost is small: a few header reads, one route-class lookup, and a policy decision. The operational cost is larger. Missing headers, old browsers, native clients, API clients, test clients, redirects, cached paths, health checks, and webhook integrations all need compatibility rules.`,
        `The policy table also has maintenance cost. Routes move. New endpoints appear. Product teams add OAuth callbacks, embedded widgets, export URLs, and third-party integrations. If route ownership is weak, the matrix drifts and either blocks real traffic or allows shapes that should have been denied.`,
        `The rollout cost is why strong deployments start with logging. Report-only mode finds false positives, unclassified routes, clients that do not send modern browser headers, and policies that are too broad. Enforcement should begin with high-confidence classes, then expand when the deny logs become predictable.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Fetch Metadata wins at boundaries that already know route classes: reverse proxies, CDNs, API gateways, edge middleware, and application middleware. It is especially useful for sensitive browser-facing endpoints where cross-site subresource loads are never legitimate.`,
        `It helps reduce CSRF exposure because obviously wrong cross-site shapes can be rejected before route handlers run. It also helps with cross-site leak reduction. If an endpoint would do expensive or revealing work for an impossible request shape, the gate can reject early before the application creates timing, size, or status-code evidence.`,
        `It is also useful as documentation. A good policy table says what traffic each route class expects. That helps security review, incident response, and onboarding because the normal browser shape is written down instead of implied by scattered handler code.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `Fetch Metadata is the wrong tool for deciding identity, permission, or user intent by itself. Same-origin requests can be malicious after XSS. Same-site requests can still be unsafe. A browser request with the right shape may still lack a valid CSRF token or business permission.`,
        `It also does not cover every client. Non-browser clients may omit the headers for legitimate reasons. Old browsers, native apps, command-line clients, monitoring systems, and webhooks may not fit a browser-shaped policy. Those routes need explicit handling, not accidental denial.`,
        `The gate fails when route classes are vague. If every endpoint is treated as generic web traffic, the matrix cannot distinguish a static image, an OAuth callback, a JSON write, and a webhook. The value comes from precise route ownership and conservative enforcement.`,
      ],
    },
    {
      heading: 'Where it fails (3)',
      paragraphs: [
        `One misconception is that Fetch Metadata replaces CSRF tokens. It does not. It can reject impossible cross-site shapes early, but allowed browser writes should still use CSRF defenses and authorization checks.`,
        `Another misconception is that missing headers mean attack. Missing headers often mean compatibility traffic. A good policy distinguishes routes that require browser context from routes that are intentionally called by non-browser clients.`,
        `A third misconception is that CORS already solves this. CORS decides whether another origin may read a response through browser APIs. It does not stop all cross-site requests from being sent, and it does not express that a write API should never be loaded as an image.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: W3C Fetch Metadata at https://www.w3.org/TR/fetch-metadata/, MDN Sec-Fetch-Site at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site, MDN Sec-Fetch-Mode at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode, MDN Sec-Fetch-Dest at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest, and web.dev Fetch Metadata deployment guidance at https://web.dev/articles/fetch-metadata.`,
        `Study next: SameSite Cookies & CSRF for write protection, CORS Preflight Cache for read-permission boundaries, Origin and Referer Validation for browser provenance checks, Storage Access API Third-Party Cookie Gate for browser storage policy, Trusted Types DOM XSS Sink Guard for same-origin script compromise, and Cross-Origin Isolation for broader browser isolation.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Fetch Metadata Request Gate moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

