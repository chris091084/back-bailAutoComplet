import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Limitation des tentatives de connexion.
 *
 * Avec un compte unique et sans email, `/auth/login` n'a qu'un seul secret à
 * deviner : sans frein, il est directement attaquable par force brute. Le
 * compteur est global — il n'y a de toute façon qu'un compte — et remis à zéro
 * dès qu'une tentative aboutit.
 *
 * L'état est en mémoire : il repart à zéro au redémarrage et n'est pas partagé
 * entre plusieurs instances. C'est suffisant pour un déploiement mono-instance ;
 * au-delà, il faudrait le déporter (Redis) ou s'appuyer sur le limiteur du
 * reverse proxy.
 */
@Injectable()
export class LoginThrottleService {
  private failures: number[] = [];

  /** Écarte les tentatives sorties de la fenêtre glissante. */
  private prune(now: number): void {
    this.failures = this.failures.filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );
  }

  assertNotLocked(): void {
    const now = Date.now();
    this.prune(now);

    if (this.failures.length < MAX_ATTEMPTS) {
      return;
    }

    const oldest = this.failures[0];
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Trop de tentatives échouées, réessayez dans ${retryAfterSeconds} secondes`,
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  registerFailure(): void {
    const now = Date.now();
    this.prune(now);
    this.failures.push(now);
  }

  reset(): void {
    this.failures = [];
  }
}
