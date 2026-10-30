# Décisions d’architecture

## 1. Application web locale et monolithe modulaire

Le navigateur gère l’exploration et l’édition ; un processus Node.js local collecte et conserve les observations. Une application web hébergée seule ne permettrait pas cette collecte. Une enveloppe native ajouterait du packaging sans améliorer le premier besoin. Le même service fournit l’interface et l’API, ce qui réduit les problèmes de CORS et de configuration.

React et TypeScript portent les composants et les contrats. Three.js reste isolé derrière une interface de création, recentrage, zoom et libération. Le reste du produit fonctionne sans WebGL. Le rendu est demandé au changement de caméra ou de dimensions, sans boucle permanente. La caméra n’est pas réinitialisée à chaque interrogation de l’API.

## 2. Observation avant interprétation

Une observation contient l’adresse, les identifiants disponibles, sa source et le résultat de la sonde. L’absence de réponse n’est jamais transformée en certitude d’extinction. La table des voisins est une source de cache. La route système sert à reconnaître une passerelle uniquement lorsqu’elle figure dans les observations ; elle ne crée pas un appareil imaginaire.

Les liens graphiques représentent l’appartenance à un périmètre, sans affirmer une topologie physique. Aucun débit ni échange entre appareils n’est simulé.

## 3. Identité et immutabilité

L’identité utilise la MAC dans un périmètre lorsqu’elle existe. Une identité IP sans MAC peut être enrichie lorsqu’une MAC est ensuite découverte. Deux MAC différentes ne sont pas fusionnées à cause d’une réattribution d’IP. Sans MAC, le rapprochement reste provisoire ; les MAC privées et le changement de réseau sont des limites connues.

Les annotations actuelles et l’historique sont séparés. Une transaction SQLite publie les observations, l’instantané et la réussite de la collecte ensemble. Une erreur ou une annulation ne remplace pas le dernier état réussi. Un instantané conserve les annotations de son époque. Au redémarrage, une collecte interrompue est marquée comme échouée.

Le schéma initial est versionné dans la table `migrations`. Toute évolution future doit ajouter une migration transactionnelle explicite, sans modifier silencieusement les tables existantes.

## 4. Collecte bornée

L’API accepte un identifiant d’interface recensée par le système, jamais une cible réseau libre. Le périmètre est privé et limité à 256 adresses. Les processus sont lancés par `execFile`, sans shell. Les commandes ont des délais, une sortie limitée et un signal d’annulation. La découverte ICMP emploie au plus 12 processus simultanés, avec un délai de 1,4 seconde par sonde. Nmap est borné à 90 secondes et ne lance aucun script ni scan de ports.

Un seul scan peut être actif ; les tentatives rapprochées sont limitées. Les erreurs partielles sont expliquées dans les avertissements. La programmation est conservée mais active seulement pendant l’exécution du service. L’historique est soumis à une rétention configurable ; le dernier état réussi de chaque périmètre reste disponible.

## 5. Sécurité et exploitation

Écoute en boucle locale, vérification stricte de Host et Origin, rejet des requêtes API cross-site et en-tête applicatif obligatoire pour les mutations. Aucune permission CORS n’est ouverte. Validation Zod et taille de corps limitée. Le contenu découvert est traité comme une chaîne de texte ; pas d’injection de HTML.

CSP restrictive en production, protection contre l’embarquement, permissions POSIX restrictives pour les données, verrou `proper-lockfile`. Le processus principal ne demande pas les droits administrateur. Les logs HTTP restent locaux et permettent de diagnostiquer les erreurs ; la base et les exports sont exclus de Git.

SQLite évite un serveur externe et fournit des transactions. Le mode WAL et un délai d’attente borné servent les lectures concurrentes ; le verrou empêche deux instances d’écrire dans le même dossier. Arrêt : annuler et attendre le collecteur, fermer le serveur, fermer la base, libérer le verrou.

## 6. Validation et coût accepté

Tests de parsing, périmètre, identité et transactions, tests API avec vraie base SQLite en mémoire, tests navigateur avec vraie API et base temporaire. Le collecteur du test navigateur est déterministe et ne fait pas partie du service de production.

La première plateforme validée est macOS. Les formats de voisinage Linux et Windows sont testés, mais l’exécution sur ces systèmes reste à valider. Un scan réussi ne garantit jamais une couverture complète du réseau. Il n’existe pas encore de découverte IPv6, de source routeur, de capture des flux ou de binaire signé.

## Identification

Le domaine partagé possède les règles et la priorité des annotations. Le collecteur mDNS est isolé de la découverte d’hôtes et ne change pas la preuve de présence. Les indices et la suggestion sont figés au moment de la persistance. Voir [la conception détaillée](identification.md).

## 7. Journal d’intelligence et sources optionnelles

Le module `server/intelligence` sépare collecteurs système, stockage journalisé, orchestration/alertes et routes. Les contrats partagés décrivent provenance, valeurs inconnues et requêtes ; la classification de services par port demeure une inférence faible. Le frontend est organisé en domaines (`features`) et primitives (`ui`), avec séparation de l’état serveur, du contexte URL et des saisies locales.

Deux bases évitent de mêler les instantanés d’identité et le journal volumineux. La migration d’inventaire 2 ajoute les tags transactionnellement, sans réécrire les instantanés historiques. Le journal est recréable à partir de sources conservées seulement dans leurs limites, pas depuis du trafic qui n’a jamais été collecté. Les sorties système brutes ne sont pas archivées afin de minimiser les métadonnées privées.

Les compteurs et sockets nécessitent consentement. Leur configuration est sérialisée ; un seul échantillonnage s’exécute à la fois, les commandes sont bornées, et l’arrêt annule les opérations. L’activation ne persiste pas après redémarrage, contrairement aux observations, seuils, états de traitement et positions. Les requêtes sont paginées et les agrégats calculés par SQLite. Le polling est retenu pour la simplicité d’un service local mono-utilisateur : 5 secondes côté interface, 10 secondes côté collecteurs, aucune infrastructure de streaming externe.

Les identités d’import sont confirmées manuellement ; les événements sont dédupliqués avec une empreinte stable. Les sources ne sont pas agrégées aveuglément : volumes d’interface et flux importés restent distincts. Les agents distants nécessiteront un transport authentifié et une gestion d’identité dédiée avant toute ouverture réseau. Les limites, API et procédures sont détaillées dans [Intelligence](activity-intelligence.md) et [API](api-intelligence.md).
