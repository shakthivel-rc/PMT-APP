import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  api,
  ApiError,
  clearTokens,
  DEFAULT_TIMEOUT_MS,
  getAccessToken,
  getRefreshToken,
  setTokens,
  setUnauthorizedHandler,
} from '@/api/client';

// The client is the single network chokepoint (auth header, envelope parsing,
// 401→refresh→retry→logout). We drive it by stubbing global fetch so request
// sequencing is exact.
const envelope = (data: unknown, message = 'ok') => ({
  status: 'success',
  status_code: 200,
  message,
  data,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  clearTokens();
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request headers & body', () => {
  it('attaches the bearer token when one is stored', async () => {
    setTokens('access-1', 'refresh-1');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(envelope({ ok: true })));

    const res = await api.get<{ ok: boolean }>('/foo');

    expect(res.data).toEqual({ ok: true });
    const init = fetchMock.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  // Every body-carrying verb, not only the ones a screen calls today: no feature in this base
  // sends a PATCH, so this is the only thing that would notice the helper breaking.
  it.each([
    ['POST', api.post],
    ['PUT', api.put],
    ['PATCH', api.patch],
  ] as const)('sends JSON content-type and a serialized body for %s', async (method, send) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(envelope({})));

    await send('/foo', { a: 1 });

    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe(method);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });
});

describe('error handling', () => {
  it('throws ApiError carrying status + server message on a non-401 failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'Boom' }, 500));

    await expect(api.get('/foo')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Boom',
    });
  });

  it("carries the error envelope's `data` through, not only its message", async () => {
    // An endpoint can put the *actionable* half of a refusal in `data` — a 422 naming the
    // offending fields, say. Dropping it here would leave a form with "Validation failed"
    // and nothing to act on.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          message: 'Validation failed',
          data: { errors: [{ field: 'email', message: 'Enter a valid email' }] },
        },
        422,
      ),
    );

    await expect(api.get('/foo')).rejects.toMatchObject({
      status: 422,
      message: 'Validation failed',
      data: { errors: [{ field: 'email', message: 'Enter a valid email' }] },
    });
  });

  it('reports `data` as null when the error body has none', async () => {
    // `undefined` would make `err.data` indistinguishable from a non-ApiError, and every
    // consumer narrows on it.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'Boom' }, 500));

    await expect(api.get('/foo')).rejects.toMatchObject({ status: 500, data: null });
  });
});

describe('401 handling', () => {
  it('refreshes the token and transparently retries the original request', async () => {
    setTokens('stale-access', 'good-refresh');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 })) // original request
      .mockResolvedValueOnce(jsonResponse(envelope({ access_token: 'fresh', refresh_token: 'r2' }))) // /user/refresh
      .mockResolvedValueOnce(jsonResponse(envelope({ ok: true }))); // retry

    const res = await api.get<{ ok: boolean }>('/foo');

    expect(res.data).toEqual({ ok: true });
    expect(getAccessToken()).toBe('fresh'); // tokens rotated in place
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('logs out via the unauthorized handler when there is no refresh token', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }));

    await expect(api.get('/foo')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull(); // tokens cleared
  });
});

describe('concurrent 401s', () => {
  /**
   * The backend model that makes this a bug rather than a redundancy: `POST /user/refresh`
   * rotates the refresh token IN PLACE, so presenting a superseded one is a 401. Anything
   * less faithful than that turns the regression test green for the wrong reason.
   */
  const rotatingServer = () => {
    let validRefresh = 'r0';
    let validAccess = 'a0';
    let generation = 0;
    const refreshCalls: string[] = [];

    const fetchStub = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const endpoint = String(url);

      if (endpoint.endsWith('/user/refresh')) {
        const sent = JSON.parse(String(init?.body ?? '{}')).refresh_token;
        refreshCalls.push(sent);
        if (sent !== validRefresh) return new Response('', { status: 401 });
        generation += 1;
        validAccess = `a${generation}`;
        validRefresh = `r${generation}`;
        return jsonResponse(envelope({ access_token: validAccess, refresh_token: validRefresh }));
      }

      const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (bearer !== `Bearer ${validAccess}`) return new Response('', { status: 401 });
      return jsonResponse(envelope({ endpoint }));
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchStub as unknown as typeof fetch);
    return { refreshCalls };
  };

  it('issues exactly one refresh for parallel requests and keeps everyone signed in', async () => {
    // The live trigger: an hour-old access token plus a screen that fetches two lists on
    // mount (RolesAndPermissions, which loads roles and permissions together). Before
    // single-flight, the second refresh presented the superseded token, 401d, and cleared
    // the pair the first had just minted -- so both requests failed and the user landed on
    // /login.
    setTokens('expired-access', 'r0');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    const { refreshCalls } = rotatingServer();

    const results = await Promise.all([api.get('/roles'), api.get('/permissions')]);

    expect(refreshCalls).toEqual(['r0']);
    expect(results.map((r) => (r.data as { endpoint: string }).endpoint)).toEqual([
      expect.stringContaining('/roles'),
      expect.stringContaining('/permissions'),
    ]);
    expect(getAccessToken()).toBe('a1');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not wedge: a later expiry refreshes again rather than reusing a settled promise', async () => {
    setTokens('expired-access', 'r0');
    const { refreshCalls } = rotatingServer();

    await api.get('/first');
    // Expire the access token again, exactly as the next hour would.
    setTokens('expired-again', getRefreshToken()!);
    await api.get('/second');

    expect(refreshCalls).toEqual(['r0', 'r1']);
    expect(getAccessToken()).toBe('a2');
  });

  it('still clears tokens exactly once when the refresh genuinely fails', async () => {
    // The teardown moved out of refreshAccessToken and into handleUnauthorized. This is
    // the assertion that the move did not lose it.
    setTokens('expired-access', 'revoked-refresh');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    rotatingServer();

    const outcomes = await Promise.allSettled([api.get('/roles'), api.get('/permissions')]);

    expect(outcomes.map((o) => o.status)).toEqual(['rejected', 'rejected']);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(2); // once per failed request, as before
  });

  it('shares the single refresh across a mix of verbs, not just repeated GETs', async () => {
    // The single-flight guard lives in `request()`, which every verb funnels through — so
    // a mix has to collapse to one refresh exactly as a burst of GETs does.
    setTokens('expired-access', 'r0');
    const { refreshCalls } = rotatingServer();

    await Promise.all([
      api.get('/roles'),
      api.post('/users', { email: 'a@example.com' }),
      api.delete('/users/u1'),
    ]);

    expect(refreshCalls).toEqual(['r0']);
  });
});

describe('timeouts', () => {
  /**
   * An API that accepted the connection and then stopped answering. This is the failure the
   * ceiling exists for and the reason it cannot be tested with a rejected fetch: a hung API
   * never rejects. Before the ceiling, every assertion below hung until Vitest's own
   * 15 s test timeout killed the file — which is exactly what the user saw, minus the kill.
   */
  const hungApi = () =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

  /** Fires the ceiling. jsdom's `AbortSignal.timeout` runs on the fake clock — verified. */
  const passTime = (ms: number) => vi.advanceTimersByTimeAsync(ms + 1);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a request the API never answers, instead of pending for ever', async () => {
    vi.useFakeTimers();
    hungApi();

    const pending = api.get('/foo');
    const settled = expect(pending).rejects.toMatchObject({
      name: 'ApiError',
      // 0, not 408: 408 is a status a server can send, and a consumer could not tell the
      // two apart. Nothing in the app branches on 0.
      status: 0,
      message: expect.stringContaining('did not answer within 15s'),
    });

    await passTime(DEFAULT_TIMEOUT_MS);
    await settled;
  });

  it('does not mistake a timeout for a 401 and sign the user out', async () => {
    // The whole point of where the catch sits. `handleUnauthorized()` clears the tokens and
    // bounces the app to /login; a hung API is not an expired session, and a user whose
    // network hiccuped must not come back to a login screen with a session that was valid
    // the entire time.
    vi.useFakeTimers();
    setTokens('access-1', 'refresh-1');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    hungApi();

    const settled = expect(api.get('/foo')).rejects.toBeInstanceOf(ApiError);
    await passTime(DEFAULT_TIMEOUT_MS);
    await settled;

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('holds the ceiling over the body, not only over the headers', async () => {
    // Headers-then-stall is the nastier half: `fetch` resolves the moment the headers
    // arrive, so a body that never completes leaves `.json()` pending for ever — the same
    // never-settling promise, one await later. Reading the body inside the ceiling is what
    // catches it.
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      json: () => new Promise(() => {}),
    } as unknown as Response);

    const settled = expect(api.get('/foo')).rejects.toMatchObject({ status: 0 });
    await passTime(DEFAULT_TIMEOUT_MS);
    await settled;
  });

  it('tells a writer that the change may have landed, and a reader only to retry', async () => {
    // A GET that timed out changed nothing, so "try again" is complete advice. A POST that
    // timed out may well have been applied — the request arrived, the answer did not come
    // back — and "try again" alone is how a duplicate gets created.
    vi.useFakeTimers();
    hungApi();

    const read = expect(api.get('/foo')).rejects.toMatchObject({
      message: expect.stringContaining('try again'),
    });
    const write = expect(api.post('/foo', { a: 1 })).rejects.toMatchObject({
      message: expect.stringContaining('whether the change was applied is unknown'),
    });

    await passTime(DEFAULT_TIMEOUT_MS);
    await Promise.all([read, write]);
  });
});

describe('which ceiling applies', () => {
  // `mockImplementation`, NOT `mockResolvedValue`: the latter hands every call the *same*
  // `Response` object, and a `Response` body can only be read once. The first test below
  // makes several calls in a row, so the second one would fail with "Body is unusable:
  // Body has already been read" — a defect in the test, not in the client. A fresh
  // response per call is what a real `fetch` does anyway.
  const answerEverything = () =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse(envelope({})))
    );

  /** What was actually armed, read off the platform call rather than off an internal. */
  const armed = () => vi.spyOn(AbortSignal, 'timeout');

  it('arms the default ceiling on every call', async () => {
    const clock = armed();
    answerEverything();

    await api.get('/users');
    expect(clock).toHaveBeenLastCalledWith(DEFAULT_TIMEOUT_MS);
    await api.get('/roles');
    expect(clock).toHaveBeenLastCalledWith(DEFAULT_TIMEOUT_MS);
    await api.get('/permissions');
    expect(clock).toHaveBeenLastCalledWith(DEFAULT_TIMEOUT_MS);
    await api.post('/users', { email: 'a@example.com' });
    expect(clock).toHaveBeenLastCalledWith(DEFAULT_TIMEOUT_MS);
  });

  it("keeps the ceiling under the reverse proxy's default read timeout", () => {
    // nginx gives up at `proxy_read_timeout`, 60 s by default. Staying well under it means
    // an ordinary call is never waiting on a proxy that has already stopped waiting.
    expect(DEFAULT_TIMEOUT_MS).toBeLessThan(60_000);
  });

  it('takes `timeoutMs: null` for a response that is meant to stay open', async () => {
    // A Server-Sent Events stream is *supposed* to stay open, so any finite ceiling breaks
    // it outright. Nothing calls one today — this pins the escape hatch for whoever wires
    // one up.
    vi.useFakeTimers();
    const clock = armed();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

    let settled = false;
    const mark = () => {
      settled = true;
    };
    void api.get('/events/stream', { timeoutMs: null }).then(mark, mark);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS * 10);

    expect(clock).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    vi.useRealTimers();
  });

  it('takes a per-call number over the default', async () => {
    const clock = armed();
    answerEverything();

    await api.get('/users', { timeoutMs: 250 });

    expect(clock).toHaveBeenLastCalledWith(250);
  });
});

describe('a caller that brings its own signal', () => {
  it('is not clobbered by the ceiling, and does not clobber it either', async () => {
    // Composition, both directions. The caller's abort must still reach `fetch` — an
    // unmounted screen or a superseded search — and arming it must not switch the ceiling
    // off, which is what a plain `signal: options.signal` would have done.
    const clock = vi.spyOn(AbortSignal, 'timeout');
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

    const settled = api.get('/foo', { signal: controller.signal }).catch((err: unknown) => err);
    controller.abort();
    const err = await settled;

    // A deliberate cancellation is not a failure and is reported as itself: consumers check
    // `err.name === 'AbortError'` and would never see it through an ApiError wrapper.
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
    expect(err).not.toBeInstanceOf(ApiError);
    expect(clock).toHaveBeenCalledWith(DEFAULT_TIMEOUT_MS);
  });

  it('still times out when the caller never aborts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

    const settled = expect(api.get('/foo', { signal: controller.signal })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    await settled;
    vi.useRealTimers();
  });
});

describe('platforms missing one of the two primitives', () => {
  /**
   * `AbortSignal.timeout()` is Chrome 103 / Firefox 100 / Safari 16, `AbortSignal.any()` is
   * Chrome 116 / Firefox 124 / Safari 17.4 — both above the only floor this repo states
   * (Vite's default `"modules"` target). A locked-down enterprise browser can plausibly be
   * missing the younger one. Neither absence may cost the *request*: an unguarded call to a
   * missing static throws `TypeError` before anything is sent and takes every screen down
   * with it, which is far worse than the hang this all fixes.
   */
  const without = async (name: 'timeout' | 'any', run: () => Promise<void>) => {
    const original = AbortSignal[name];
    Reflect.set(AbortSignal, name, undefined);
    try {
      await run();
    } finally {
      Reflect.set(AbortSignal, name, original);
    }
  };

  it('degrades to no ceiling, not to a broken client, without AbortSignal.timeout', async () => {
    await without('timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(envelope({ ok: true })));

      const res = await api.get<{ ok: boolean }>('/foo');

      expect(res.data).toEqual({ ok: true });
    });
  });

  it('composes by hand without AbortSignal.any: the ceiling still fires', async () => {
    vi.useFakeTimers();
    await without('any', async () => {
      const controller = new AbortController();
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

      const settled = expect(
        api.get('/foo', { signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'ApiError', status: 0 });
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
      await settled;
    });
    vi.useRealTimers();
  });

  it('composes by hand without AbortSignal.any: the caller still aborts', async () => {
    await without('any', async () => {
      const controller = new AbortController();
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));

      const settled = api.get('/foo', { signal: controller.signal }).catch((err: unknown) => err);
      controller.abort();

      expect((await settled as DOMException).name).toBe('AbortError');
    });
  });
});

describe('a refresh that never answers', () => {
  it('does not wedge the single flight and does not sign the user out', async () => {
    // The failure this pins is worse than the hang it comes from. `refreshInFlight` is
    // cleared in a `finally`, and a promise that never settles never runs one — so before
    // the ceiling in `doRefresh`, one hung POST /user/refresh left that slot occupied for
    // the life of the tab and *every later 401* queued behind a request that would never
    // finish. One stall, and the whole client stopped.
    vi.useFakeTimers();
    setTokens('expired-access', 'r0');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 })) // the original request
      .mockImplementationOnce(() => new Promise<Response>(() => {})) // /user/refresh, hung
      .mockResolvedValueOnce(new Response('', { status: 401 })) // the next request, later
      .mockResolvedValueOnce(
        jsonResponse(envelope({ access_token: 'fresh', refresh_token: 'r1' })),
      ) // /user/refresh, answering this time
      .mockResolvedValueOnce(jsonResponse(envelope({ ok: true }))); // its retry

    const settled = expect(api.get('/foo')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      // The copy says the session survived, because it did: the tokens were never sent
      // anywhere that answered, so there is nothing to conclude about them.
      message: expect.stringContaining('still'),
    });
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1);
    await settled;

    // Nothing was torn down: a timeout heard no answer at all, and only an answer — a 401
    // from /user/refresh — is allowed to end a session.
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(getRefreshToken()).toBe('r0');
    expect(getAccessToken()).toBe('expired-access');

    // And the next request refreshes again rather than awaiting the dead promise.
    const next = await api.get<{ ok: boolean }>('/foo');

    expect(next.data).toEqual({ ok: true });
    expect(getAccessToken()).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });
});
