# Validation locale — 0.2.0

Vérifié le 30 octobre 2026 sur macOS, Node.js 24 et Google Chrome avec profil isolé.

## Refonte Trovy — validation supplémentaire du 30 octobre 2026

- Build de production, TypeScript strict, ESLint et 58 tests Node validés après refonte.
- Nouveau passage complet des parcours navigateur : 28 audits axe, neuf vues dans les deux thèmes et sur mobile, cinq largeurs 320/375/768/1024/1440 px. Aucun problème détecté, aucune exception JavaScript ni erreur console.
- Le test sélectionne et vérifie explicitement chaque thème : le nouveau défaut clair ne peut pas masquer l’absence d’un passage sombre.
- Inspection visuelle des captures Overview clair/sombre, Activity Explorer, inventaire, carte 3D et écran mobile. Cartes, listes, filtres et formulaires utilisent le nouveau système.
- Onglet réel rechargé : préférence sombre conservée, inventaire et anciennes mesures toujours présents. Aucun redémarrage du serveur ni changement de configuration des collecteurs nécessaire.
- Captures et archive actualisées, uniquement avec données de démonstration pour les images distribuées.

## Résultats fonctionnels de la version 0.2.0

- TypeScript strict, ESLint, Prettier et build de production validés.
- 58 tests Node réussis : protections d’API, découverte, identité et classification, persistance, tags/migration, parsing mDNS/lsof/compteurs, limites des commandes, journal idempotent, filtres, provenance, valeurs inconnues, consentement, désactivation, agrégats séparés, positions, redémarrage, rétention et suppression du journal.
- Parcours navigateur avec API réelle et collecteurs déterministes : onboarding, découverte, identification du téléphone, correction manuelle, tags, édition et persistance, recherche, 3D/2D, déplacement clavier persistant, navigation vers l’activité, consentement, observation de processus, import DNS, provenance, connexions, arrêt du collecteur, comparaison d’instantanés, traitement d’alerte, confirmation de suppression (sans suppression), palette de commandes, protection des modifications non enregistrées.
- Démo parcourue sans **aucune requête vers `/api`** : neuf sections, données simulées clairement indiquées, pas d’écriture réelle. Aucun état de découverte réelle n’est affiché dans la démo.
- 28 audits axe : neuf pages dans les deux thèmes, neuf pages mobiles, fiche appareil. Aucune anomalie détectée avec les règles WCAG 2 A/AA, 2.1 AA et 2.2 AA testées. Cela ne constitue pas une certification ni un remplacement d’un audit humain.
- Pas de débordement de page à 320, 375, 768, 1 024 et 1 440 px sur les neuf pages. Les tableaux larges défilent dans leur propre conteneur.
- Menu mobile : confinement et restitution du focus, fermeture par Échap. Aucune exception JavaScript ou erreur console applicative sur le parcours.
- Rendu 3D chargé à la demande et sans boucle permanente. Étiquettes positionnées sans chevauchement avant d’être rendues visibles. Vue SVG utilisable sans WebGL.

## Vérifications réelles

- Collecte réelle ICMP/mDNS déjà validée lors de la version précédente ; inventaire et annotations existants conservés après mise à jour. Sauvegarde SQLite cohérente créée avant redémarrage.
- Lecture réelle de deux compteurs macOS sur `en0`, intervalle d’environ 1 seconde : compteurs entiers valides et deltas cohérents. Ces mesures ponctuelles n’ont pas été injectées dans le journal.
- Service de production relancé sur `127.0.0.1:4783`, nouvelles API accessibles. Compteurs et agent laissés désactivés ; aucune collecte réelle de processus lancée pendant cette validation.
- Interface réelle inspectée dans le navigateur de l’utilisateur ; périmètre et données de découverte conservés, débits absents explicitement affichés.

## Limites

L’agent lsof est testé avec sorties et collecteur déterministes ; son observation réelle n’a pas été activée sans consentement utilisateur. Linux et Windows ne sont pas validés sur machine réelle. Nmap n’est pas installé ici : parsing testé, exécution non validée. La charge prolongée, les grandes bases, les interfaces multiples en collecte simultanée, les lecteurs d’écran et tous les modes de panne restent à éprouver.

Le mode démo illustre les sources déjà modélisées ; les connecteurs routeur, NetFlow/IPFIX natif, capture de paquets, agents distants/Windows et analyse statistique comportementale ne sont pas intégrés. La consommation par application reste inconnue. Le journal est borné dans le temps et les requêtes paginées, mais aucun benchmark de plusieurs millions d’événements n’est revendiqué.

Les captures de démonstration et l’archive du code sont placées à côté du projet. Bases, données réseau réelles, sauvegarde privée, dépendances installées et captures privées sont exclues de Git et de l’archive source.
