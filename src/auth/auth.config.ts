import type { CookieOptions } from 'express';

/** Noms des cookies posés par l'API. Le front n'a jamais à les lire (httpOnly). */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const requireEnv = (name: string, hint: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} est absent de l'environnement : l'API refuse de démarrer ` +
        `plutôt que de fonctionner avec une valeur par défaut. ${hint}`,
    );
  }

  return value;
};

const toSeconds = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

/**
 * Durées de vie exprimées en secondes : la même valeur sert d'`expiresIn` au
 * JWT et de `maxAge` au cookie, ce qui évite qu'ils divergent.
 */
export const accessTokenTtlSeconds = (): number =>
  toSeconds(process.env.JWT_ACCESS_TTL, 15 * 60);

export const refreshTokenTtlSeconds = (): number =>
  toSeconds(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60);

export const accessTokenSecret = (): string =>
  requireEnv('JWT_ACCESS_SECRET', 'Voir .env.example.');

export const refreshTokenSecret = (): string =>
  requireEnv('JWT_REFRESH_SECRET', 'Voir .env.example.');

/**
 * `sameSite` vaut `strict` par défaut.
 *
 * Attention en production : `strict` (comme `lax`) n'envoie le cookie que si le
 * front et l'API partagent le même site — le port ne compte pas, donc
 * `localhost:4200` → `localhost:8080` fonctionne en développement. Si l'API et
 * le front sont déployés sur deux domaines distincts, il faut passer
 * `COOKIE_SAMESITE=none` **et** `COOKIE_SECURE=true` (HTTPS obligatoire), sans
 * quoi le navigateur ignorera silencieusement les cookies.
 */
const sameSite = (): CookieOptions['sameSite'] => {
  const value = (process.env.COOKIE_SAMESITE ?? 'strict').toLowerCase();
  return value === 'none' || value === 'lax' ? value : 'strict';
};

const secure = (): boolean =>
  process.env.COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === 'production'
    : process.env.COOKIE_SECURE.toLowerCase() === 'true';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: secure(),
  sameSite: sameSite(),
  path: '/',
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

export const accessCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: accessTokenTtlSeconds() * 1000,
});

export const refreshCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  maxAge: refreshTokenTtlSeconds() * 1000,
});

/**
 * `clearCookie` n'efface que si le navigateur retrouve un cookie de mêmes
 * `path`, `domain`, `secure` et `sameSite` : on réutilise donc les options de
 * pose, `maxAge` en moins.
 */
export const clearCookieOptions = (): CookieOptions => baseCookieOptions();
