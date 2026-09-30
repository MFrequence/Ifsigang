"""Schémas d'anatomie à compléter (glisser-déposer des étiquettes sur les repères numérotés).

Les définitions vivent dans le code (pas de CRUD prévu) ; seules les tentatives sont stockées.
Les images ont été générées pour la plateforme : repères numérotés, sans aucun nom visible.
Le mapping numéro → étiquette ne quitte JAMAIS le serveur : la correction est faite ici.
"""

IMG = "https://static.prod-images.emergentagent.com/jobs/298c6912-5a4a-4ba9-8a4f-dd8fb23da5c2/images"

DIAGRAMS: list[dict] = [
    {
        "slug": "coeur",
        "title": "Le cœur",
        "system": "Cardiovasculaire",
        "hint": "Coupe frontale : cavités et gros vaisseaux.",
        "image_url": f"{IMG}/0af406620b38087060647a51f3b7968979c8393340389c9300dacf093fb44c94.jpeg",
        "markers": {
            1: "Oreillette droite",
            2: "Ventricule droit",
            3: "Oreillette gauche",
            4: "Ventricule gauche",
            5: "Aorte",
            6: "Artère pulmonaire",
        },
    },
    {
        "slug": "poumons",
        "title": "L'appareil respiratoire",
        "system": "Respiratoire",
        "hint": "Des voies aériennes supérieures au diaphragme.",
        "image_url": f"{IMG}/af763f2a2a2f3c704a75047c2ccb00cd9119509e91bf7049dc72b562ae64fb7a.jpeg",
        "markers": {
            1: "Trachée",
            2: "Bronche souche",
            3: "Bronchioles",
            4: "Poumon droit",
            5: "Poumon gauche",
            6: "Diaphragme",
        },
    },
    {
        "slug": "rein",
        "title": "Le rein",
        "system": "Urinaire",
        "hint": "Coupe longitudinale : du cortex à l'uretère.",
        "image_url": f"{IMG}/aa83ada7ccbbc199daffee089875427f27200095c83245f7d070f05cb7e2b884.jpeg",
        "markers": {
            1: "Cortex rénal",
            2: "Pyramide de Malpighi (médullaire)",
            3: "Bassinet (pelvis rénal)",
            4: "Uretère",
            5: "Artère rénale",
            6: "Veine rénale",
        },
    },
    {
        "slug": "digestif",
        "title": "L'appareil digestif",
        "system": "Digestif",
        "hint": "Tube digestif et glandes annexes.",
        "image_url": f"{IMG}/884cc30eb2a2a4271b4ad8ecb85023cf39d6ad2b4ad137788e93b9d609f8143f.jpeg",
        "markers": {
            1: "Œsophage",
            2: "Estomac",
            3: "Foie",
            4: "Vésicule biliaire",
            5: "Pancréas",
            6: "Intestin grêle",
            7: "Côlon (gros intestin)",
        },
    },
    {
        "slug": "squelette",
        "title": "Le squelette",
        "system": "Locomoteur",
        "hint": "Vue antérieure : les repères osseux de base.",
        "image_url": f"{IMG}/bb42b657d015b321caa600da653b63902eca94530b04b7ecd40c2a8d29654fe8.jpeg",
        "markers": {
            1: "Crâne",
            2: "Clavicule",
            3: "Sternum",
            4: "Humérus",
            5: "Os iliaque (bassin)",
            6: "Fémur",
            7: "Tibia",
        },
    },
    {
        "slug": "neurone",
        "title": "Le neurone",
        "system": "Neurologique",
        "hint": "De la réception du signal à la synapse.",
        "image_url": f"{IMG}/a175e84a7e3147b7735ed9f313ad0d321d0db069ae82db5da878e9f47c85323d.jpeg",
        "markers": {
            1: "Dendrites",
            2: "Corps cellulaire (soma)",
            3: "Noyau",
            4: "Gaine de myéline",
            5: "Nœud de Ranvier",
            6: "Terminaisons axonales",
        },
    },
]

DIAGRAM_MAP: dict[str, dict] = {d["slug"]: d for d in DIAGRAMS}
