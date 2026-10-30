# Contribuer à Netarium

Utilisez Node.js 24. Lancez `npm ci`, puis `npm run dev`. Le service reste limité à la boucle locale.

Avant une contribution, exécutez `npm run check`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` et les tests navigateur pour une modification de l’interface.

- Préservez la distinction entre observation, cache et déduction.
- Testez les évolutions d’identité, de périmètre ou de persistance avant de les implémenter.
- Placez les nouvelles sources réseau dans les adaptateurs, sans faire dépendre les composants React des commandes système.
- N’ajoutez aucune télémétrie ni ressource distante par défaut.
- Utilisez des données fictives explicitement identifiées dans les tests. Ne soumettez pas de base ou de capture de votre réseau réel.
- Gardez les états vides, les erreurs, la navigation au clavier et le mode sans WebGL utilisables.
- Toute évolution du stockage doit fournir une migration et un test de conservation des données existantes.

Une pull request doit expliquer le problème, le comportement obtenu, les validations effectuées et ses limites. Les contributions aux adaptateurs Linux/Windows, à IPv6 et à l’accessibilité sont bienvenues.
