import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCrm, CrmError } from './crm.js';

type Captured = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('connecteur désactivé sans CRM_API_URL : aucune requête, retour null', async () => {
  delete process.env.CRM_API_URL;
  let called = false;
  const fetchFn = async () => {
    called = true;
    throw new Error('ne doit pas être appelé');
  };
  const result = await searchCrm({ ip: '10.0.44.7' }, fetchFn);
  assert.equal(result, null);
  assert.equal(called, false);
});

test('requête envoyée au CRM : URL, en-têtes (bearer) et corps corrects', async () => {
  process.env.CRM_API_URL = 'https://crm.exemple.fr/api/';
  process.env.CRM_SEARCH_PATH = '/clients/search';
  process.env.CRM_API_KEY = 'secret-key';

  const captured: Captured[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    captured.push({ url, init });
    return jsonResponse({
      record: { serialNumber: 'RTR-2025-000777', clientCode: 'CL-9Z9Z', ip: '10.0.99.1' },
    });
  };

  const result = await searchCrm({ ip: '10.0.99.1' }, fetchFn);

  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, 'https://crm.exemple.fr/api/clients/search');
  const headers = captured[0].init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer secret-key');
  assert.deepEqual(JSON.parse(String(captured[0].init?.body)), { ip: '10.0.99.1' });
  assert.deepEqual(result, {
    serialNumber: 'RTR-2025-000777',
    clientCode: 'CL-9Z9Z',
    ip: '10.0.99.1',
  });

  delete process.env.CRM_SEARCH_PATH;
  delete process.env.CRM_API_KEY;
});

test(' réponse 404 du CRM : enregistrement non trouvé (null)', async () => {
  const fetchFn = async () => jsonResponse({ record: null }, 404);
  assert.equal(await searchCrm({ serialNumber: 'RTR-XXXX' }, fetchFn), null);
});

test('réponse invalide du CRM : CrmError', async () => {
  const fetchFn = async () => jsonResponse({ record: { serialNumber: 'SN-1' } });
  await assert.rejects(
    () => searchCrm({ serialNumber: 'SN-1' }, fetchFn),
    (err: unknown) => err instanceof CrmError,
  );
});

test('erreur HTTP du CRM : CrmError avec le code', async () => {
  const fetchFn = async () => jsonResponse({ error: 'boom' }, 500);
  await assert.rejects(
    () => searchCrm({ clientCode: 'CL-1A6F' }, fetchFn),
    (err: unknown) => err instanceof CrmError && /500/.test(err.message),
  );
});

test('CRM injoignable : CrmError', async () => {
  const fetchFn = async () => {
    throw new Error('network down');
  };
  await assert.rejects(
    () => searchCrm({ clientCode: 'CL-1A6F' }, fetchFn),
    (err: unknown) => err instanceof CrmError,
  );
});
