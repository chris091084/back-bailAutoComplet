package Back.bailAutoComplet.BailAutoComplet.Service;

import Back.bailAutoComplet.BailAutoComplet.Dto.IrlDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Récupère la dernière valeur de l'IRL (Indice de Référence des Loyers) publiée
 * par l'INSEE via le service web SDMX public de la BDM (Banque de Données
 * Macroéconomiques). Aucune clé API n'est nécessaire pour cet endpoint.
 *
 * La valeur est mise en cache en mémoire : l'IRL n'étant publié qu'une fois par
 * trimestre, on évite d'interroger l'INSEE à chaque appel.
 */
@Service
public class IrlService {

    private static final Logger log = LoggerFactory.getLogger(IrlService.class);

    @Value("${insee.bdm.base-url:https://www.bdm.insee.fr/series/sdmx/data/SERIES_BDM}")
    private String baseUrl;

    @Value("${insee.irl.idbank:001515333}")
    private String idbank;

    @Value("${insee.irl.cache-ttl-hours:6}")
    private long cacheTtlHours;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private volatile IrlDto cachedIrl;
    private volatile Instant cachedAt;

    /**
     * @return la dernière valeur IRL disponible, ou {@link Optional#empty()} si
     * l'INSEE est injoignable ou la réponse illisible (l'appelant conserve
     * alors la valeur déjà stockée).
     */
    public Optional<IrlDto> getLatestIrl() {
        IrlDto cached = cachedIrl;
        if (cached != null && cachedAt != null
                && cachedAt.isAfter(Instant.now().minus(Duration.ofHours(cacheTtlHours)))) {
            return Optional.of(cached);
        }

        try {
            Optional<IrlDto> fresh = fetchLatestIrl();
            fresh.ifPresent(irl -> {
                cachedIrl = irl;
                cachedAt = Instant.now();
            });
            // En cas d'échec ponctuel, on renvoie l'éventuelle valeur en cache (même expirée).
            return fresh.isPresent() ? fresh : Optional.ofNullable(cached);
        } catch (Exception e) {
            log.warn("Impossible de récupérer l'IRL depuis l'INSEE : {}", e.getMessage());
            return Optional.ofNullable(cached);
        }
    }

    private Optional<IrlDto> fetchLatestIrl() throws Exception {
        // On limite la fenêtre aux 3 dernières années pour une réponse légère.
        String url = baseUrl + "/" + idbank + "?startPeriod=" + (Instant.now().atZone(java.time.ZoneOffset.UTC).getYear() - 2);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/xml")
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            log.warn("L'INSEE a répondu avec le code HTTP {}", response.statusCode());
            return Optional.empty();
        }

        return parseLatestObservation(response.body());
    }

    /**
     * Parse la réponse SDMX (StructureSpecificData) et retourne l'observation la
     * plus récente. Les {@code <Obs>} portent les attributs {@code TIME_PERIOD}
     * (ex. "2026-Q1") et {@code OBS_VALUE} (ex. "146.6").
     */
    private Optional<IrlDto> parseLatestObservation(byte[] body) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        // Durcissement anti-XXE : on ne lit que des données, pas d'entités externes.
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setNamespaceAware(true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(body));

        NodeList obsNodes = doc.getElementsByTagNameNS("*", "Obs");
        String bestPeriod = null;
        String bestValue = null;
        for (int i = 0; i < obsNodes.getLength(); i++) {
            Element obs = (Element) obsNodes.item(i);
            String period = obs.getAttribute("TIME_PERIOD");
            String value = obs.getAttribute("OBS_VALUE");
            if (period.isEmpty() || value.isEmpty()) {
                continue;
            }
            // Le format "YYYY-Qn" se trie correctement en ordre lexicographique.
            if (bestPeriod == null || period.compareTo(bestPeriod) > 0) {
                bestPeriod = period;
                bestValue = value;
            }
        }

        if (bestPeriod == null) {
            log.warn("Aucune observation IRL trouvée dans la réponse de l'INSEE");
            return Optional.empty();
        }

        return Optional.of(new IrlDto(bestValue, formatTrimestre(bestPeriod)));
    }

    /**
     * Transforme une période SDMX "2026-Q1" en libellé de trimestre "T1 2026".
     */
    private String formatTrimestre(String timePeriod) {
        String[] parts = timePeriod.split("-Q");
        if (parts.length == 2) {
            return "T" + parts[1] + " " + parts[0];
        }
        return timePeriod;
    }
}
