# Authentification — API BailAutoComplet

Authentification JWT à compte unique, jetons transportés exclusivement par
cookies `httpOnly`. Il n'y a **ni email, ni inscription, ni gestion
d'utilisateurs** : un seul mot de passe protège l'API.

**Aucune route HTTP ne permet de définir ou de modifier ce mot de passe.** Il est
semé hors ligne, depuis un terminal local, par un script qui écrit son hash
directement en base. C'est un choix délibéré : la surface d'attaque publique se
limite à la vérification d'un mot de passe déjà existant.

---

## 1. Mise en route

```bash
npm install
cp .env.example .env
npm run migration:run
```

Dans `.env`, seules deux valeurs sont obligatoires :

```bash
JWT_ACCESS_SECRET=…    # deux valeurs DIFFÉRENTES, générées par :
JWT_REFRESH_SECRET=…   # node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

L'API **refuse de démarrer** si l'une manque, plutôt que de retomber sur une
valeur par défaut. Le mot de passe, lui, ne se configure pas dans `.env`.

### Définir le mot de passe

```bash
npm run auth:seed
```

Le script demande le mot de passe puis sa confirmation, **saisie masquée**, le
hache en bcrypt (12 rounds) et écrit le hash en base. Il n'accepte pas le mot de
passe en argument de ligne de commande : celui-ci resterait dans l'historique du
shell et dans la liste des processus.

```
  Nouveau mot de passe :
  Confirmation          :

  Mot de passe enregistré (haché en bcrypt) et sessions révoquées.
```

Contraintes : 8 caractères minimum, 72 octets maximum (limite de bcrypt, au-delà
la troncature serait silencieuse). Le script refuse et ne touche à rien si les
deux saisies diffèrent ou si la longueur est hors bornes.

**Pour changer de mot de passe** : relancez simplement le script. Les sessions
ouvertes sont révoquées au passage — l'ancien mot de passe et les refresh tokens
en cours cessent immédiatement de valoir.

**Mot de passe perdu** : il n'est stocké que haché, donc irrécupérable. Relancez
le script pour en définir un autre.

Le script doit tourner avec le même `.env` que l'API, pour viser la bonne base.
Tant qu'aucun mot de passe n'est semé, `/auth/login` refuse toute connexion et
l'API le signale par un avertissement au démarrage.

---

## 2. URL de base et port

| | |
|---|---|
| Port | `8080` par défaut, surchargé par `PORT` |
| URL de base locale | `http://localhost:8080` |
| Origine CORS autorisée | `http://localhost:4200` par défaut, surchargée par `CORS_ORIGIN` |
| Préfixe global | **aucun** — les routes sont à la racine (`/auth/login`, pas `/api/auth/login`) |

---

## 3. Endpoints

Quatre routes, pas une de plus. Aucun jeton n'apparaît jamais dans le corps des
réponses : ils sont uniquement dans les en-têtes `Set-Cookie`.

### `POST /auth/login`

```json
{ "password": "…" }
```

`password` : 8 caractères minimum, 72 maximum. Tout autre champ dans le corps
provoque un **400** (`forbidNonWhitelisted`).

Réponse **200** — pose `access_token` et `refresh_token` :

```json
{ "authenticated": true }
```

### `POST /auth/refresh`

Aucun corps. S'authentifie par le cookie `refresh_token`.

Réponse **200** — repose les **deux** cookies (le refresh token est tourné à
chaque appel, l'ancien devient immédiatement invalide) :

```json
{ "authenticated": true }
```

### `POST /auth/logout`

Aucun corps. Non protégé par `JwtAuthGuard` : un access token expiré n'empêche
pas de se déconnecter. Révoque la session en base et efface les deux cookies.
Réussit même sans session ouverte.

Réponse **200** :

```json
{ "authenticated": false }
```

### `GET /auth/me`

Protégé par `JwtAuthGuard`. Sert au front à savoir si la session est vivante.

Réponse **200** : `{ "authenticated": true }`. **401** si l'access token est
absent, expiré ou invalide.

---

## 4. Format exact des erreurs

| Code | Situation | Corps |
|---|---|---|
| 400 | validation du DTO | `{"message":["password doit contenir au moins 8 caractères"],"error":"Bad Request","statusCode":400}` — `message` est **toujours un tableau** ici |
| 401 | mauvais mot de passe | `{"message":"Mot de passe incorrect","error":"Unauthorized","statusCode":401}` |
| 401 | refresh révoqué / expiré | `{"message":"Session expirée, reconnexion requise","error":"Unauthorized","statusCode":401}` |
| 401 | access token absent/expiré sur route protégée | `{"message":"Unauthorized","statusCode":401}` |
| 429 | trop de tentatives | `{"statusCode":429,"message":"Trop de tentatives échouées, réessayez dans 900 secondes","retryAfter":900}` |

Cas particulier : si **aucun mot de passe n'a été semé**, `/auth/login` renvoie
le même **401** « Mot de passe incorrect » qu'un mot de passe faux. Annoncer
« non configuré » renseignerait un attaquant sur l'état du déploiement. La trace
explicite reste côté serveur, dans les logs, où seul l'exploitant la lit.

---

## 5. Cookies posés

| Nom | Contenu | Max-Age |
|---|---|---|
| `access_token` | JWT signé avec `JWT_ACCESS_SECRET` | `900` s (15 min), réglable par `JWT_ACCESS_TTL` |
| `refresh_token` | JWT signé avec `JWT_REFRESH_SECRET` | `604800` s (7 jours), réglable par `JWT_REFRESH_TTL` |

Options identiques pour les deux : `HttpOnly`, `Path=/`, `SameSite=Strict`,
`Secure` actif seulement si `NODE_ENV=production` (ou `COOKIE_SECURE=true`).

En-tête réellement émis, relevé sur l'API en fonctionnement :

```
Set-Cookie: access_token=eyJhbGciOi…; Max-Age=900; Path=/; Expires=…; HttpOnly; SameSite=Strict
Set-Cookie: refresh_token=eyJhbGciOi…; Max-Age=604800; Path=/; Expires=…; HttpOnly; SameSite=Strict
```

Ces cookies sont **illisibles en JavaScript** : le front ne doit jamais tenter de
lire `document.cookie`, seulement envoyer `withCredentials: true`.

### Piège de déploiement

`SameSite=Strict` n'envoie le cookie que si le front et l'API partagent le même
site. Le port ne compte pas : `localhost:4200` → `localhost:8080` fonctionne en
développement. **Si le front et l'API sont déployés sur deux domaines
différents**, il faut impérativement :

```bash
COOKIE_SAMESITE=none
COOKIE_SECURE=true      # impose HTTPS
```

Sans cela le navigateur ignore les cookies silencieusement, sans message
d'erreur. C'est le cas de la configuration de production actuelle (front et API
sur des domaines distincts).

---

## 6. Choix de sécurité

- **Aucune route de définition du mot de passe.** Ni création, ni modification,
  ni réinitialisation par HTTP. Le seul chemin d'écriture est `npm run auth:seed`,
  qui exige un accès au terminal **et** à la base.
- **Mot de passe** : bcrypt, 12 rounds, stocké haché dans la table `auth_account`
  (une ligne, contrainte `CHECK (id = 1)`). Jamais en clair, nulle part.
- **Saisie masquée et jamais en argument** : le script refuse de tourner hors
  d'un terminal interactif, pour que le mot de passe ne transite ni par
  l'historique du shell, ni par la liste des processus, ni par un fichier.
- **Refresh token révocable** : seule son empreinte est stockée. Le jeton est
  réduit en SHA-256 avant le bcrypt — bcrypt ignore tout ce qui dépasse 72
  octets, or deux JWT successifs partagent leur préfixe : les hacher directement
  reviendrait à comparer ce préfixe.
- **Rotation** : chaque `/auth/refresh` réémet le refresh token. Un jeton
  intercepté cesse de valoir dès que le client légitime s'en sert.
- **Secrets distincts** pour access et refresh : un refresh token ne peut pas
  être présenté comme un access token.
- **Anti-force brute** : 5 échecs dans une fenêtre de 15 minutes verrouillent
  `/auth/login` (429). Avec un seul secret à deviner et pas d'email, l'endpoint
  serait autrement directement attaquable.

  *Deux limites assumées* : le compteur est en mémoire (remis à zéro au
  redémarrage, non partagé entre plusieurs instances — mono-instance uniquement),
  et pendant le verrou le bon mot de passe est refusé lui aussi. Un tiers peut
  donc vous verrouiller 15 minutes. Redémarrer l'API lève le verrou.
- **Validation** posée sur `AuthController` et non en pipe global : les DTO des
  modules historiques (appartement, chambre…) n'ont aucun décorateur, un
  `whitelist` global viderait leurs corps de requête.

---

## 7. Protéger d'autres routes

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('appartement')
export class AppartementController {}
```

Le module concerné doit importer `AuthModule`. **Les contrôleurs existants ne
sont volontairement pas protégés** : les brancher casserait le front tant qu'il
n'envoie pas `withCredentials`.

---

## 8. Prompt pour l'agent frontend Angular

Écrit pour le dépôt `bailAutoComplete-Front` tel qu'il est réellement structuré
(Angular 18.2, bootstrap standalone, environnements à la racine). À copier tel
quel.

````markdown
Tu es un agent expert Angular. Implémente l'authentification du front contre une
API NestJS déjà en place et déjà testée. Les informations ci-dessous décrivent
l'API telle qu'elle est réellement codée : ne dévie d'aucune, et n'invente aucun
endpoint, champ ou format qui n'y figure pas.

## État réel du projet front — lis ceci avant d'écrire une ligne

- Angular **18.2**, TypeScript 5.4, RxJS 7.8, `strict: true` avec
  `noPropertyAccessFromIndexSignature`.
- Le bootstrap est **standalone** : `src/main.ts` appelle `bootstrapApplication`
  avec `provideHttpClient()` et
  `importProvidersFrom(AppRoutingModule, ReactiveFormsModule, NgxPrintModule)`.
- **`src/app/app.module.ts` existe mais n'est jamais chargé** — `main.ts` ne
  l'importe pas. C'est du code mort. **N'y ajoute rien** : un interceptor déclaré
  là ne s'exécuterait jamais, sans aucune erreur visible.
- Les composants sont **standalone** (`standalone: true`), mais le routage passe
  par un NgModule, `src/app/app-routing.module.ts`, injecté via
  `importProvidersFrom`. Routes existantes : `''` → `FormDocComponent`,
  `'table'` → `TableComponent`, `'history'` → chargée en `loadComponent`.
- Les environnements sont **à la racine du projet**, pas dans `src/` :
  `environments/environment.ts` (dev, `apiUrl: 'http://localhost:8080'`) et
  `environments/environment.prod.ts` (prod). On les importe
  `from 'environments/environment'` grâce à `baseUrl: "./"` dans `tsconfig.json`.
  Ne crée pas de `src/environments`, réutilise l'existant.
- Le service HTTP existant est `src/app/service/requestService.ts`
  (`RequestService`), qui construit ses URL avec `${environment.apiUrl}/`.
  **Ne le modifie pas** : l'interceptor posera `withCredentials` globalement.

## Contexte de l'API

- URL de base : `environment.apiUrl`. Aucun préfixe global : les routes sont
  `/auth/login`, pas `/api/auth/login`.
- L'application n'a **qu'un seul compte**, protégé par un **mot de passe seul**.
  Il n'y a **ni email, ni inscription** : ne crée jamais de champ email.
- **Le mot de passe est défini hors ligne**, par un script serveur lancé dans un
  terminal. Il n'existe **aucune route HTTP** pour le créer, le modifier ou le
  réinitialiser. Ne construis donc **ni écran d'inscription, ni écran de
  configuration initiale, ni écran « mot de passe oublié », ni formulaire de
  changement de mot de passe** — il n'y a rien derrière côté API.
- Les jetons JWT sont dans des cookies `httpOnly` (`access_token`,
  `refresh_token`). Ils sont **illisibles en JavaScript** : n'essaie jamais de
  lire `document.cookie`, ne stocke rien dans `localStorage` ou
  `sessionStorage`, et n'ajoute aucun en-tête `Authorization`.
- **Toute** requête vers l'API doit partir avec `withCredentials: true`, sinon le
  navigateur n'enverra pas les cookies.

## Endpoints, payloads et réponses exacts

Il n'y a que ces quatre routes d'authentification.

| Méthode | Route | Corps envoyé | Réponse 200 |
|---|---|---|---|
| POST | `/auth/login` | `{ "password": "…" }` | `{ "authenticated": true }` |
| POST | `/auth/refresh` | *aucun corps* | `{ "authenticated": true }` |
| POST | `/auth/logout` | *aucun corps* | `{ "authenticated": false }` |
| GET | `/auth/me` | — | `{ "authenticated": true }` |

Aucune de ces réponses ne contient de jeton : les cookies sont posés par l'API
via `Set-Cookie`. Ne cherche pas de champ `accessToken` dans le JSON, il n'existe
pas.

Contraintes sur `password` : 8 caractères minimum, 72 maximum. Applique les mêmes
bornes dans le formulaire (`Validators.required`, `Validators.minLength(8)`,
`Validators.maxLength(72)`). N'envoie aucun champ supplémentaire dans le corps de
`/auth/login` : tout champ en trop déclenche un 400.

## Formats d'erreur exacts à gérer

- **400** (validation) : `{"message":["password doit contenir au moins 8 caractères"],"error":"Bad Request","statusCode":400}`
  — attention, `message` est ici un **tableau de chaînes**.
- **401** (mauvais mot de passe) : `{"message":"Mot de passe incorrect","error":"Unauthorized","statusCode":401}`
  — ici `message` est une **chaîne simple**.
- **401** (session expirée sur `/auth/refresh`) : `{"message":"Session expirée, reconnexion requise","error":"Unauthorized","statusCode":401}`
- **429** (trop de tentatives) : `{"statusCode":429,"message":"Trop de tentatives échouées, réessayez dans 900 secondes","retryAfter":900}`
  — `retryAfter` est un nombre de secondes ; affiche-le à l'utilisateur.

Écris un utilitaire qui normalise `message` (chaîne **ou** tableau) en un texte
affichable, parce que les deux formes existent selon le code HTTP.

## Fichiers à créer

- `src/app/service/auth.service.ts`
- `src/app/service/auth.interceptor.ts`
- `src/app/guard/auth.guard.ts`
- `src/app/login/login.component.ts` (+ `.html`, `.scss`)

## Fichiers à modifier

- `src/main.ts` : remplacer `provideHttpClient()` par
  `provideHttpClient(withInterceptors([authInterceptor]))`.
- `src/app/app-routing.module.ts` : ajouter la route `login`, et poser le guard
  sur `''`, `'table'` et `'history'`.
- `src/app/app.component.html` : ajouter un bouton de déconnexion dans la
  navigation, visible seulement si authentifié.

## Ce que tu dois implémenter

1. **`AuthService`** (`providedIn: 'root'`)
   - `login(password: string): Observable<void>` → `POST /auth/login`.
   - `logout(): Observable<void>` → `POST /auth/logout`, puis navigation vers
     `/login`.
   - `refresh(): Observable<void>` → `POST /auth/refresh`.
   - `checkSession(): Observable<boolean>` → `GET /auth/me`, `true` sur 200,
     `false` sur 401.
   - Un `signal<boolean>` `isAuthenticated` exposant l'état courant (Angular 18,
     les signaux sont disponibles). Il n'y a pas de profil utilisateur à
     stocker : l'API ne renvoie qu'un booléen.

2. **Interceptor fonctionnel** (`HttpInterceptorFn`) — c'est la pièce centrale :
   - **N'agit que sur les requêtes dont l'URL commence par
     `environment.apiUrl`.** C'est impératif : `DocGeneratorService` fait un
     `http.get('assets/docx/bail.docx')` vers un fichier statique local, qui ne
     doit recevoir ni `withCredentials` ni logique de refresh.
   - pose `withCredentials: true` sur les requêtes retenues ;
   - sur une réponse **401**, appelle `POST /auth/refresh` **une seule fois**,
     puis rejoue la requête d'origine ;
   - si le refresh échoue (401), passe `isAuthenticated` à `false` et navigue
     vers `/login` ;
   - **single-flight obligatoire** : si plusieurs requêtes tombent en 401
     simultanément, un seul `/auth/refresh` doit partir et les autres doivent
     attendre son résultat (`shareReplay(1)` sur l'observable de refresh, ou un
     `BehaviorSubject` de verrou). Sans cela, les appels concurrents déclenchent
     plusieurs rotations et s'invalident mutuellement — l'API tourne le refresh
     token à chaque usage.
   - **n'intercepte jamais** les 401 venant de `/auth/login`, `/auth/refresh` et
     `/auth/me` : sans cette exclusion tu crées une boucle infinie de refresh.

3. **`authGuard`** (`CanActivateFn`) : autorise si `isAuthenticated()` est vrai,
   sinon appelle `checkSession()` et redirige vers `/login` en cas d'échec.

4. **`LoginComponent`** (`/login`) : un unique champ mot de passe
   (`type="password"`, `autocomplete="current-password"`), un bouton désactivé
   pendant l'appel, l'affichage des erreurs 401 et 429. Aucun champ email, aucun
   lien « créer un compte », aucun lien « mot de passe oublié ». Utilise
   `ReactiveFormsModule`, déjà fourni par le bootstrap.

5. **Réhydratation au démarrage** : au boot, appelle `checkSession()` — les
   cookies survivent au rechargement de page, mais le front n'en sait rien tant
   qu'il n'a pas demandé. Évite le clignotement d'un écran de login sur une
   session valide.

## Contraintes techniques

- Composants **standalone**, interceptor **fonctionnel** (`HttpInterceptorFn`),
  guard **fonctionnel** (`CanActivateFn`). Pas de classe `HttpInterceptor`, pas
  de `NgModule` nouveau.
- Utilise `inject()` plutôt que l'injection par constructeur dans l'interceptor
  et le guard.
- RxJS idiomatique, pas de `.subscribe()` imbriqué dans l'interceptor.
- `strict: true` et `noPropertyAccessFromIndexSignature` sont actifs : type
  explicitement les réponses HTTP, n'utilise pas `any`.
- Aucun jeton, aucun mot de passe écrit dans `localStorage`, `sessionStorage` ou
  un cookie posé côté client.
- Vérifie que `npm run build` passe avant de conclure.

## Avertissement de déploiement à relayer à l'utilisateur

En production, `environments/environment.prod.ts` pointe vers
`https://bailautocontainers5e6cf272-bailauto-backend.functions.fnc.fr-par.scw.cloud`,
qui n'est pas le domaine du front. Or l'API pose ses cookies en
`SameSite=Strict`, ce qui les limite au même site : ils fonctionneront en local
(`localhost:4200` → `localhost:8080`, le port ne compte pas) mais seront
**ignorés silencieusement par le navigateur en production**.

Signale-le explicitement à l'utilisateur à la fin de ton travail : côté API, il
devra passer `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS obligatoire) et
`CORS_ORIGIN=<URL exacte du front en production>`. Ne tente pas de contourner ça
côté front, c'est une configuration serveur.
````

---

## 9. Vérifications effectuées

Scénarios rejoués contre l'API démarrée sur une base jetable, tous conformes :

| # | Scénario | Résultat |
|---|---|---|
| 1 | routes exposées | exactement `login`, `refresh`, `logout`, `me` |
| 2 | `GET /auth/setup-required` | **404** (route supprimée) |
| 3 | `POST /auth/setup` | **404** (route supprimée) |
| 4 | démarrage sans mot de passe semé | avertissement dans les logs |
| 5 | `login` avant seed | 401 « Mot de passe incorrect », sans fuite d'état |
| 6 | `auth:seed` hors terminal interactif | refusé |
| 7 | `auth:seed` interactif | hash `$2b$12$…` de 60 caractères en base, saisie jamais affichée |
| 8 | `login` avec le mot de passe semé | 200, 2 cookies `HttpOnly` `SameSite=Strict` |
| 9 | `GET /auth/me` | 200 |
| 10 | `POST /auth/refresh` | 200, refresh token effectivement différent |
| 11 | ancien refresh token rejoué | 401 (rotation effective) |
| 12 | `logout` puis `refresh` | 200 puis 401 |
| 13 | mauvais mot de passe | 401 |
| 14 | `auth:seed` avec deux saisies divergentes | refusé, base inchangée |
| 15 | `auth:seed` avec un mot de passe trop court | refusé, base inchangée |
| 16 | changement de mot de passe : session ouverte | `refresh` 200 avant, **401 après** |
| 17 | ancien mot de passe après changement | 401 |
| 18 | nouveau mot de passe après changement | 200 |

Vérifiés sur l'itération précédente du même code, inchangés depuis (validation et
CORS n'ont pas été touchés par la suppression du setup) : 400 sur mot de passe
trop court, 400 sur champ en trop, 429 à la 6ᵉ tentative, et préflight CORS
`Access-Control-Allow-Credentials: true`.
