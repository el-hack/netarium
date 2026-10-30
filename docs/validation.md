# Validation locale — 0.1.0

Environnement vérifié : macOS, Node.js 24, Google Chrome dans un profil isolé.

## Résultats

- 20 tests de domaine, de parsing, d’API, de persistance et de commandes système réussis.
- TypeScript strict, ESLint et formatage Prettier validés.
- Construction de production réussie, avec moteur Three.js chargé à la demande.
- Parcours navigateur réussis : découverte, 3D/2D, édition et conservation des annotations, recherche, comparaison de deux instantanés, réglages persistants, téléchargement CSV et navigation mobile.
- Aucun problème détecté par axe sur les quatre pages et la fiche appareil avec les règles WCAG 2 A/AA et 2.1 AA testées. Cela ne remplace pas une évaluation d’accessibilité humaine complète.
- Absence de débordement de page aux largeurs 320, 375, 768, 1024 et 1440 pixels ; les grandes tables défilent dans leur conteneur.
- Aucune exception JavaScript ni erreur console applicative pendant les tests navigateur. Le rendu logiciel de Chrome en test peut produire des avertissements de pilote GPU.
- Découverte réelle sans Nmap réussie sur le réseau privé connecté : deux appareils observés. Données retrouvées après redémarrage du service.
- Mode développement vérifié dans le navigateur sans erreur applicative.
- Tentative de lancement d’une deuxième instance sur le même dossier refusée par le verrou.
- Audit npm : aucune vulnérabilité connue détectée au moment de la vérification.

## Limites de validation

Nmap n’était pas installé : son parsing XML est testé, mais son exécution réelle n’a pas été vérifiée sur cette machine. Linux, Windows, de grands inventaires et les réseaux multi-VLAN n’ont pas été testés en situation réelle. Les workflows GitHub sont fournis, sans exécution distante ni configuration de protection de branche puisqu’aucun dépôt distant n’a été créé.

Aucune donnée réelle du réseau, base SQLite ou capture privée n’est versionnée dans Git. Les données du collecteur déterministe des tests ne sont jamais injectées dans le service normal.
