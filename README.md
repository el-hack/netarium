# Netarium

Un observatoire réseau **local-first**, open source, pour explorer les appareils et comprendre les observations réellement disponibles. Interface en français, deux thèmes, aucun compte cloud.

Netarium distingue **Network Intelligence** (découverte, DNS et flux déclarés) et **Device Intelligence** (processus/sockets de cet ordinateur avec consentement). Aucune application ni consommation n’est inventée à partir d’un scan.

## Lancer localement

Prérequis : Node.js **24 ou plus récent**, npm. Depuis le dossier du projet :

```sh
npm ci
npm run build
npm start
```

Ouvrir **http://127.0.0.1:4783**. En développement : `npm run dev`.

Sur macOS, `Lancer Netarium.command` ouvre l’application déjà installée. Nmap est optionnel (`brew install nmap`) ; sans lui, la découverte utilise ICMP et la table des voisins. Ne pas lancer le serveur en administrateur.

## Explorer

- **Overview** : état des sources, inventaire, dernière mesure locale et observations récentes.
- **Network Explorer** : carte 3D à la demande, véritable alternative SVG 2D sans WebGL, positions persistantes, recherche, catégories, instantanés et accès aux fiches/activité.
- **Activity Explorer** : vue générale, applications observées, domaines DNS, connexions filtrées/paginées, bande passante et chronologie. Provenance consultable sur chaque observation.
- **Devices** : identification prudente et explicable, choix manuel, tags, notes, historique IP, recherche, tri, pagination, vues liste/cartes et exports.
- **Traffic Analytics** : volumes et pics locaux, couverture temporelle, période précédente, classement mesuré, DNS et flux par protocole séparés.
- **Network Timeline** : journal et comparaison des instantanés immuables.
- **Security & Alerts** : changements, seuil configurable, traitement, déduplication et silence temporaire.
- **Data Sources** : consentement, arrêt des collecteurs, imports DNS/flux, erreurs, dernières synchronisations et matrice des capacités par appareil.
- **Settings** : fréquence de découverte, rétention, diagnostic, export et suppression explicite du journal.

Recherche globale avec **⌘ K / Ctrl K**, contexte dans l’URL, thèmes sombre/clair et menu mobile au clavier. **Explorer la démo** ouvre une simulation isolée ; aucune donnée fictive n’est insérée dans votre base et aucune requête API réelle n’est envoyée dans ce mode.

## Sources opérationnelles et limites

| Source                                                                    | Disponible            | Ce qu’elle apporte                                                   |
| ------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| Découverte locale                                                         | Oui                   | Appareils, IPv4/MAC disponibles, noms, indices mDNS                  |
| Compteurs d’interface                                                     | macOS/Linux           | Octets et débits de cet ordinateur, après activation                 |
| Agent intégré                                                             | macOS/Linux + `lsof`  | Processus et sockets accessibles à l’utilisateur, après consentement |
| DNS                                                                       | Import JSON normalisé | Domaines et horodatages, associés à un appareil explicitement        |
| Flux                                                                      | Import JSON normalisé | Endpoints, protocoles et volumes déclarés                            |
| Routeur, NetFlow/IPFIX natif, capture de paquets, agents distants/Windows | Non intégrés          | Extensions progressives documentées et annoncées comme indisponibles |

Une machine connectée au Wi-Fi ne voit pas automatiquement le trafic des autres appareils. Les compteurs d’interface ne mesurent pas le LAN entier. Les octets par application sont **non mesurés**. Une requête DNS ne prouve pas une visite web. Les services déduits d’un port sont seulement possibles. Les liens de carte représentent l’appartenance au périmètre, pas des câbles ou des échanges mesurés.

L’identification automatique utilise des indices déclarés, jamais une certitude arbitraire. « Observé » signifie constaté au relevé ; « Dans le cache » ne garantit pas la présence ; « Non revu » ne prouve pas une extinction. Les MAC privées peuvent créer plusieurs identités.

## Confidentialité

Serveur limité à `127.0.0.1`, garde Host/Origin, mutations identifiées, aucune télémétrie ni ressource externe. Bases locales `.netarium/netarium.sqlite` et `.netarium/activity.sqlite`, ignorées par Git, dossier privé et verrou contre les instances concurrentes. Pas de chiffrement au repos intégré.

Les deux collecteurs d’activité sont **désactivés par défaut et à chaque redémarrage**. Activation explicite dans Data Sources, arrêt immédiat, suppression du journal avec confirmation dans Settings. Aucun contenu de paquet, interception TLS, historique navigateur ou agent caché. Utiliser sur les équipements/réseaux que vous administrez légitimement.

La rétention purge les observations ; le dernier instantané de chaque réseau est conservé. Les exports peuvent contenir des métadonnées privées. L’export d’activité est limité à 1 000 observations et indique sa troncature. L’inventaire JSON/CSV reste exportable séparément.

## Développement et documentation

```sh
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
npm run format:check
```

Les tests navigateur utilisent un collecteur déterministe, une base temporaire et Chrome isolé. Ils ne modifient pas votre réseau. `CHROME_PATH` permet de choisir l’exécutable Chrome ; le moteur Playwright doit être disponible si aucun chemin n’est fourni sous Linux.

- [Architecture et choix](docs/architecture.md)
- [Intelligence, agent, confidentialité et limites](docs/activity-intelligence.md)
- [API d’intelligence](docs/api-intelligence.md)
- [Identification des appareils](docs/identification.md)
- [Design system](docs/design.md) · [Référence Trovy et décisions de refonte](docs/redesign-trovy.md)
- [Validation et limites de test](docs/validation.md)
- [Audit avant refonte](docs/audit-intelligence.md)
- [Contribution](CONTRIBUTING.md) · [Sécurité](SECURITY.md) · [Licence MIT](LICENSE)

Le produit couvre une chaîne locale complète de collecte, stockage, requête et exploration pour les sources annoncées comme fonctionnelles. Il ne constitue ni une sonde réseau universelle, ni un outil de détection d’intrusion certifié.
