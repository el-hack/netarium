# Sécurité

Netarium est conçu pour être exécuté par un utilisateur local, sur son propre réseau privé. Il ne fournit pas d’isolation contre un autre processus malveillant exécuté avec les mêmes droits sur cet ordinateur. Le dossier de données, les journaux, les exports et les captures d’écran peuvent contenir des informations privées.

Le service ne doit pas être exposé à Internet ni lancé globalement en administrateur. Les sondes restent dans le périmètre privé affiché. Un état de cache ou une absence de réponse ne doit pas être présenté comme une conclusion de sécurité.

Pour signaler un problème avant la mise en place d’un canal privé du dépôt, ne publiez pas de secrets ou de données réseau dans une issue publique. Transmettez au mainteneur une description minimale, les versions concernées, des étapes reproductibles avec des données fictives et l’impact.

La présence d’outils réseau est indiquée dans les réglages ; elle ne garantit pas les permissions effectives. Les exports CSV neutralisent les formules ; les exports JSON doivent rester traités comme des données non fiables par les outils qui les consomment.

Les processus, IP de destination et domaines DNS sont des métadonnées sensibles. Les collecteurs d’activité exigent un consentement explicite, ne s’activent pas après un redémarrage et peuvent être arrêtés depuis Data Sources. Le journal peut être exporté ou supprimé avec confirmation ; les fichiers d’export ne sont pas chiffrés. Aucune interception TLS ni collecte de contenu n’est implémentée.

Les imports sont déclaratifs, validés et associés explicitement à une identité. Ne pas interpréter un domaine DNS comme une visite volontaire ni un service annoncé comme un port réellement exposé. Les alertes de seuil et changements ne constituent pas des verdicts de sécurité. Le mode démo doit rester entièrement séparé des API et bases réelles ; les tests vérifient cette propriété.
