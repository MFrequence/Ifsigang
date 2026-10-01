"""Catalogue de pathologies du programme IFSI livré avec la plateforme.

Seed idempotent (clé : slug). Chaque entrée porte sa catégorie, une définition courte et
l'incubation ou l'évolution typique. Les rubriques détaillées (causes, examens, traitements,
effets indésirables, rôle infirmier, points clés) sont produites à la première ouverture par
`lib/disease.py` puis conservées en base pour toute la promo.
"""

import unicodedata

from lib.db import db
from models.disease import Disease

CATEGORIES: dict[str, str] = {
    "cardio": "Cardiovasculaire",
    "respi": "Respiratoire",
    "infectieux": "Infectieux",
    "digestif": "Digestif",
    "neuro": "Neurologique",
    "endocrino": "Endocrinologie",
    "nephro": "Néphrologie / urologie",
    "hemato": "Hématologie",
    "onco": "Oncologie",
    "psy": "Psychiatrie",
    "rhumato": "Rhumatologie",
    "dermato": "Dermatologie",
}

# (nom, catégorie, définition courte, incubation ou évolution)
SEED: list[tuple[str, str, str, str]] = [
    ("Hypertension artérielle", "cardio", "Pression artérielle durablement ≥ 140/90 mmHg au cabinet, facteur de risque cardiovasculaire majeur.", "Évolution silencieuse sur des années ; complications cardiaques, rénales, cérébrales et oculaires."),
    ("Infarctus du myocarde", "cardio", "Nécrose d'une partie du muscle cardiaque par occlusion d'une artère coronaire.", "Urgence absolue : la nécrose s'installe en quelques heures, d'où le « time is muscle »."),
    ("Insuffisance cardiaque", "cardio", "Incapacité du cœur à assurer un débit suffisant aux besoins de l'organisme.", "Maladie chronique évoluant par poussées de décompensation."),
    ("Angor (angine de poitrine)", "cardio", "Douleur thoracique par ischémie myocardique transitoire, sans nécrose.", "Stable (à l'effort) ou instable, qui peut précéder un infarctus."),
    ("Embolie pulmonaire", "respi", "Obstruction d'une artère pulmonaire par un thrombus, le plus souvent venu des membres inférieurs.", "Installation brutale, risque vital immédiat."),
    ("Thrombose veineuse profonde", "cardio", "Caillot dans une veine profonde, surtout du membre inférieur.", "Risque d'embolie pulmonaire dans les premiers jours ; séquelles de maladie post-thrombotique."),
    ("Accident vasculaire cérébral", "neuro", "Déficit neurologique brutal par infarctus (80 %) ou hémorragie cérébrale.", "Urgence : fenêtre de thrombolyse limitée à 4 h 30 après les premiers signes."),
    ("Artériopathie oblitérante des membres inférieurs", "cardio", "Rétrécissement athéromateux des artères des jambes.", "Évolution de la claudication intermittente vers les douleurs de repos et les troubles trophiques."),
    ("Bronchopneumopathie chronique obstructive (BPCO)", "respi", "Obstruction bronchique permanente et progressive, liée au tabac dans 80 % des cas.", "Déclin respiratoire sur des années, ponctué d'exacerbations."),
    ("Asthme", "respi", "Inflammation chronique des bronches avec obstruction réversible.", "Évolution par crises ; l'asthme aigu grave est une urgence."),
    ("Pneumopathie infectieuse", "respi", "Infection du parenchyme pulmonaire, souvent à pneumocoque.", "Installation en 24 à 48 h ; amélioration en 48-72 h sous antibiotique adapté."),
    ("Tuberculose pulmonaire", "infectieux", "Infection à Mycobacterium tuberculosis, à transmission aérienne.", "Incubation 1 à 3 mois ; forme latente possible pendant des années."),
    ("Grippe saisonnière", "infectieux", "Infection respiratoire aiguë à virus Influenza.", "Incubation 1 à 3 jours ; contagiosité dès la veille des signes et environ 5 jours."),
    ("COVID-19", "infectieux", "Infection à SARS-CoV-2, d'expression respiratoire et systémique.", "Incubation 2 à 14 jours (environ 3 jours pour les variants récents)."),
    ("Gastro-entérite aiguë virale", "digestif", "Infection digestive aiguë, souvent à norovirus ou rotavirus.", "Incubation 12 à 48 h ; guérison en 2 à 4 jours."),
    ("Hépatite B", "infectieux", "Hépatite virale transmise par le sang, les rapports sexuels et de la mère à l'enfant.", "Incubation 6 semaines à 6 mois ; passage à la chronicité dans 5 à 10 % des cas."),
    ("Hépatite C", "infectieux", "Hépatite virale à transmission essentiellement sanguine.", "Incubation 2 semaines à 6 mois ; chronicité fréquente, guérie par les antiviraux directs."),
    ("Infection par le VIH", "infectieux", "Infection rétrovirale détruisant les lymphocytes T CD4.", "Primo-infection 2 à 4 semaines après la contamination ; évolution vers le sida sans traitement."),
    ("Varicelle", "infectieux", "Primo-infection au virus varicelle-zona, éruption vésiculeuse.", "Incubation 14 jours (10 à 21) ; contagieuse de 2 jours avant l'éruption jusqu'aux croûtes."),
    ("Zona", "dermato", "Réactivation du virus varicelle-zona sur un territoire nerveux.", "Éruption en 2 à 4 jours, douleurs post-zostériennes possibles pendant des mois."),
    ("Rougeole", "infectieux", "Infection virale très contagieuse à éruption morbilliforme.", "Incubation 10 à 12 jours ; contagiosité 5 jours avant à 5 jours après l'éruption."),
    ("Coqueluche", "infectieux", "Infection respiratoire à Bordetella pertussis, grave chez le nourrisson.", "Incubation 7 à 10 jours ; toux pouvant durer plus de 6 semaines."),
    ("Méningite bactérienne", "infectieux", "Infection des méninges, surtout à méningocoque ou pneumocoque.", "Incubation 2 à 10 jours ; urgence vitale, antibiotiques dans l'heure."),
    ("Gale", "dermato", "Parasitose cutanée contagieuse due à Sarcoptes scabiei.", "Incubation 3 semaines (quelques jours en cas de réinfestation)."),
    ("Érysipèle", "dermato", "Dermohypodermite bactérienne aiguë, le plus souvent streptococcique.", "Installation en 24 à 48 h avec fièvre et placard inflammatoire."),
    ("Escarre", "dermato", "Lésion ischémique cutanée par pression prolongée sur une zone d'appui.", "Apparition possible en quelques heures d'immobilité ; cicatrisation en semaines à mois."),
    ("Sepsis", "infectieux", "Réponse inflammatoire généralisée et dysfonction d'organe liées à une infection.", "Aggravation possible en quelques heures vers le choc septique."),
    ("Infection urinaire (cystite)", "nephro", "Infection de la vessie, le plus souvent à Escherichia coli.", "Signes en 1 à 2 jours ; risque d'évolution vers la pyélonéphrite."),
    ("Pyélonéphrite aiguë", "nephro", "Infection du rein et de ses cavités, avec fièvre et douleur lombaire.", "Installation rapide ; apyrexie attendue en 48-72 h sous antibiotique."),
    ("Insuffisance rénale chronique", "nephro", "Baisse progressive et irréversible du débit de filtration glomérulaire.", "Évolution en 5 stades sur des années jusqu'à la dialyse ou la greffe."),
    ("Colique néphrétique (lithiase urinaire)", "nephro", "Douleur lombaire aiguë par obstruction des voies urinaires par un calcul.", "Crise de quelques heures ; élimination spontanée fréquente des calculs < 5 mm."),
    ("Cirrhose", "digestif", "Fibrose hépatique diffuse avec nodules de régénération, souvent alcoolique ou virale.", "Évolution sur des années, compensée puis décompensée (ascite, ictère, encéphalopathie)."),
    ("Pancréatite aiguë", "digestif", "Inflammation aiguë du pancréas, d'origine biliaire ou alcoolique.", "Installation brutale ; gravité évaluée dans les 48 premières heures."),
    ("Ulcère gastroduodénal", "digestif", "Perte de substance de la paroi gastrique ou duodénale, souvent liée à Helicobacter pylori.", "Cicatrisation en 4 à 8 semaines sous traitement ; risque d'hémorragie ou de perforation."),
    ("Maladie de Crohn", "digestif", "Maladie inflammatoire chronique pouvant toucher tout le tube digestif.", "Évolution par poussées et rémissions, tout au long de la vie."),
    ("Rectocolite hémorragique", "digestif", "Maladie inflammatoire chronique limitée au rectum et au côlon.", "Poussées de rectorragies et de diarrhées alternant avec des rémissions."),
    ("Appendicite aiguë", "digestif", "Inflammation de l'appendice iléo-cæcal.", "Évolution en 24 à 72 h vers la perforation et la péritonite si non opérée."),
    ("Occlusion intestinale", "digestif", "Arrêt du transit par obstacle mécanique ou paralysie intestinale.", "Urgence chirurgicale : risque de nécrose en quelques heures."),
    ("Diabète de type 1", "endocrino", "Carence absolue en insuline par destruction auto-immune des cellules bêta.", "Révélation souvent brutale chez l'enfant ou l'adulte jeune, parfois par une acidocétose."),
    ("Diabète de type 2", "endocrino", "Insulinorésistance et insulinopénie progressive, liées au surpoids et à la sédentarité.", "Installation silencieuse sur des années ; complications micro et macrovasculaires."),
    ("Hypothyroïdie", "endocrino", "Production insuffisante d'hormones thyroïdiennes, souvent par thyroïdite de Hashimoto.", "Installation lente et insidieuse sur plusieurs mois."),
    ("Hyperthyroïdie (maladie de Basedow)", "endocrino", "Production excessive d'hormones thyroïdiennes d'origine auto-immune.", "Installation en quelques semaines ; risque de crise thyrotoxique."),
    ("Maladie d'Alzheimer", "neuro", "Démence neurodégénérative avec atteinte de la mémoire et des fonctions supérieures.", "Évolution progressive sur 8 à 12 ans, par stades de dépendance croissante."),
    ("Maladie de Parkinson", "neuro", "Dégénérescence des neurones dopaminergiques : tremblement, rigidité, akinésie.", "Évolution lente sur des années, avec fluctuations motrices sous traitement."),
    ("Sclérose en plaques", "neuro", "Maladie auto-immune démyélinisante du système nerveux central.", "Forme rémittente par poussées, puis progression du handicap."),
    ("Épilepsie", "neuro", "Répétition de crises par décharges neuronales anormales.", "Crise de quelques minutes ; l'état de mal épileptique est une urgence."),
    ("Dépression caractérisée", "psy", "Trouble de l'humeur avec tristesse, anhédonie et ralentissement depuis au moins 15 jours.", "Épisode de plusieurs mois sans traitement ; efficacité des antidépresseurs en 2 à 4 semaines."),
    ("Schizophrénie", "psy", "Trouble psychotique chronique associant symptômes positifs, négatifs et désorganisation.", "Début chez l'adulte jeune, évolution chronique avec rechutes."),
    ("Trouble bipolaire", "psy", "Alternance d'épisodes maniaques ou hypomaniaques et dépressifs.", "Évolution cyclique sur la vie entière, espacée par les régulateurs de l'humeur."),
    ("Anémie ferriprive", "hemato", "Anémie microcytaire par carence en fer.", "Installation progressive ; correction de l'hémoglobine en 1 à 2 mois, des réserves en 3 à 6 mois."),
    ("Drépanocytose", "hemato", "Maladie génétique de l'hémoglobine entraînant des crises vaso-occlusives.", "Maladie de toute la vie, ponctuée de crises douloureuses et d'infections."),
    ("Leucémie aiguë", "hemato", "Prolifération maligne de cellules sanguines immatures dans la moelle.", "Installation en quelques semaines ; urgence hématologique."),
    ("Cancer du sein", "onco", "Tumeur maligne de la glande mammaire, premier cancer de la femme.", "Évolution lente ; dépistage organisé de 50 à 74 ans."),
    ("Cancer colorectal", "onco", "Tumeur maligne du côlon ou du rectum, souvent issue d'un polype.", "Transformation d'un polype en cancer sur environ 10 ans."),
    ("Cancer du poumon", "onco", "Tumeur maligne bronchopulmonaire, très liée au tabac.", "Diagnostic souvent tardif, évolution rapide."),
    ("Arthrose", "rhumato", "Dégradation mécanique du cartilage articulaire.", "Évolution lente sur des années, par poussées douloureuses."),
    ("Polyarthrite rhumatoïde", "rhumato", "Rhumatisme inflammatoire chronique auto-immun des articulations.", "Poussées inflammatoires avec destruction articulaire progressive."),
    ("Ostéoporose", "rhumato", "Fragilité osseuse par perte de densité minérale.", "Évolution silencieuse jusqu'à la fracture (poignet, vertèbre, col du fémur)."),
    ("Insuffisance veineuse chronique", "cardio", "Reflux veineux des membres inférieurs avec stase et œdème.", "Évolution lente vers les varices, la dermite ocre puis l'ulcère veineux."),
]


def slugify(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    cleaned = "".join(c if c.isalnum() else "-" for c in normalized.lower())
    return "-".join(part for part in cleaned.split("-") if part)[:80]


async def seed_diseases() -> int:
    """Insère les pathologies manquantes (jamais d'écrasement d'une fiche enrichie)."""
    inserted = 0
    for name, category, definition, incubation in SEED:
        slug = slugify(name)
        if await db.diseases.find_one({"slug": slug}, {"_id": 1}):
            continue
        disease = Disease(
            slug=slug,
            name=name,
            category=category,
            definition=definition,
            incubation=incubation,
            source="seed",
        )
        await db.diseases.insert_one(disease.model_dump())
        inserted += 1
    return inserted
