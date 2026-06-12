from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

COUNTRIES_DATA = {
    "276": {  # Germany
        "name": "Germany",
        "investment_usd_bn": 4.2,
        "coordinates": [10.45, 51.16],
        "role": "Hub d'infrastructure",
        "description": "L'Allemagne investit 4.2 milliards. Utilisez le menu pour explorer ses chaînes d'approvisionnement mondiales.",
        "flows": {
            "materials": [
                {"iso": "152", "name": "Chili", "coords": [-71, -35], "dir": "inbound", "detail": "Lithium"},
                {"iso": "180", "name": "RDC", "coords": [24, -4], "dir": "inbound", "detail": "Cobalt"}
            ],
            "labor": [
                {"iso": "356", "name": "Inde", "coords": [78.9, 20.6], "dir": "inbound", "detail": "Développement & Annotation"},
                {"iso": "404", "name": "Kenya", "coords": [37.9, 0.3], "dir": "inbound", "detail": "Modération de contenu"}
            ],
            "energy": [
                {"iso": "578", "name": "Norvège", "coords": [8, 62], "dir": "inbound", "detail": "Hydroélectricité"}
            ],
            "talent": [
                {"iso": "840", "name": "États-Unis", "coords": [-98, 38.5], "dir": "outbound", "detail": "Fuite des cerveaux"}
            ]
        }
    },
    "840": {  # USA
        "name": "United States",
        "investment_usd_bn": 109.0,
        "coordinates": [-98, 38.5],
        "role": "Captation de valeur",
        "description": "Leader mondial incontesté de l'investissement IA.",
        "flows": {}
    },
    "356": {  # Inde
        "name": "India",
        "investment_usd_bn": 1.9,
        "coordinates": [78.9, 20.6],
        "role": "Fournisseur",
        "description": "Vivier massif de talents et de données.",
        "flows": {}
    },
    "404": {  # Kenya
        "name": "Kenya",
        "investment_usd_bn": 0.08,
        "coordinates": [37.9, 0.3],
        "role": "Fournisseur",
        "description": "Hub essentiel de modération de contenu.",
        "flows": {}
    }
}

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/api/data")
async def get_data():
    return COUNTRIES_DATA