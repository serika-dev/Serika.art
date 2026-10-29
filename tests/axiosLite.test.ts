// The browser "axios" (lib/axiosLite.ts) must let the browser write the
// multipart Content-Type for FormData, boundary included; a caller-set
// "multipart/form-data" without one made every upload fail to parse.
// Run: bun --no-env-file test tests   (or: node --experimental-strip-types --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from '../lib/axiosLite';

function captureFetch() {
  const calls: { headers: Record<string, string>; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    calls.push({ headers: { ...(init.headers as Record<string, string>) }, body: init.body });
    return new Response('{"success":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('FormData drops a caller-set multipart Content-Type so the browser adds the boundary', async () => {
  const { calls, restore } = captureFetch();
  try {
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.webp');
    await axios.post('/api/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].body instanceof FormData);
    assert.ok(!Object.keys(calls[0].headers).some((h) => h.toLowerCase() === 'content-type'));
  } finally {
    restore();
  }
});

test('JSON bodies still get application/json', async () => {
  const { calls, restore } = captureFetch();
  try {
    await axios.post('/api/x', { a: 1 });
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.equal(calls[0].body, '{"a":1}');
  } finally {
    restore();
  }
});
