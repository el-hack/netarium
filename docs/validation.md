# Validation locale — 0.1.0

Environnement vérifié : macOS, Node.js 24, Google Chrome dans un profil isolé.

## Résultats

- 41 tests de domaine, de parsing, d’API, de persistance, de commandes système et de sélection d’inventaire réussis.
- TypeScript strict, ESLint et formatage Prettier validés.
- Construction de production réussie, avec moteur Three.js chargé à la demande.
- Parcours navigateur réussis : découverte, 3D/2D, édition et conservation des annotations, recherche, filtres, tri, vues liste/cartes, comparaison de deux instantanés, réglages persistants, téléchargement CSV et navigation mobile au clavier (confinement et restitution du focus, Échap). La fermeture d’une fiche modifiée demande de conserver ou abandonner les changements.
- Aucun problème détecté par axe sur les quatre pages en bureau et mobile, ainsi que la fiche appareil sur bureau avec les règles WCAG 2 A/AA et 2.1 AA testées. Cela ne remplace pas une évaluation d’accessibilité humaine complète.
- Absence de débordement de page aux largeurs 320, 375, 768, 1024 et 1440 pixels ; les quatre pages sont également contrôlées à 320 pixels. L’inventaire devient une liste de cartes sur mobile.
- Aucune exception JavaScript ni erreur console applicative pendant les tests navigateur. Le rendu logiciel de Chrome en test peut produire des avertissements de pilote GPU.
- Découverte réelle sans Nmap réussie sur le réseau privé connecté : deux appareils observés. Données retrouvées après redémarrage du service.
- Mode développement vérifié dans le navigateur sans erreur applicative.
- Tentative de lancement d’une deuxième instance sur le même dossier refusée par le verrou.
- Audit npm : aucune vulnérabilité connue détectée au moment de la vérification.

## Refonte de l’interface

Les écrans Observatoire, Appareils, Chronologie et Réglages ont été inspectés visuellement après la refonte, ainsi que l’observatoire mobile. Le réseau réel fournit deux appareils ; le parcours isolé de test couvre cinq appareils avec des états observé, cache et non revu. Les captures finales se trouvent à côté du projet, hors de Git.

## Identification automatique

- Classification conservatrice, conflits, priorité manuelle, compatibilité avec les données antérieures et conservation des instantanés vérifiées.
- Transport mDNS testé avec paquets DNS-SD déterministes : filtrage du périmètre, délai, annulation, erreur et plafond de 128 annonces.
- Parcours navigateur : téléphone probable avec modèle annoncé, correction en tablette, retour au mode automatique, passerelle sans type inventé.
- Collecte réelle sur macOS réussie : annonces mDNS de l’ordinateur reçues ; la passerelle reste inconnue faute d’indices. Aucun téléphone distant n’a été identifié en situation réelle pendant cette validation.
- Audit npm après ajout des dépendances mDNS : aucune vulnérabilité connue détectée.

## Limites de validation

Nmap n’était pas installé : son parsing XML est testé, mais son exécution réelle n’a pas été vérifiée sur cette machine. Linux, Windows, de grands inventaires et les réseaux multi-VLAN n’ont pas été testés en situation réelle. Les workflows GitHub sont fournis, sans exécution distante ni configuration de protection de branche puisqu’aucun dépôt distant n’a été créé.

Aucune donnée réelle du réseau, base SQLite ou capture privée n’est versionnée dans Git. Les données du collecteur déterministe des tests ne sont jamais injectées dans le service normal.
