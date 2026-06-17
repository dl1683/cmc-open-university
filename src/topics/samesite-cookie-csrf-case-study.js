// SameSite cookies and CSRF: cookie attachment policy, site computation,
// top-level navigation, unsafe methods, double-submit tokens, and origin checks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'samesite-cookie-csrf-case-study',
  title: 'SameSite Cookies & CSRF',
  category: 'Security',
  summary: 'How SameSite cookie policy, Secure, HttpOnly, top-level navigation rules, unsafe methods, CSRF tokens, Origin checks, and session design fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cookie attach', 'csrf defense'], defaultValue: 'cookie attach' },
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

function cookieGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 4.1, note: notes.user ?? 'browser' },
      { id: 'siteA', label: 'site A', x: 2.3, y: 2.7, note: notes.siteA ?? 'bank' },
      { id: 'siteB', label: 'site B', x: 2.3, y: 5.5, note: notes.siteB ?? 'evil' },
      { id: 'cookie', label: 'cookie', x: 4.2, y: 4.1, note: notes.cookie ?? 'session' },
      { id: 'policy', label: 'policy', x: 6.0, y: 4.1, note: notes.policy ?? 'SameSite' },
      { id: 'request', label: 'request', x: 7.8, y: 4.1, note: notes.request ?? 'POST?' },
      { id: 'server', label: 'server', x: 9.4, y: 4.1, note: notes.server ?? 'accept?' },
    ],
    edges: [
      { id: 'e-user-siteA', from: 'user', to: 'siteA', weight: '' },
      { id: 'e-user-siteB', from: 'user', to: 'siteB', weight: '' },
      { id: 'e-siteA-cookie', from: 'siteA', to: 'cookie', weight: 'set' },
      { id: 'e-siteB-request', from: 'siteB', to: 'request', weight: 'submit' },
      { id: 'e-cookie-policy', from: 'cookie', to: 'policy', weight: '' },
      { id: 'e-policy-request', from: 'policy', to: 'request', weight: 'attach?' },
      { id: 'e-request-server', from: 'request', to: 'server', weight: '' },
    ],
  }, { title });
}

function* cookieAttach() {
  yield {
    state: cookieGraph('A cookie is ambient authority attached by the browser'),
    highlight: { active: ['siteA', 'cookie', 'e-siteA-cookie'], compare: ['siteB'] },
    explanation: 'A session cookie is ambient authority: once set for a site, the browser may attach it to later matching requests automatically. CSRF abuses that automatic attachment from another site.',
    invariant: 'CSRF is about who can cause the browser to send credentials, not who can read the response.',
  };

  yield {
    state: labelMatrix(
      'SameSite modes',
      [
        { id: 'strict', label: 'Strict' },
        { id: 'lax', label: 'Lax' },
        { id: 'none', label: 'None' },
        { id: 'unset', label: 'default' },
      ],
      [
        { id: 'cross', label: 'cross-site' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['no', 'sensitive'],
        ['top GET', 'sessions'],
        ['yes+Secure', 'embeds'],
        ['Lax-ish', 'legacy risk'],
      ],
    ),
    highlight: { active: ['strict:cross', 'lax:cross', 'none:cross'], compare: ['unset:fit'] },
    explanation: 'SameSite controls when a cookie is sent with cross-site requests. Strict is tightest. Lax permits some top-level safe navigations. None allows cross-site use but requires Secure in modern browsers.',
  };

  yield {
    state: cookieGraph('A cross-site POST is blocked from carrying Lax/Strict cookies', { siteB: 'attacker', cookie: 'SameSite=Lax', request: 'POST /pay', server: 'no cookie' }),
    highlight: { active: ['siteB', 'policy', 'request'], removed: ['cookie', 'server'] },
    explanation: 'A forged form POST from another site can still be sent, but SameSite=Lax or Strict can prevent the browser from attaching the session cookie. Without the cookie, the request lacks the user session.',
  };

  yield {
    state: cookieGraph('SameSite=None is necessary for some embeds and federated flows', { cookie: 'None; Secure', policy: 'cross-site ok', request: 'iframe/API', server: 'needs more checks' }),
    highlight: { active: ['cookie', 'policy', 'request', 'server', 'e-policy-request'], compare: ['siteB'] },
    explanation: 'Some products intentionally need cross-site cookies: embedded apps, SSO, payment frames, or legacy widgets. SameSite=None should be paired with Secure and explicit CSRF defenses.',
  };

  yield {
    state: labelMatrix(
      'Cookie flags',
      [
        { id: 'http', label: 'HttpOnly' },
        { id: 'secure', label: 'Secure' },
        { id: 'host', label: '__Host-' },
        { id: 'path', label: 'Path' },
      ],
      [
        { id: 'guards', label: 'guards' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['JS read', 'CSRF'],
        ['plain HTTP', 'XSS use'],
        ['domain swap', 'CSRF'],
        ['URL match', 'authz'],
      ],
    ),
    highlight: { found: ['http:guards', 'secure:guards', 'host:guards'], compare: ['http:misses'] },
    explanation: 'Cookie flags are complementary. HttpOnly helps against token theft by JavaScript. Secure requires HTTPS. Prefixes reduce scope mistakes. None of those alone proves user intent for a write.',
  };
}

function* csrfDefense() {
  yield {
    state: cookieGraph('A CSRF attack sends a valid-looking request with ambient cookies', { siteB: 'evil form', cookie: 'session?', request: 'POST /transfer', server: 'danger' }),
    highlight: { active: ['siteB', 'request', 'server'], compare: ['cookie'] },
    explanation: 'The server sees a state-changing request. If it trusts only the session cookie, it may not know that the user never intended this action.',
    invariant: 'State-changing requests need intent checks beyond ambient cookies.',
  };

  yield {
    state: labelMatrix(
      'Defense layers',
      [
        { id: 'samesite', label: 'SameSite' },
        { id: 'token', label: 'CSRF token' },
        { id: 'origin', label: 'Origin' },
        { id: 'method', label: 'method' },
        { id: 'reauth', label: 'step-up' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'failure' },
      ],
      [
        ['attach rule', 'embed None'],
        ['secret intent', 'XSS can read'],
        ['site source', 'missing hdr'],
        ['unsafe only', 'GET writes'],
        ['high risk', 'friction'],
      ],
    ),
    highlight: { active: ['samesite:checks', 'token:checks', 'origin:checks'], compare: ['reauth:failure'] },
    explanation: 'A robust design layers controls: SameSite where possible, CSRF tokens for unsafe actions, Origin or Referer validation, no state change on GET, and step-up for high-risk operations.',
  };

  yield {
    state: cookieGraph('Double-submit token binds a request body/header to the cookie session', { siteA: 'real form', cookie: 'csrf cookie', request: 'token matches', server: 'accept' }),
    highlight: { active: ['siteA', 'cookie', 'request', 'server', 'e-policy-request', 'e-request-server'], removed: ['siteB'] },
    explanation: 'A synchronizer token or signed double-submit token forces the attacker to know a value they cannot normally read cross-site. The server checks token and session together before accepting the write.',
  };

  yield {
    state: cookieGraph('The complete case study is a money transfer form', { siteA: 'bank form', siteB: 'evil page', cookie: 'Lax+HttpOnly', request: 'POST+token', server: 'verify' }),
    highlight: { found: ['siteA', 'cookie', 'request', 'server'], removed: ['siteB'] },
    explanation: 'For a transfer form, the bank uses SameSite=Lax or Strict for the session, a CSRF token in the form, Origin validation on POST, and step-up authentication for large transfers.',
  };

  yield {
    state: labelMatrix(
      'Do not rely on',
      [
        { id: 'cors', label: 'CORS' },
        { id: 'json', label: 'JSON only' },
        { id: 'secret', label: 'hidden URL' },
        { id: 'captcha', label: 'captcha' },
      ],
      [
        { id: 'why', label: 'why weak' },
        { id: 'better' },
      ],
      [
        ['read gate', 'token'],
        ['forms vary', 'token+origin'],
        ['discoverable', 'authz'],
        ['not intent', 'step-up'],
      ],
    ),
    highlight: { removed: ['cors:why', 'secret:why'], found: ['json:better', 'captcha:better'] },
    explanation: 'CORS is not a CSRF defense because CSRF does not need to read the response. Hidden URLs and content-type assumptions are brittle. Intent needs explicit server-side validation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cookie attach') yield* cookieAttach();
  else if (view === 'csrf defense') yield* csrfDefense();
  else throw new InputError('Pick a SameSite/CSRF view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        "Cookies are ambient authority. Once a browser has a session cookie, it may attach that cookie to matching requests without asking whether the user intended the action.",
        "CSRF abuses that automatic attachment. An attacker page cannot usually read the bank response, but it may still cause the victim browser to send `POST /transfer` with the victim's cookie attached. SameSite exists because the browser can classify request context before the server sees the request.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The first defense many people expect is response secrecy: the attacker cannot read the account page, so the account must be safe. That misses the attack shape. CSRF is about making the browser send a write request, not about reading the result.",
        "The second baseline is CORS. CORS controls cross-origin response access and some request shapes. It does not stop a plain cross-site form submission from reaching the server with cookies if the browser decides those cookies are allowed.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The exact wall is that a valid session cookie proves who is logged in, not who chose the action. A server that accepts every authenticated state-changing request has no signal separating the real transfer form from an attacker-controlled hidden form.",
        "Method discipline matters too. If a GET request changes state, an attacker can trigger it with a link, image, script, redirect, or navigation. If POST changes state but has no intent check, an attacker can still submit a form.",
      ],
    },
    {
      heading: 'Core model',
      paragraphs: [
        "SameSite is a cookie sending rule. The browser compares the site that set the cookie with the site that initiated the request, then decides whether the cookie may ride along.",
        "`Strict` sends the cookie only in same-site contexts. `Lax` allows same-site requests and limited cross-site top-level navigations with safe methods. `None` allows cross-site sending and must be paired with `Secure`. `HttpOnly`, `Secure`, and `__Host-` scope rules solve different cookie problems; they do not prove user intent by themselves.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "On each request, the browser evaluates cookie domain, path, scheme, Secure, and SameSite. A forged cross-site POST to a site whose session cookie is `SameSite=Lax` or `Strict` should not receive that session cookie in the ordinary case, so the request reaches the server without ambient login authority.",
        "The server still has work to do. Unsafe routes should require a CSRF token or equivalent intent proof, reject unexpected Origin or Fetch Metadata values where possible, avoid state changes on GET, and require step-up authentication for high-risk actions.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The invariant is that a state-changing request needs more than ambient cookies. SameSite removes cookies from many cross-site requests before application code runs. A token adds an unpredictable value that the attacker cannot normally read from another site. Origin and Fetch Metadata checks add request-context evidence.",
        "Layering works because the failures differ. SameSite can be loosened for embeds and federation. Tokens can be exposed by XSS. Origin checks can be missing or misconfigured. Each layer should make a different false assumption expensive.",
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        "The cost of `Strict` is usability. Users who arrive from another site may appear logged out because the cookie is withheld. The cost of `Lax` is weaker protection for safe top-level navigations, so GET must stay read-only.",
        "The cost of `None` is explicit risk. Embedded apps, SSO callbacks, payment frames, and third-party widgets sometimes need cross-site cookies. Those routes need tighter server-side checks because the browser is allowed to send the session.",
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        "SameSite wins for ordinary session-backed web apps where important writes originate from pages on the same site. It is cheap, browser-enforced, and effective before a forged request reaches controller code.",
        "It fails as a complete strategy for SSO, embedded widgets, cross-site APIs, and applications with serious XSS risk. It also fails when developers leave sensitive cookies unset and depend on shifting browser defaults instead of declaring the policy they need.",
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        "SameSite is not an authorization system. It changes whether cookies attach in many cross-site situations, but it does not decide whether a transfer, password change, or admin action is allowed. The server still needs route-level authorization and intent checks.",
        "It also does not solve XSS. If an attacker can run script on the target site, that script may read non-HttpOnly tokens, submit legitimate forms, or act from a same-site context. SameSite reduces one cross-site request shape; it should sit beside XSS prevention, output encoding, CSP, and token design.",
      ],
    },
    {
      heading: 'Concrete failures',
      paragraphs: [
        "A bank that allows `GET /transfer?to=attacker&amount=1000` has no CSRF defense, even with `SameSite=Lax`, because top-level safe-method navigation can still carry cookies. A JSON endpoint with cookies but no token can be attacked if it also accepts simple request shapes or method overrides.",
        "A site that sets `SameSite=None; Secure` for an embedded flow and then reuses the same cookie for account settings has expanded the attack surface. A site with XSS can lose CSRF protection because the injected script can read or submit the same tokens the legitimate page uses.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Imagine `bank.example` sets `session=abc; SameSite=Lax; Secure; HttpOnly`. A victim visits `evil.example`, which auto-submits a hidden POST form to `https://bank.example/transfer`. In the ordinary case, the browser classifies that as a cross-site unsafe request and withholds the Lax session cookie, so the bank receives no authenticated session.",
        "Now change the route to `GET /transfer?to=evil&amount=1000`. Lax cookies may attach on top-level safe-method navigations, so the design is broken even though the cookie attribute looks reasonable. The real fix is method discipline plus server-side intent checks, not treating SameSite as a magic shield.",
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        "Declare SameSite explicitly on every sensitive cookie. Keep state-changing routes off GET. Require CSRF tokens or equivalent proof for unsafe methods. Validate Origin or Fetch Metadata where the browser supplies reliable values. Separate cookies used for embedded or federated flows from cookies used for account settings.",
        "Test with real browser flows: direct navigation, cross-site form POST, SSO callback, iframe embed, payment redirect, mobile webview, and logout. Cookie security is easy to reason about incorrectly because one route may need cross-site behavior while another route should reject it completely.",
      ],
    },
    {
      heading: 'How to choose settings',
      paragraphs: [
        "`Strict` is appropriate for highly sensitive cookies where cross-site entry should not preserve login state. `Lax` is a strong default for normal session cookies because it preserves common navigation while blocking many forged unsafe requests. `None` should be reserved for flows that genuinely need cross-site cookies and should always be paired with `Secure`.",
        "Do not use one cookie policy for every route if the product has mixed needs. Embedded flows, SSO callbacks, account settings, admin actions, and payment redirects may need different cookies or additional state parameters. The safer design is to separate privileges so the cookie that must travel cross-site is not also the cookie that authorizes the most sensitive write.",
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        "Use SameSite to reduce ambient cookie attachment, not to replace application checks. The server should still ask whether the request method is safe, whether the route changes state, whether an intent token is present, and whether the browser context matches the expected flow.",
        "The safest systems make the dangerous path boring: sensitive writes use unsafe methods, require intent proof, reject surprising origins, and use cookies whose cross-site behavior is no broader than that route actually needs.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources: MDN Set-Cookie and SameSite at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie, MDN CSRF at https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF, and the OWASP CSRF Prevention Cheat Sheet at https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html.",
        "Study CORS Preflight Cache to separate response-reading permission from cookie attachment, Fetch Metadata Request Gate for server-side request classification, Storage Access API Third-Party Cookie Gate for embedded sessions, Content Security Policy for XSS reduction, and OAuth PKCE Token Lifecycle Case Study for redirect-state binding.",
      ],
    },
  ],
};
