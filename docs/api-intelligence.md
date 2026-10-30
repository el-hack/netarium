# API locale d’intelligence

Base : `http://127.0.0.1:4783/api`. JSON. Même politique Host/Origin que la découverte ; mutations avec `X-Netarium-Client: 1`, origine locale lorsqu’elle est envoyée. Aucune exposition réseau distante ni authentification pour un agent distant n’est fournie.

| Méthode | Route                  | Contrat                                                                                                                                                                                       |
| ------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/intelligence`        | `network`, `deviceId`, `kind`, `since`, `until`, `search`, `protocol`, `source`, `remotePort`, `offset`, `limit` ; journal, total, troncature, sources, alertes, couverture historique, seuil |
| GET     | `/analytics`           | `network`, `since`, `until` obligatoires ; agrégats d’interfaces, flux séparés par protocole, 20 domaines principaux                                                                          |
| POST    | `/sources/local`       | `{kind:"interface" ou "agent",enabled:boolean,consent:boolean}` ; activation refusée sans consentement explicite                                                                              |
| POST    | `/activity/import`     | `{deviceId,kind:"dns" ou "flow",records:[…]}` ; nombre inséré, doublons ignorés                                                                                                               |
| GET     | `/activity/export`     | `deviceId`, `since` optionnels ; JSON versionné, 1 000 lignes maximum, indicateur `truncated`                                                                                                 |
| DELETE  | `/activity`            | `{confirm:"DELETE_ACTIVITY"}` ; arrêt des collecteurs, suppression journal/alertes                                                                                                            |
| PATCH   | `/alerts/:id`          | `{status:"open" ou "acknowledged",mutedUntil:date ISO ou null}`                                                                                                                               |
| PUT     | `/alerts/threshold`    | `{mbps:number}` entre 1 et 100 000 ; seuil persistant                                                                                                                                         |
| GET     | `/layout`              | Positions `{deviceId:{x,y}}` persistantes, allocation des nouveaux appareils                                                                                                                  |
| PUT     | `/layout/:id`          | `{x,y}` entre -20 et 20 ; identité connue obligatoire                                                                                                                                         |
| GET     | `/devices/:id/history` | Jusqu’à 200 relevés `{timestamp,ip}` des instantanés conservés                                                                                                                                |
| PATCH   | `/devices/:id`         | Contrat existant `{label,category,notes}` + `tags?:string[]` (12 maximum, 30 caractères par tag)                                                                                              |

`kind` : `discovery`, `connection`, `dns`, `bandwidth`. `source` : `discovery`, `interface`, `agent`, `dns-import`, `flow-import`. Protocole : TCP, UDP, ICMP. Temps ISO 8601 avec fuseau, normalisé UTC ; l’analyse utilise `[since,until)`. Les observations paginées acceptent aussi une borne supérieure inclusive `until`.

L’objet `records` d’un import accepte uniquement :

```json
[
  {
    "timestamp": "2026-10-30T12:00:00Z",
    "endAt": "2026-10-30T12:01:00Z",
    "localIp": "192.168.1.10",
    "remoteIp": "203.0.113.10",
    "localPort": 51000,
    "remotePort": 443,
    "protocol": "TCP",
    "bytesOut": 2048
  }
]
```

Pour DNS, `domain` est obligatoire, `timestamp` obligatoire, autres valeurs facultatives. Un domaine n’est pas une URL ; URL et champs supplémentaires refusés. Les volumes DNS restent inconnus même si l’import fournit des octets. Pas de champ processus accepté. Les dates plus de 5 minutes dans le futur ou les fins antérieures au début sont refusées. Les imports de flux restent des données déclarées, non vérifiées auprès de la destination.

Réponses : validation 400, protection d’origine 403, identité/alerte absente 404 selon la route, conflits de découverte 409. Les erreurs d’un collecteur activé apparaissent dans son état et n’entraînent pas une escalade de privilèges. Les API sont destinées au client local ; un connecteur tiers doit respecter les mêmes limites et la confirmation de l’utilisateur.
