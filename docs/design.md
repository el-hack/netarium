# Design system Netarium — référence Trovy

Langage adapté depuis les composants et tokens de l’application Trovy : surfaces neutres, sélection grise, bleu pour les actions et interactions, états sémantiques distincts. Netarium conserve ses composants, sa marque et sa logique métier. Le [contrat de refonte](redesign-trovy.md) documente les références et arbitrages. Aucun composant métier Trovy n’est importé. La police Gellix TRIAL étant réservée à l’usage personnel, la distribution open source conserve une pile de polices système, sans chargement externe.

## Système

`src/styles/tokens.css` centralise fond, surfaces, champs, texte, bordures, action primaire, lien, focus, succès, avertissement, erreur et séries de graphiques. Le bleu plein `#0063e6` garde un libellé blanc ; les liens prennent un bleu plus clair en mode sombre pour conserver leur contraste. Le succès dispose de sa propre couleur verte. Les deux thèmes utilisent les mêmes composants. Échelle d’espacement 4–48 px, rayons 8/12/16 px, transition d’opacité 150 ms ; les géométries de carte/graphiques disposent de leurs unités propres. Titres 28 px, texte courant 14 px, données compactes 12–13 px, chiffres tabulaires. Les matériaux Three.js lisent les tokens et suivent le thème sans recréer la scène.

Les feuilles séparent tokens, structure, présentation des données, formulaires, carte et adaptations. La refonte remplace les règles existantes, sans feuille de surcharge ni nouveau framework. Primitives React : Panel, Metric, Empty, Skeleton, SourceBadge/Provenance, Modal, TrafficChart.

Les contrôles partagés `Button`, `IconButton` et `SearchField` définissent les états occupé/désactivé, les noms accessibles et l’effacement avec restitution du focus. Un bouton est de type `button` par défaut ; les soumissions optent explicitement pour `submit`. La normalisation de recherche est commune à l’inventaire, la carte et la palette. La palette est séparée de la structure de navigation pour conserver une responsabilité unique.

- **Structure** : navigation de 248 px (220 px en largeur intermédiaire), trois groupes, espace principal encadré et arrondi, recherche globale et contexte réseau/période conservé dans l’URL. Thème clair pour les nouvelles installations, préférence déjà enregistrée conservée. La couleur de la barre système suit le thème.
- **Overview** : bande de visibilité, indicateurs séparés, graphique et état des sources, puis observations et inventaire. Aucun score arbitraire de santé.
- **Network Explorer** : surface de carte, contrôles, filtre d’identité, inspecteur latéral et sélection historique. Liens explicités ; accès direct à l’activité.
- **Activity Explorer** : identité en tête, onglets d’analyse, provenance et tables spécialisées. Les domaines, processus et octets gardent des unités distinctes.
- **Data Sources** : lignes détaillées avec permissions, capacités, limites et état ; matrice par appareil ; import guidé et extensions non intégrées clairement étiquetées.
- **Alertes et chronologie** : listes orientées examen et navigation, seuils expliqués, aucune esthétique alarmiste.

## Interaction et accessibilité

Les dialogues utilisent `<dialog>` et son confinement natif du focus. Le menu mobile confine/restaure le focus, rend le contenu inerte et se ferme avec Échap. La palette est accessible par bouton ou ⌘/Ctrl K. Le lien d’évitement cible le contenu sans effacer la navigation par URL.

La palette propose un état vide explicite, un compte de résultats, le parcours par flèches, Début/Fin et Entrée, puis restitue le focus à son déclencheur à la fermeture. Les raccourcis ne perturbent pas la composition de texte. Les cartes d’inventaire affichent tags et dernier relevé, avec des actions distinctes pour la fiche et l’activité. Changer la recherche, le filtre ou le tri ramène la pagination à la première page. La synthèse d’activité montre cinq observations et un lien vers le journal complet. L’en-tête de fiche reste visible pendant le défilement ; l’enregistrement dispose d’un état occupé explicite.

Les formulaires ont des labels, une validation serveur, un retour d’erreur et des boutons désactivés pendant les mutations. Un rafraîchissement ne détruit pas les saisies. La fiche protège les modifications non enregistrées. Les états inconnus sont affichés comme absents/non mesurés, sans faux zéro.

Tables horizontales dans leur conteneur, inventaire paginé à 50, activité à 200. Les détails de provenance sont ouvrables au clavier. La vue 2D permet sélection par Entrée/Espace et déplacement par flèches ; zoom et recentrage disposent de boutons nommés. Chaque intervalle de graphique peut être exploré au clavier avec un curseur natif.

Adaptations à 1 200, 1 000, 760 et 380 px ; contrôles de débordement à 320, 375, 768, 1 024 et 1 440 px. Animations désactivées avec `prefers-reduced-motion`. Validation automatisée axe et inspection visuelle, sans prétendre à une certification WCAG complète.
