# Network & Device Intelligence — 0.2.0

## Périmètre livré

Netarium conserve un monolithe modulaire local : React présente les observations, Fastify valide les commandes, SQLite conserve inventaire et journal. Il ne prétend pas observer tout un LAN depuis une seule machine Wi-Fi.

| Source                            | Fonctionnelle           | Données                                                      | Limites                                                                                                                    |
| --------------------------------- | ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Local Discovery                   | Oui                     | Interface locale, voisins, réponses ICMP/Nmap, annonces mDNS | IPv4 privé, maximum 256 adresses ; aucun scan de ports                                                                     |
| Compteurs d’interface             | macOS/Linux             | Deltas d’octets et débits de cet ordinateur                  | Aucun volume par processus ; pas de mesure des autres appareils                                                            |
| Device Agent intégré              | macOS/Linux avec `lsof` | Processus/PID, sockets, IP, ports, protocole, état           | Seulement les sockets visibles à l’utilisateur, associés à une interface IPv4 connue ; ni contenu, ni octets par processus |
| DNS Observation                   | Import JSON             | Domaines et heures déclarés                                  | Pas de connecteur résolveur natif, pas de preuve de visite                                                                 |
| Flow Collector                    | Import JSON normalisé   | IP, ports, protocole, volumes déclarés                       | Pas de récepteur UDP NetFlow/IPFIX ni de décodage de leurs formats                                                         |
| Router Integration                | Non intégré             | —                                                            | Connecteur propre au routeur à développer                                                                                  |
| Packet Metadata Collector         | Non intégré             | —                                                            | Aucun paquet capturé                                                                                                       |
| Agents distants, Windows, mobiles | Non intégrés            | —                                                            | Transport authentifié et adaptations système à développer                                                                  |

## Activation de l’agent

1. Installer et lancer Netarium avec Node.js 24 (`npm ci`, `npm run build`, `npm start`).
2. Découvrir l’interface de cet ordinateur pour établir son identité locale.
3. Ouvrir **Data Sources**, puis **Configurer** sur l’agent ou les compteurs.
4. Lire le périmètre de collecte et cliquer **J’autorise la collecte sur cet ordinateur**.
5. Ouvrir **Activity Explorer** pour cet ordinateur. Les sockets sont échantillonnés toutes les 10 secondes. Le débit nécessite deux relevés.

Aucun service système caché ni installation distante : l’agent est un module du processus Netarium. Il s’arrête avec l’application et doit être réactivé après redémarrage. **Arrêter** désactive le collecteur immédiatement ; le journal reste disponible. **Settings → Supprimer le journal d’activité** arrête les deux collecteurs et efface observations/alertes après confirmation. La désinstallation de Netarium supprime le code ; supprimer aussi son dossier de données si l’on souhaite effacer les bases. Ne pas supprimer une base pendant que le serveur tourne.

`lsof` doit être accessible dans PATH. Aucune élévation de privilèges automatique. Les sockets wildcard, loopback, IPv6 non rattachables à une interface inventoriée, processus d’autres comptes et sockets éphémères entre deux relevés peuvent être absents. Une absence de ligne ne prouve pas l’absence d’activité. Le compteur réseau n’est pas une mesure de débit Internet ou de la capacité de la connexion.

## Ingestion et provenance

Une observation contient : identifiant, identité explicite d’appareil, type, temps observé, fin éventuellement déclarée, endpoints, métriques nullable, état, détail, et provenance `{sourceId, sourceKind, collectedAt, precision, confidence, expiresAt}`.

- Les collecteurs système lisent des sorties bornées avec délai et annulation. Les sorties brutes privées ne sont pas archivées ; seules les métadonnées normalisées utiles sont conservées.
- Les imports sont limités à 1 Mo et 500 lignes, JSON strict, dates normalisées UTC, IP/ports/volumes validés. L’utilisateur choisit et confirme l’identité de l’appareil ; aucune fusion par IP historique.
- L’empreinte SHA-256 du contenu normalisé, de la source et de l’identité rend les imports identiques idempotents. Une ligne déjà reçue ne remplace jamais la preuve initiale.
- Un import DNS n’identifie pas une application. Un port conventionnel donne seulement un **service possible**, explicitement présenté comme un indice faible.
- Les relevés d’agent et d’interface ont une validité de fraîcheur de 30 secondes. Ils restent des observations historiques après expiration. L’interface ne les présente pas comme des connexions actuellement actives.
- Les métriques absentes sont `null`. Un zéro est une mesure explicite. Les directions entrante et sortante conservent indépendamment leurs valeurs inconnues.

L’association agent → appareil nécessite simultanément rôle local, IP de l’interface actuelle et périmètre correspondant. Les imports ne peuvent pas injecter de noms de processus ou falsifier leur provenance.

## Analyses et chronologie

Le journal est indexé par appareil et temps. Les API paginent à 200 lignes par défaut (maximum 1 000), avec total et troncature. Les tables Applications/Domaines agrègent la **page affichée**, pas un historique infini. Les filtres sont dans l’URL : appareil, onglet, période, recherche, protocole, source et port distant. Les statistiques d’analyse sont agrégées côté SQLite sur la période complète conservée.

Les compteurs d’interface et les flux déclarés restent séparés. Aucun total « réseau entier » n’est fabriqué. Les octets d’un intervalle sont attribués à son début, sans prorata inventé aux frontières de période. Les volumes des deux périodes sont accompagnés du nombre d’intervalles/couverture : comparer des couvertures différentes nécessite de la prudence. Les graphiques affichent jusqu’à 120 intervalles sur un axe temporel ; chaque intervalle est dessiné indépendamment, sans ligne dans les interruptions. Les données conservées peuvent couvrir une partie seulement de la période demandée.

Découverte : première observation conservée, changement d’IP, nouveau service annoncé et absence au relevé suivant. Une absence ne prouve pas une déconnexion, un service annoncé ne prouve pas un port exposé. Les instantanés historiques restent immuables et comparables. Le journal reconstruit les 200 dernières collectes disponibles au premier accès ; il ne reconstitue pas les périodes antérieures absentes.

Alertes : première observation, changement d’adresse, nouveau service annoncé, nouveau domaine importé, seuil de débit local configurable et erreurs de collecteur. Déduplication persistante, traitement/réouverture, silence d’une heure. Maximum 500 alertes récentes dans l’interface. Les seuils sont conservés dans SQLite. Les dépassements sont dédupliqués par appareil et heure. La détection statistique de comportement et la classification exhaustive des services ne sont pas intégrées.

## Stockage et cycle de vie

- `netarium.sqlite` : identités, annotations, tags (migration 2), collectes, instantanés et réglages.
- `activity.sqlite` : journal, provenance, sources, alertes, seuil, positions de carte et collectes déjà traitées.
- WAL, transactions d’ingestion, index temporels, requêtes paramétrées, validation des entrées, boucle locale unique, exécution des configurations sérialisée, annulation à l’arrêt.
- Conservation du journal selon `retentionDays`. Purge lors des lectures et cycles de collecte. La suppression du journal garde les marqueurs de collectes déjà traitées pour éviter de recréer immédiatement les anciennes observations supprimées.
- La base n’est pas chiffrée au repos. Permissions du dossier 0700 et fichiers privés via umask 077 ; protéger également l’ordinateur et ses sauvegardes.

Le polling de l’interface est de 5 secondes, suspendu dans les onglets masqués ; les collecteurs tournent toutes les 10 secondes. Un rafraîchissement conserve les formulaires et messages. Les modifications de contexte annulent les requêtes précédentes.

## Carte, accessibilité et démo

Les liens matérialisent uniquement l’appartenance au périmètre inventorié. Ils ne représentent ni câblage, ni communication mesurée. Positions persistantes allouées sans déplacer les identités existantes ; déplacement dans la vue SVG 2D à la souris ou avec les flèches. La vue 3D se charge à la demande et libère ressources, observateurs et écouteurs ; la 2D fonctionne sans WebGL. Maximum 100 nœuds graphiques, inventaire paginé à 50.

La démo est un module de données en mémoire du navigateur. Bandeau permanent, aucune API appelée, mutations et exports réels désactivés. Elle couvre appareils, carte, processus, domaines, débits, alertes et timeline. La comparaison de plusieurs instantanés simulés n’est pas fournie : ce parcours est opérationnel et testé sur les collectes réelles/collecteur de test.

Thèmes sombre/clair, navigation au clavier, focus des dialogues, retour du focus du menu mobile, réduction des animations et provenance ouvrable au clavier. Les contrôles automatiques axe ne constituent pas une certification WCAG.
