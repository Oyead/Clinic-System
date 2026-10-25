const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.Paymob_HMAC = 'test-hmac-secret';
process.env.Paymob_Public_Key = 'test-public-key';
process.env.Paymob_Secret_Key = 'test-secret-key';
process.env.Paymob_Integration_ID = '6017569';
process.env.PAYMOB_WEBHOOK_URL = 'https://example.com/api/v1/payments/paymob/webhook';
process.env.APP_PUBLIC_URL = 'https://clinic.example';

const paymobClient = require('../src/utils/paymobClient');

const sampleWebhook = {
  id: 123456,
  amount_cents: 25000,
  created_at: '2026-10-23T16:05:00.000000',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  integration_id: 6017569,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 987654, merchant_order_id: 'appt-1-test' },
  owner: 2114273,
  pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  success: true,
};

const sign = (object, secret = process.env.Paymob_HMAC) =>
  crypto
    .createHmac('sha512', secret)
    .update(paymobClient.buildHmacPayload(object))
    .digest('hex');

test('buildHmacPayload follows Paymob field order and string values', () => {
  assert.equal(
    paymobClient.buildHmacPayload(sampleWebhook),
    '250002026-10-23T16:05:00.000000EGPfalsefalse1234566017569truefalsefalsefalsetruefalse9876542114273false2346MasterCardcardtrue'
  );
});

test('verifyWebhookHmac accepts a valid signature', () => {
  assert.equal(paymobClient.verifyWebhookHmac(sampleWebhook, sign(sampleWebhook)), true);
});

test('verifyWebhookHmac rejects a tampered payload', () => {
  const hmac = sign(sampleWebhook);
  assert.equal(
    paymobClient.verifyWebhookHmac({ ...sampleWebhook, amount_cents: 1 }, hmac),
    false
  );
});

test('verifyWebhookHmac rejects a signature from another secret', () => {
  assert.equal(
    paymobClient.verifyWebhookHmac(sampleWebhook, sign(sampleWebhook, 'wrong-secret')),
    false
  );
});

test('getCheckoutUrl encodes the public key and client secret', () => {
  const url = paymobClient.getCheckoutUrl('client secret/value');
  assert.match(url, /\/unifiedcheckout\/\?/);
  assert.match(url, /publicKey=test-public-key/);
  assert.match(url, /clientSecret=client\+secret%2Fvalue/);
});

test('createIntention posts Paymob Unified Checkout fields and omits customer', async (t) => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 201,
      json: async () => ({
        client_secret: 'sec_test',
        intention_order_id: 987654,
        id: 'int_1',
      }),
    };
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const result = await paymobClient.createIntention({
    amountCents: 25000,
    currency: 'EGP',
    billingData: { first_name: 'A', last_name: 'B', phone_number: '+201000000000' },
    specialReference: 'appt-1-test',
    expiration: 3600,
    items: [{ name: 'Consultation', amount: 25000, quantity: 1 }],
  });

  assert.equal(result.client_secret, 'sec_test');
  assert.equal(captured.url, 'https://accept.paymob.com/v1/intention/');
  assert.equal(captured.options.headers.Authorization, 'Token test-secret-key');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.amount, 25000);
  assert.deepEqual(body.payment_methods, [6017569]);
  assert.equal(body.special_reference, 'appt-1-test');
  assert.equal(body.expiration, 3600);
  assert.equal(body.notification_url, process.env.PAYMOB_WEBHOOK_URL);
  assert.equal(body.redirection_url, 'https://clinic.example/?payment=return');
  assert.equal(body.customer, undefined);
});
