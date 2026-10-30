# Netarium

**Votre réseau, sous un nouveau jour.**

Netarium est un observatoire local du réseau domestique : découverte réelle, carte 3D, inventaire annotable et historique comparable. L’interface s’ouvre dans votre navigateur ; le service tourne sur votre ordinateur. Aucun compte ni cloud n’est nécessaire.

## Démarrer

Prérequis : **Node.js 24 ou supérieur**, npm, un navigateur avec WebGL 2 et une connexion à un réseau privé IPv4. macOS est la plateforme vérifiée. Les adaptateurs Linux et Windows restent expérimentaux.

```sh
npm ci
npm run build
npm start
```

Ouvrez **http://127.0.0.1:4783**. Sélectionnez une interface puis cliquez sur **Découvrir le réseau**. Aucun scan ne démarre à l’ouverture. Un scan manuel découvre les hôtes du périmètre affiché, sans scan de ports ni déchiffrement du trafic.

Sur macOS, le fichier `Lancer Netarium.command` lance l’installation locale déjà préparée et ouvre le navigateur. Il nécessite également Node.js 24. Sur une nouvelle copie du dépôt, exécutez d’abord les commandes ci-dessus.

### Découverte

- **Nmap, optionnel** : découverte d’hôtes à partir de sa sortie XML structurée, en mode sans privilèges. Sur macOS : `brew install nmap`, puis relancez Netarium.
- **Sans Nmap** : sondes ICMP bornées et consultation de la table des voisins. `ping` doit être disponible ; `arp` ou `ip` enrichit les observations selon le système.
- **Observation locale** : dans Réglages, « Observer le cache local uniquement » lit l’interface et les voisins, sans balayage ICMP/Nmap.

L’application ne demande jamais de lancer tout le serveur en administrateur. Le système ou un pare-feu peut restreindre les sondes ; le diagnostic précise les outils détectés. Des capacités limitées produisent des observations partielles, pas des appareils fictifs.

## Fonctionnalités

- Carte 3D avec rotation, zoom, recentrage et vue de dessus 2D ; chargement du moteur graphique à la demande.
- Inventaire consultable au clavier, recherche insensible aux accents, filtres d’état, tri et vues liste/cartes.
- Fiches avec nom, catégorie et notes personnalisées ; provenance de chaque observation.
- Identité par adresse MAC quand elle est disponible, repli provisoire sur l’IP dans le périmètre.
- Instantané immuable après chaque collecte réussie ; comparaison des nouveaux appareils, absences et changements.
- Collecte manuelle ou programmée, annulation, diagnostic des outils et conservation configurable.
- Exports JSON et CSV avec neutralisation des formules de tableur.
- Interface responsive et prise en compte de la réduction des animations.

### Comprendre les états

| État          | Signification                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Observé       | Présence constatée par l’interface locale ou réponse à une sonde lors du relevé.               |
| Dans le cache | Une entrée de voisinage existe ; elle ne prouve pas une présence actuelle.                     |
| Non revu      | Appareil absent du dernier relevé réussi de ce périmètre. Cela ne prouve pas qu’il est éteint. |

La carte représente **l’appartenance logique à un périmètre**. Elle n’invente ni câblage, ni position physique, ni trafic entre appareils. Les catégories personnalisées sont des annotations manuelles ; une adresse IP sans MAC ne permet pas de garantir une identité physique stable. Les MAC privées ou changeantes peuvent créer plusieurs identités.

## Données et confidentialité

Le service écoute exclusivement sur `127.0.0.1`. Les données SQLite sont conservées dans `.netarium/`, ignoré par Git, avec des permissions restrictives sur les systèmes POSIX. Un verrou empêche deux instances de partager ce dossier. Après un arrêt brutal, le verrou peut nécessiter jusqu’à 10 secondes avant d’être récupérable.

- Aucune télémétrie ni ressource distante n’est chargée par l’interface.
- Les exports contiennent des informations privées sur le réseau. Vérifiez-les avant de les publier.
- La collecte automatique s’arrête quand le service est arrêté ; elle est désactivée par défaut.
- La rétention conserve le dernier instantané réussi de chaque périmètre. Les appareils encore présents dans des instantanés conservés restent dans l’inventaire.
- La chronologie et l’export JSON présentent les **200 dernières collectes**. La rétention s’applique à l’ensemble de la base.

Pour sauvegarder tout l’historique, arrêtez Netarium et copiez le dossier `.netarium/`. Pour repartir de zéro, déplacez ce dossier après l’arrêt du service.

```sh
# Port différent et dossier de données distinct, optionnels
PORT=4785 NETARIUM_DATA_DIR=/chemin/vers/donnees npm start
```

Ne partagez pas le service au moyen d’un proxy public : son modèle d’accès est celui d’une application locale destinée aux utilisateurs de cet ordinateur.

## Développer et vérifier

```sh
npm run dev       # Service local + sources Vite ; recharger après modification du frontend
npm run check     # TypeScript strict
npm run lint      # ESLint
npm run format:check
npm test          # Domaine, SQLite, parsing et sécurité de l’API
npm run build     # Vérification des types + build de production
npm run test:e2e  # Chrome installé sur macOS, ou Chromium Playwright sur les autres systèmes
```

Pour le navigateur des tests : `CHROME_PATH=/chemin/vers/chrome npm run test:e2e`. Sans Chrome système, installez Chromium avec `npx playwright install chromium`. Les tests utilisent une base temporaire et un collecteur déterministe réservé aux tests ; ils ne scannent pas votre réseau. Ils couvrent la découverte, les fiches, la persistance, la comparaison, les réglages, l’export, l’accessibilité automatique et les largeurs de 320 à 1440 pixels.

## Architecture

```text
src/                 React, interface et moteur Three.js isolé
shared/types.ts      Contrats de données et comparaison pure
server/network.ts    Adaptateurs système, parsing et sondes bornées
server/store.ts      SQLite, identité, annotations et instantanés
server/coordinator.ts Cycle de collecte, annulation et programmation
server/app.ts        API locale, validation et frontières de sécurité
server/index.ts      Démarrage, verrou et arrêt propre
```

Voir [les décisions d’architecture](docs/architecture.md), [la sécurité](SECURITY.md) et [le guide de contribution](CONTRIBUTING.md).

## Limites de cette version

- IPv4 privé uniquement ; le périmètre est limité à 256 adresses maximum, au sein du sous-réseau connecté. Un réseau plus grand est réduit au `/24` contenant l’ordinateur, et ce périmètre est affiché.
- Les appareils isolés par un Wi-Fi invité, un VLAN, un pare-feu ou une mise en veille peuvent rester invisibles.
- Aucune capture globale du trafic, mesure de couverture Wi-Fi, identification garantie du système d’exploitation ou exploration de services.
- Le moteur 3D affiche jusqu’à 100 appareils ; l’inventaire conserve tous les appareils connus.
- macOS et Chrome ont été utilisés pour la validation locale ; une matrice système plus large reste à réaliser avant une publication stable.

## Licence

MIT. Le logiciel Nmap, lorsqu’il est installé séparément, conserve sa propre licence et n’est pas redistribué dans ce projet.
