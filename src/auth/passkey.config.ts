/**
 * Paramètres WebAuthn. Le navigateur exécute la cérémonie depuis le FRONT : l'origine
 * attendue et le `rpID` sont donc ceux du front, pas ceux de l'API.
 *
 * Un passkey est lié au `rpID` : le changer après coup invalide tous les passkeys
 * déjà enregistrés (le mot de passe reste alors le recours).
 */
const frontOrigin = (): string =>
  process.env.WEBAUTHN_ORIGIN ??
  process.env.CORS_ORIGIN ??
  'http://localhost:4200';

export const webauthnOrigin = (): string => frontOrigin();

export const webauthnRpId = (): string =>
  process.env.WEBAUTHN_RP_ID ?? new URL(frontOrigin()).hostname;

export const webauthnRpName = (): string =>
  process.env.WEBAUTHN_RP_NAME ?? 'Bail Auto';

/** Durée de validité d'un défi WebAuthn, en secondes. */
export const PASSKEY_CHALLENGE_TTL_SECONDS = 5 * 60;

export const PASSKEY_PENDING_COOKIE = 'passkey_pending';
export const PASSKEY_REGISTRATION_COOKIE = 'passkey_registration';
