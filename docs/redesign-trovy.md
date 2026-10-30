# Contrat de refonte — langage visuel Trovy

Référence inspectée : application locale Trovy, `src/styles/globals.css`,
`tailwind.config.ts`, primitives Button et structures SidebarFrame,
NavigationLink, AppCanvas, Topbar et DashboardLayout/DashboardCards.

## Décisions

- Conserver les composants React et feuilles CSS modulaires de Netarium :
  migrer vers Next/Tailwind ne contribuerait pas à cette refonte visuelle.
- Reprendre les surfaces neutres de Trovy, le bleu d’action, la sélection
  neutre et les états sémantiques indépendants. Aucune couleur de statut
  ne sert de décoration. Les graphiques ont leurs propres séries.
- Navigation de 248 px, espace principal encadré et arrondi, barre de
  contexte discrète. La page sert à examiner des observations ; la
  découverte reste l’action principale, avec consentements inchangés.
- Titres 28 px, texte courant 14 px, informations denses 12–13 px,
  chiffres tabulaires, traits d’icône fins, rayons 8/12/16 px.
- Indicateurs séparés, panneaux de données structurés, listes sobres,
  formulaires lisibles et dialogues cohérents. Aucun faux graphique ni
  compteur ajouté pour meubler un état vide.
- Nouveau navigateur : thème clair ; préférence existante conservée.
  Mode sombre équivalent et navigation mobile accessible dès 320 px.
- Adapter la structure à Netarium sans importer les composants métier,
  la marque ni les fichiers de police Trovy. Gellix est livré en version
  TRIAL réservée à l’usage personnel : utiliser la pile système pour la
  distribution open source, sans requête externe.

## Vérification attendue

Parcours existants, conservation des données et réglages, démo isolée,
9 pages dans les deux thèmes, cartes 2D/3D, contrôles clavier, contrastes
axe, absence de débordement à 320/375/768/1024/1440 px, inspection visuelle
des écrans Overview, Activity Explorer, inventaire et carte.
