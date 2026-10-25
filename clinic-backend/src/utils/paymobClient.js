const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://accept.paymob.com';

const readEnv = (primary, fallback) => {
  const value = process.env[primary] || (fallback ? process.env[fallback] : '');
  return typeof value === 'string' ? value.trim() : '';
};

const getConfig = () => {
  const baseUrl = (readEnv('PAYMOB_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const appPublicUrl = readEnv('APP_PUBLIC_URL', 'APP_URL').replace(/\/+$/, '');
  const webhookUrl = readEnv('PAYMOB_WEBHOOK_URL');
  const redirectionUrl = appPublicUrl ? `${appPublicUrl}/?payment=return` : '';

  return {
    baseUrl,
    secretKey: readEnv('Paymob_Secret_Key', 'PAYMOB_SECRET_KEY'),
    publicKey: readEnv('Paymob_Public_Key', 'PAYMOB_PUBLIC_KEY'),
    integrationId: readEnv('Paymob_Integration_ID', 'PAYMOB_INTEGRATION_ID'),
    hmacSecret: readEnv('Paymob_HMAC', 'PAYMOB_HMAC'),
    currency: (readEnv('PAYMOB_CURRENCY') || 'EGP').toUpperCase(),
    expiryHours: Number(readEnv('PAYMENT_EXPIRY_HOURS')) || 24,
    appPublicUrl,
    webhookUrl,
    redirectionUrl,
  };
};

const isConfigured = () => {
  const config = getConfig();
  return Boolean(
    config.secretKey &&
    config.publicKey &&
    config.integrationId &&
    config.hmacSecret &&
    config.webhookUrl
  );
};

const getPublicConfig = () => {
  const config = getConfig();
  return {
    provider: 'paymob',
    enabled: isConfigured(),
    currency: config.currency,
    publicKey: config.publicKey || null,
  };
};

const createIntention = async ({
  amountCents,
  currency,
  billingData,
  specialReference,
  items = [],
  expiration = null,
}) => {
  const config = getConfig();
  if (!isConfigured()) {
    const error = new Error('Paymob is not fully configured.');
    error.status = 503;
    throw error;
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    const error = new Error('Payment amount must be a positive integer in piastres.');
    error.status = 400;
    throw error;
  }
  const integrationId = Number(config.integrationId);
  if (!Number.isInteger(integrationId) || integrationId <= 0) {
    const error = new Error('Paymob integration ID must be a positive number.');
    error.status = 503;
    throw error;
  }

  const payload = {
    amount: amountCents,
    currency: currency || config.currency,
    payment_methods: [integrationId],
    billing_data: billingData,
    special_reference: specialReference,
    notification_url: config.webhookUrl,
    redirection_url: config.redirectionUrl || undefined,
    items,
  };
  const expirationSeconds = Number(expiration);
  if (Number.isInteger(expirationSeconds) && expirationSeconds > 0) {
    payload.expiration = expirationSeconds;
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const wrapped = new Error(`Could not reach Paymob: ${error.message}`);
    wrapped.status = 502;
    throw wrapped;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const detail = data && (data.detail || data.message || data.error);
    const message = typeof detail === 'string'
      ? detail
      : detail
        ? JSON.stringify(detail)
        : `Paymob responded with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = 502;
    error.providerStatus = response.status;
    throw error;
  }

  if (!data || !data.client_secret || !data.intention_order_id) {
    const error = new Error('Paymob returned an incomplete intention response.');
    error.status = 502;
    throw error;
  }

  return data;
};

const getCheckoutUrl = (clientSecret) => {
  const config = getConfig();
  const query = new URLSearchParams({
    publicKey: config.publicKey,
    clientSecret,
  });
  return `${config.baseUrl}/unifiedcheckout/?${query.toString()}`;
};

const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

const readPath = (object, path) =>
  path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);

const buildHmacPayload = (object) =>
  HMAC_FIELDS.map((path) => {
    const value = readPath(object, path);
    return value == null ? '' : String(value);
  }).join('');

const verifyWebhookHmac = (object, receivedHmac) => {
  const config = getConfig();
  if (!config.hmacSecret || !receivedHmac) return false;

  const expected = crypto
    .createHmac('sha512', config.hmacSecret)
    .update(buildHmacPayload(object))
    .digest('hex');
  const actual = String(receivedHmac).trim().toLowerCase();
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
};

module.exports = {
  getConfig,
  getPublicConfig,
  isConfigured,
  createIntention,
  getCheckoutUrl,
  buildHmacPayload,
  verifyWebhookHmac,
};
