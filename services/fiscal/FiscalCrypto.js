/* ══════════════════════════════════════════════════════════════
   Fiscal Crypto — Criptografia AES-256-GCM para tokens/senhas
   NUNCA salvar tokens em texto plano no banco
   ══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey() {
  const key = process.env.FISCAL_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('FISCAL_ENCRYPTION_KEY não configurada ou muito curta (mínimo 32 chars). Adicione ao .env');
  }
  // Derivar chave de 32 bytes a partir da string
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Criptografa um texto plano
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
function encrypt(plaintext) {
  if (!plaintext) return { encrypted: null, iv: null, tag: null };
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Descriptografa um texto cifrado
 * @returns {string} texto plano
 */
function decrypt(encrypted, ivHex, tagHex) {
  if (!encrypted || !ivHex || !tagHex) return null;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
