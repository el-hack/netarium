# Audit avant refonte — Network & Device Intelligence

Base : commit b884506. Monolithe Fastify/React/SQLite, 41 tests, découverte ICMP/Nmap/mDNS bornée, identités MAC/IP prudentes, annotations et instantanés conservés. Aucun compteur de trafic, DNS observé, connexion par processus ou agent n’existe avant cette évolution.

## Constats

- `App.tsx` concentre navigation, collecte, sélection et composition ; quatre pages seulement, aucun état d’URL.
- Couleurs et tailles dispersées dans sept feuilles CSS, thème unique, composants visuellement similaires, carte mêlée à l’accueil.
- Positions 3D dérivées de l’ordre des appareils : l’ajout d’une identité peut déplacer les autres. La vue 2D reste dépendante de WebGL.
- SQLite dispose d’une migration initiale et de JSON d’observation ; il faut un journal d’activité distinct, indexé et idempotent.
- L’historique conserve des instantanés de découverte, pas des sessions ni des mesures. Une absence de réponse ne prouve pas une déconnexion.
- Les interfaces et la table des voisins ne donnent pas le trafic des autres équipements. La détection d’applications exige une source par processus ou un agent autorisé.
- API protégée contre les requêtes intersites et DNS rebinding, aucune cible réseau libre ; conserver ces garanties.

## Décisions

Monolithe modulaire maintenu. Journal normalisé avec provenance et rattachement explicite d’identité ; services métier distincts pour collecteurs, ingestion, agrégations, alertes et visibilité. Pas de microservice, capture TLS ou agent distant installé implicitement.

Premières sources opérationnelles : découverte existante, compteurs locaux d’interface macOS/Linux, observateur de connexions local macOS/Linux activé explicitement, import DNS structuré et flux normalisés. Les connecteurs routeur, NetFlow/IPFIX UDP, capture de paquets et agents distants resteront annoncés comme non intégrés tant qu’ils ne sont pas implémentés. Les imports nécessitent un appareil connu explicite ; aucune fusion basée uniquement sur une IP historique.

Design contract : navigation latérale compacte, barre de contexte persistante, compositions denses propres à chaque écran, surfaces graphite et accent menthe fonctionnel, typographie système, tables bordées discrètement, provenance accessible. Mode clair équivalent, pas de gradient décoratif ni d’animation de trafic synthétique. La démo est un jeu isolé en mémoire avec bandeau permanent.
