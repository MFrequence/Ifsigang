"""Lexique infirmier fourni avec la plateforme, par catégorie de lieu de stage.

Seed idempotent (clé : term + category). Les entrées ajoutées par la promo vivent dans la
même collection avec un author_id, et ne sont jamais écrasées.
"""

from lib.db import db
from models.reference import LexiconEntry

SEED: list[tuple[str, str, str]] = [
    # (terme, définition, catégorie)
    ("AS", "Aide-soignant(e) : collabore aux soins d'hygiène et de confort sous la responsabilité de l'IDE.", "general"),
    ("IDE", "Infirmier(ère) diplômé(e) d'État.", "general"),
    ("ASH", "Agent des services hospitaliers : entretien des locaux, hôtellerie.", "general"),
    ("CS / IDEC", "Cadre de santé / infirmier coordinateur : encadre l'équipe soignante du service.", "general"),
    ("DMS", "Durée moyenne de séjour d'un patient dans le service.", "general"),
    ("Transmissions ciblées", "Transmissions écrites structurées Données-Actions-Résultats (DAR) autour d'une cible de soin.", "general"),
    ("DAR", "Données / Actions / Résultats : structure d'une transmission ciblée.", "general"),
    ("Dossier de soins", "Document unique regroupant observations, prescriptions, traitements et transmissions.", "general"),
    ("Prescription médicale", "Acte écrit, daté et signé du médecin, indispensable pour les soins sur prescription.", "general"),
    ("Rôle propre", "Soins que l'IDE décide et réalise de sa propre initiative (hygiène, confort, surveillance, éducation).", "general"),
    ("Rôle prescrit", "Soins réalisés sur prescription médicale (injections, perfusions, pansements complexes…).", "general"),
    ("VVP", "Voie veineuse périphérique : cathéter court posé sur une veine du membre.", "general"),
    ("PAC / Chambre implantable", "Port-à-cath : dispositif veineux implanté sous la peau pour les traitements au long cours.", "general"),
    ("PICC line", "Cathéter central inséré par voie périphérique, pour traitements de plusieurs semaines.", "general"),
    ("SC / IM / IV", "Voies d'injection : sous-cutanée, intramusculaire, intraveineuse.", "general"),
    ("PO", "Per os : administration par la bouche.", "general"),
    ("À jeun", "Sans aucun apport alimentaire ni boisson, généralement depuis minuit avant un examen ou une intervention.", "general"),
    ("Constantes", "Paramètres vitaux : TA, pouls, température, saturation, fréquence respiratoire, douleur.", "general"),
    ("TA", "Tension artérielle, exprimée en mmHg (ex. 120/80).", "general"),
    ("FC", "Fréquence cardiaque, en battements par minute.", "general"),
    ("FR", "Fréquence respiratoire, en cycles par minute.", "general"),
    ("SpO2", "Saturation pulsée en oxygène, mesurée au saturomètre (normale ≥ 95 %).", "general"),
    ("EVA / EN", "Échelle visuelle analogique / échelle numérique d'évaluation de la douleur (0 à 10).", "general"),
    ("Diurèse", "Volume d'urines émis sur une période donnée (souvent 24 h).", "general"),
    ("BU", "Bandelette urinaire : dépistage rapide (leucocytes, nitrites, sang, glucose, protéines).", "general"),
    ("ECBU", "Examen cytobactériologique des urines : recherche d'une infection urinaire.", "general"),
    ("NFS", "Numération formule sanguine.", "general"),
    ("CRP", "Protéine C-réactive : marqueur biologique d'inflammation ou d'infection.", "general"),
    ("HGT / Dextro", "Contrôle de la glycémie capillaire au doigt.", "general"),
    ("ATCD", "Antécédents médicaux, chirurgicaux ou familiaux du patient.", "general"),
    ("HDM", "Histoire de la maladie : récit chronologique des symptômes et du parcours de soin.", "general"),
    ("ATB", "Antibiotique / antibiothérapie.", "general"),
    ("AES", "Accident d'exposition au sang : déclaration immédiate obligatoire.", "general"),
    ("Précautions standard", "Mesures appliquées à tous les patients : hygiène des mains, gants, protection des muqueuses.", "general"),
    ("Précautions complémentaires", "Mesures ajoutées selon le germe : air, gouttelettes, contact.", "general"),
    ("SHA", "Solution hydro-alcoolique pour la friction des mains.", "general"),
    ("DASRI", "Déchets d'activité de soins à risque infectieux (filière jaune, collecteurs OPCT).", "general"),
    ("OPCT", "Objets piquants, coupants, tranchants : collecteur rigide dédié, jamais recapuchonner.", "general"),
    ("Décubitus", "Position allongée : dorsal, ventral ou latéral (DD, DV, DLG/DLD).", "general"),
    ("Escarre", "Lésion cutanée d'origine ischémique liée à une compression prolongée.", "general"),
    ("Échelle de Braden", "Score d'évaluation du risque d'escarre.", "general"),
    ("Toilette au lit", "Soin d'hygiène complet réalisé au lit pour un patient dépendant.", "general"),
    ("Bilan entrées/sorties", "Comparaison des apports (boissons, perfusions) et des pertes (urines, drains, vomissements).", "general"),
    # Médecine
    ("Tour de visite", "Passage du médecin dans le service avec l'équipe pour réévaluer chaque patient.", "medecine"),
    ("Entrée / Sortie", "Admission et départ d'un patient : recueil de données à l'entrée, ordonnance et transmission à la sortie.", "medecine"),
    ("BMR / BHRe", "Bactérie multi-résistante / hautement résistante émergente : précautions contact renforcées.", "medecine"),
    ("HAD", "Hospitalisation à domicile.", "medecine"),
    ("SSR", "Soins de suite et de réadaptation.", "medecine"),
    ("O2 lunettes / masque", "Oxygénothérapie par lunettes nasales (débit faible) ou masque (débit élevé).", "medecine"),
    ("Aérosol", "Nébulisation d'un traitement inhalé (bronchodilatateur, corticoïde).", "medecine"),
    ("Ponction lombaire", "Prélèvement de liquide céphalo-rachidien : patient à jeun, surveillance après le geste.", "medecine"),
    ("ECG", "Électrocardiogramme : 12 dérivations, patient allongé et détendu.", "medecine"),
    ("Insulinothérapie", "Traitement par insuline : schéma basal-bolus ou selon protocole glycémique.", "medecine"),
    # Chirurgie / bloc
    ("Pré-op / Post-op", "Période avant et après l'intervention chirurgicale.", "chirurgie"),
    ("Check-list HAS", "Vérification obligatoire avant incision au bloc (identité, côté, matériel, allergies).", "chirurgie"),
    ("Douche pré-opératoire", "Douche antiseptique la veille et le matin de l'intervention.", "chirurgie"),
    ("Jeûne pré-opératoire", "Arrêt des solides et liquides selon protocole avant anesthésie.", "chirurgie"),
    ("SSPI", "Salle de surveillance post-interventionnelle (ancienne « salle de réveil »).", "chirurgie"),
    ("Redon", "Drain aspiratif posé en fin d'intervention : surveiller l'aspect et le volume recueilli.", "chirurgie"),
    ("Pansement stérile", "Réfection de pansement en asepsie rigoureuse, matériel stérile, une seule main propre.", "chirurgie"),
    ("Ablation des fils / agrafes", "Retrait du matériel de suture sur prescription, cicatrice propre et sèche.", "chirurgie"),
    ("IBODE", "Infirmier de bloc opératoire diplômé d'État.", "chirurgie"),
    ("IADE", "Infirmier anesthésiste diplômé d'État.", "chirurgie"),
    ("Circulante / instrumentiste", "Rôles au bloc : la circulante gère l'environnement, l'instrumentiste la table stérile.", "chirurgie"),
    ("Thromboprophylaxie", "Prévention de la phlébite : HBPM, bas de contention, lever précoce.", "chirurgie"),
    # Urgences / réanimation
    ("IOA", "Infirmier organisateur de l'accueil : trie et priorise les patients aux urgences.", "urgences"),
    ("Tri / CIMU", "Classification infirmière des malades aux urgences, du degré 1 (vital) au degré 5.", "urgences"),
    ("Déchoc", "Salle de déchocage : prise en charge des urgences vitales.", "urgences"),
    ("SAUV", "Salle d'accueil des urgences vitales.", "urgences"),
    ("ACR", "Arrêt cardio-respiratoire : massage cardiaque, alerte, défibrillateur.", "urgences"),
    ("Glasgow (GCS)", "Score de conscience de 3 à 15 (ouverture des yeux, réponse verbale, motrice).", "urgences"),
    ("Scope", "Monitorage continu : ECG, TA, SpO2, fréquence respiratoire.", "urgences"),
    ("KTC", "Cathéter veineux central.", "urgences"),
    ("Intubation / VNI", "Ventilation invasive par sonde d'intubation / ventilation non invasive au masque.", "urgences"),
    ("Drogues vasoactives", "Traitements IV continus soutenant la pression artérielle (noradrénaline…), à la seringue électrique.", "urgences"),
    ("PSE / SAP", "Pousse-seringue électrique / seringue auto-pulsée : débit précis en ml/h.", "urgences"),
    ("Remplissage", "Apport rapide de soluté pour corriger une hypovolémie.", "urgences"),
    # Psychiatrie
    ("SPDT / SPDRE", "Soins psychiatriques à la demande d'un tiers / sur décision du représentant de l'État.", "psychiatrie"),
    ("SL", "Soins libres : hospitalisation avec le consentement du patient.", "psychiatrie"),
    ("CMP", "Centre médico-psychologique : suivi ambulatoire.", "psychiatrie"),
    ("CATTP", "Centre d'accueil thérapeutique à temps partiel.", "psychiatrie"),
    ("Entretien d'accueil", "Premier entretien infirmier : alliance thérapeutique, recueil de données, évaluation du risque.", "psychiatrie"),
    ("Contenance", "Cadre relationnel et institutionnel qui apaise et sécurise le patient.", "psychiatrie"),
    ("Isolement / contention", "Mesures de dernier recours, sur prescription, avec surveillance et réévaluation régulières tracées.", "psychiatrie"),
    ("Risque suicidaire (RUD)", "Évaluation Risque / Urgence / Dangerosité.", "psychiatrie"),
    ("Neuroleptique retard", "Antipsychotique injectable à action prolongée (toutes les 2 à 4 semaines).", "psychiatrie"),
    ("Syndrome malin des neuroleptiques", "Urgence : fièvre, rigidité, sueurs, confusion → arrêt du traitement et alerte immédiate.", "psychiatrie"),
    # EHPAD / gériatrie
    ("GIR", "Groupe iso-ressources : niveau de dépendance de 1 (le plus dépendant) à 6.", "ehpad"),
    ("AGGIR", "Grille d'évaluation de l'autonomie utilisée pour déterminer le GIR.", "ehpad"),
    ("Projet de vie individualisé", "Projet personnalisé du résident : habitudes, souhaits, objectifs de soin.", "ehpad"),
    ("Chute / prévention", "Évaluation du risque de chute, chaussage, éclairage, aides techniques, traçabilité.", "ehpad"),
    ("Dénutrition / MNA", "Dépistage de la dénutrition (poids, IMC, albumine, échelle MNA).", "ehpad"),
    ("Fausse route", "Passage d'aliment dans les voies aériennes : texture adaptée, position assise, surveillance.", "ehpad"),
    ("Polymédication", "Nombreux traitements simultanés : risque d'interactions et d'iatrogénie.", "ehpad"),
    ("Iatrogénie", "Conséquence néfaste d'un acte ou d'un traitement médical.", "ehpad"),
    ("MMSE", "Mini-Mental State Examination : dépistage des troubles cognitifs.", "ehpad"),
    ("Soins palliatifs", "Soins de confort visant la qualité de vie en phase avancée, douleur et accompagnement au premier plan.", "ehpad"),
    ("Directives anticipées", "Volontés écrites du patient sur ses soins s'il ne peut plus s'exprimer.", "ehpad"),
    # Pédiatrie / maternité
    ("Poids / taille / PC", "Mesures de croissance du nourrisson, dont le périmètre crânien, reportées sur les courbes.", "pediatrie"),
    ("Carnet de santé", "Document de suivi de l'enfant : vaccins, courbes, examens obligatoires.", "pediatrie"),
    ("Apgar", "Score d'adaptation à la vie extra-utérine à 1, 5 et 10 minutes de vie (0 à 10).", "pediatrie"),
    ("Posologie au poids", "En pédiatrie, les doses se calculent en mg/kg : double contrôle indispensable.", "pediatrie"),
    ("Déshydratation du nourrisson", "Signes : pli cutané, fontanelle creuse, couches sèches, perte de poids.", "pediatrie"),
    ("Bronchiolite", "Infection respiratoire virale du nourrisson : désencombrement, fractionnement des repas, surveillance respiratoire.", "pediatrie"),
    ("Allaitement / biberon", "Accompagnement de l'alimentation du nouveau-né, position et rythme des tétées.", "pediatrie"),
    ("Post-partum", "Période suivant l'accouchement : surveillance saignements, globe utérin, périnée, humeur.", "pediatrie"),
    ("Lochies", "Écoulements utérins après l'accouchement : quantité et aspect surveillés.", "pediatrie"),
    ("Distraction / doudou", "Moyens non médicamenteux de gestion de la douleur et de l'anxiété chez l'enfant.", "pediatrie"),
]


async def seed_lexicon() -> int:
    """Insère les entrées manquantes du lexique fourni. Idempotent, ne touche pas aux ajouts."""
    inserted = 0
    for term, definition, category in SEED:
        existing = await db.lexicon.find_one({"term": term, "category": category}, {"_id": 1})
        if existing:
            continue
        entry = LexiconEntry(term=term, definition=definition, category=category)
        await db.lexicon.insert_one(entry.model_dump())
        inserted += 1
    return inserted
