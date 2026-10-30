# Changelog

## Unreleased

### Added

- Identification automatique explicable à partir des noms et annonces Bonjour/mDNS, avec confiance qualitative et indices conservés.
- Distinction entre type matériel et rôle de passerelle, catégories tablette et imprimante, correction manuelle prioritaire et retour au mode automatique.
- Collecte mDNS bornée et annulable ; conservation des anciens instantanés et colonnes d’identification dans l’export CSV.

### Changed

- Refonte de l’ensemble des écrans : palette ivoire et sauge, hiérarchie, espacements et contrastes.
- Carte 3D avec modèles d’appareils, anneaux discrets et cadrage adaptatif.
- Inventaire en liste ou cartes, recherche insensible aux accents et tri par nom, IP ou date.
- Navigation mobile accessible au clavier, inventaire en cartes et formulaires adaptés.
- Protection des modifications non enregistrées dans les fiches et état de sauvegarde des réglages.
- Historique limité au réseau sélectionné et comparaison avec un instantané distinct.

## 0.1.0 — 2026-10-30

### Added

- Observatoire local avec découverte IPv4 réelle et carte 3D/2D.
- Inventaire annotable, recherche et provenance des observations.
- Historique persistant, instantanés immuables et comparaison.
- Programmation, annulation, rétention et diagnostic des outils.
- Exports JSON et CSV, sans compte ni cloud.
- Tests de domaine, d’API, de navigateur et d’accessibilité automatisée.

### Known limitations

- macOS vérifié ; Linux et Windows expérimentaux.
- IPv4 privé uniquement, 256 adresses maximum par collecte.
- Les positions et liens sont logiques ; pas de capture globale du trafic.
