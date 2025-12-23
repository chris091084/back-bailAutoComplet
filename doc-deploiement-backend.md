# Documentation Déploiement Backend - BailAutoComplete

## Stack technique

- **Framework** : Spring Boot 3.3.4
- **Java** : 17
- **Base de données** : PostgreSQL
- **Migrations** : Liquibase
- **Build** : Maven
- **Hébergement** : Koyeb (gratuit, ne s'éteint pas)
- **Base de données hébergée** : Render PostgreSQL (gratuit 90 jours)

---

## Architecture de déploiement

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │ ──── │    Backend      │ ──── │   PostgreSQL    │
│    (Vercel)     │      │    (Koyeb)      │      │    (Render)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## Fichiers de configuration

### 1. Dockerfile (racine du projet)

```dockerfile
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]
```

### 2. application.properties (dev local)

```properties
spring.application.name=BailAutoComplet
spring.datasource.url=jdbc:postgresql://localhost:5432/bailAutoComplete
spring.datasource.username=postgres
spring.datasource.password=root
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.show-sql=true

spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.xml
```

### 3. application-prod.properties (production)

```properties
spring.application.name=BailAutoComplet

spring.datasource.url=${DATABASE_URL}
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.show-sql=false

spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.xml
```

### 4. CorsConfig.java (configuration CORS)

```java
package Back.bailAutoComplet.BailAutoComplet.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

@Configuration
public class CorsConfig {

    @Value("${CORS_ORIGIN:http://localhost:4200}")
    private String corsOrigin;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(corsOrigin));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
```

---

## Déploiement sur Render (Base de données PostgreSQL)

### Étapes

1. Créer un compte sur **render.com** (connexion GitHub)
2. Cliquer sur **New** → **PostgreSQL**
3. Configurer :
   - **Name** : `bailautocomplete-db`
   - **Region** : Frankfurt (EU Central)
   - **Plan** : Free
4. Cliquer sur **Create Database**
5. Récupérer l'**Internal Database URL** dans la section Connections

### Format de l'URL pour Spring Boot

Transformer l'URL PostgreSQL :
```
postgres://USER:PASSWORD@HOST/DATABASE
```

En URL JDBC :
```
jdbc:postgresql://HOST:5432/DATABASE?user=USER&password=PASSWORD
```

---

## Déploiement sur Koyeb (Backend Spring Boot)

### Étapes

1. Créer un compte sur **koyeb.com** (connexion GitHub)
2. Cliquer sur **Create Service** → **Web Service**
3. Sélectionner **GitHub** et choisir le repo backend
4. Configurer :
   - **Builder** : Dockerfile (ou Buildpack)
   - **Region** : Frankfurt
   - **Instance type** : Free
5. Ajouter les **variables d'environnement** :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `jdbc:postgresql://HOST:5432/DATABASE?user=USER&password=PASSWORD` |
| `CORS_ORIGIN` | `https://bail-auto-complete-front.vercel.app` |

6. Cliquer sur **Deploy**

### URL finale

```
https://relative-ammamaria-mundus09-e11bb300.koyeb.app
```

---

## CI/CD automatique

À chaque `git push` sur la branche `master` :
1. Koyeb détecte le changement
2. Build automatique via Dockerfile
3. Déploiement automatique
4. Zero downtime

---

## Commandes utiles

### Donner les permissions au Maven Wrapper

```bash
git update-index --chmod=+x mvnw
git add mvnw
git commit -m "Fix mvnw permission"
git push
```

### Réinitialiser la base de données (via psql)

```bash
psql "postgres://USER:PASSWORD@HOST/DATABASE"
```

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q
```

---

## Troubleshooting

### Erreur "Permission denied" sur mvnw

```bash
chmod +x mvnw
git add mvnw
git commit -m "Fix mvnw permission"
git push
```

### Erreur CORS 403 Forbidden

1. Vérifier que `CORS_ORIGIN` est correctement configuré
2. Vérifier que la classe `CorsConfig.java` existe
3. S'assurer qu'il n'y a pas de `/` à la fin de l'URL

### Erreur Liquibase checksum

Ajouter la variable d'environnement :
```
SPRING_LIQUIBASE_CLEAR_CHECKSUMS=true
```

---

## Limitations du plan gratuit

- **Render PostgreSQL** : expire après 90 jours (recréer une nouvelle base)
- **Koyeb Free** : 1 service gratuit, ne s'éteint pas
