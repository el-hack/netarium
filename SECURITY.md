# Sécurité

Netarium est conçu pour être exécuté par un utilisateur local, sur son propre réseau privé. Il ne fournit pas d’isolation contre un autre processus malveillant exécuté avec les mêmes droits sur cet ordinateur. Le dossier de données, les journaux, les exports et les captures d’écran peuvent contenir des informations privées.

Le service ne doit pas être exposé à Internet ni lancé globalement en administrateur. Les sondes restent dans le périmètre privé affiché. Un état de cache ou une absence de réponse ne doit pas être présenté comme une conclusion de sécurité.

Pour signaler un problème avant la mise en place d’un canal privé du dépôt, ne publiez pas de secrets ou de données réseau dans une issue publique. Transmettez au mainteneur une description minimale, les versions concernées, des étapes reproductibles avec des données fictives et l’impact.

La présence d’outils réseau est indiquée dans les réglages ; elle ne garantit pas les permissions effectives. Les exports CSV neutralisent les formules ; les exports JSON doivent rester traités comme des données non fiables par les outils qui les consomment.
