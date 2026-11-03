/** Synthetic data only. Never use this fixture to seed private content. */
export function philanthropyFixture() { return {
  schemaVersion:1,asOf:'2026-11-02',currency:'CAD',timeZone:'America/Toronto',
  sources:[{id:'demo',label:'Document de démonstration',url:'https://example.org/dossier',note:'Données fictives pour tester les interactions.',checkedAt:'2026-11-02'}],
  metrics:[{id:'donations',label:'Dons de démonstration',value:30000,target:100000,period:'Période fictive',sourceId:'demo'},{id:'revenue',label:'Recettes de démonstration',value:50000,period:'Période fictive',sourceId:'demo'},{id:'result',label:'Résultat de démonstration',value:-15000,period:'Période fictive',sourceId:'demo'}],
  years:[{year:2024,revenue:100000,expenses:80000,operating:20000,sourceId:'demo'},{year:2025,revenue:80000,expenses:75000,operating:5000,sourceId:'demo'}],
  historyNote:'Comparaison synthétique sur des exercices identiques.',targets:[{label:'Dons',value:100000},{label:'Entreprises',value:25000}],targetSourceId:'demo',targetNote:'Objectifs fictifs.',
  cash:{date:'2026-10-14',current:1000,investments:2000,expected:3000,sourceId:'demo',note:'Attendu distinct du reçu.'},
  priorities:[{title:'Renouveler les relations',summary:'Exemple de priorité.'}],milestones:[{date:'2026-12-15',title:'Échéance fictive',note:'Aucune demande réelle.'}],
  levers:[{id:'donateurs',category:'Dons',title:'Relations donatrices',summary:'Exemple.',evidence:'Source de démonstration.',offer:'Proposition.',condition:'À chiffrer.',measure:'Contribution nette.',sourceId:'demo'}],
  journey:[{title:'Identifier',detail:'Exemple.'},{title:'Remercier',detail:'Exemple.'}],
  actions:[{id:'registre',stateId:'philanthropie-registre',title:'Rapprocher le registre',category:'Dons',detail:'Démonstration sans production.',proof:'Registre fictif.',priority:'Court terme',stage:'watch'},{id:'dossier',stateId:'philanthropie-dossier',title:'Préparer le dossier',category:'Programmes',detail:'Démonstration.',proof:'Pièce fictive.',priority:'À cadrer',stage:'watch'}],
  programs:[{id:'demo',title:'Programme de démonstration',status:'Piste',deadline:'2026-12-15',summary:'Données fictives.',fit:'Exemple.',conditions:'Exemple.',next:'Exemple.',sourceId:'demo'}],
  registryUrl:'https://example.org/registre',registryNote:'Registre synthétique.',
  documents:[{title:'Registre de démonstration',category:'Registres',url:'https://example.org/registre',summary:'Données fictives.'},{title:'Budget de démonstration',category:'Comptes',url:'https://example.org/budget',summary:'Exemple.'}],
  principles:[{title:'Une preuve par montant',detail:'Ne pas additionner l’attendu au reçu.'}]
}; }
