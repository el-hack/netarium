# Premium Network Intelligence

Direction propre à Netarium : graphite, surfaces sobres, accent menthe réservé aux actions et données observées, typographie système sans ressources externes. Mode clair équivalent, aucune animation de trafic décorative.

## Système

`src/styles/tokens.css` centralise primitives et couleurs sémantiques : fond, surface, surface surélevée, interaction, texte, texte secondaire, bordure, accent, avertissement, erreur, seconde série de graphique. Les deux thèmes utilisent les mêmes composants. Échelle d’espacement 4–48 px, rayons 6/10/16 px, transition 140 ms ; les géométries de carte/graphiques disposent de leurs unités propres.

Les feuilles séparent tokens, structure, présentation des données, formulaires, carte et adaptations. Les anciens styles de l’interface ivoire ont été retirés. Primitives React : Panel, Metric, Empty, Skeleton, SourceBadge/Provenance, Modal, TrafficChart.

- **Structure** : barre latérale compacte, navigation en trois groupes, recherche globale, contexte réseau/période conservé dans l’URL.
- **Overview** : bande de visibilité, ligne de métriques, graphique et état des sources, puis observations et inventaire. Aucun score arbitraire de santé.
- **Network Explorer** : surface de carte, contrôles, filtre d’identité, inspecteur latéral et sélection historique. Liens explicités ; accès direct à l’activité.
- **Activity Explorer** : identité en tête, onglets d’analyse, provenance et tables spécialisées. Les domaines, processus et octets gardent des unités distinctes.
- **Data Sources** : lignes détaillées avec permissions, capacités, limites et état ; matrice par appareil ; import guidé et extensions non intégrées clairement étiquetées.
- **Alertes et chronologie** : listes orientées examen et navigation, seuils expliqués, aucune esthétique alarmiste.

## Interaction et accessibilité

Les dialogues utilisent `<dialog>` et son confinement natif du focus. Le menu mobile confine/restaure le focus, rend le contenu inerte et se ferme avec Échap. La palette est accessible par bouton ou ⌘/Ctrl K. Le lien d’évitement cible le contenu sans effacer la navigation par URL.

Les formulaires ont des labels, une validation serveur, un retour d’erreur et des boutons désactivés pendant les mutations. Un rafraîchissement ne détruit pas les saisies. La fiche protège les modifications non enregistrées. Les états inconnus sont affichés comme absents/non mesurés, sans faux zéro.

Tables horizontales dans leur conteneur, inventaire paginé à 50, activité à 200. Les détails de provenance sont ouvrables au clavier. La vue 2D permet sélection par Entrée/Espace et déplacement par flèches ; zoom et recentrage disposent de boutons nommés. Chaque intervalle de graphique peut être exploré au clavier avec un curseur natif.

Adaptations à 1 200, 1 000, 760 et 380 px ; contrôles de débordement à 320, 375, 768, 1 024 et 1 440 px. Animations désactivées avec `prefers-reduced-motion`. Validation automatisée axe et inspection visuelle, sans prétendre à une certification WCAG complète.
