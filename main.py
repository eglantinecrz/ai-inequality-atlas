from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import os
import sqlite3
import smtplib
import ssl
from email.message import EmailMessage
from dotenv import load_dotenv

# Charge les variables cachées du fichier .env
load_dotenv()

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/api/descriptions")
async def get_descriptions():
    db_path = "data.db"
    if not os.path.exists(db_path):
        return {}
    
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT dimension, description, unit, sources FROM data_description")
        rows = cur.fetchall()
        conn.close()
        
        descriptions = {
            row[0]: {
                "description": row[1] or "",
                "unit": row[2] or "",
                "sources": row[3] or ""
            } for row in rows if row[0]
        }
        return descriptions
    except Exception as e:
        print('Error loading descriptions:', e)
        return {}

@app.get("/api/data")
async def get_data(year: str = "2024"):
    def load_countries_from_db(db_path="data.db", target_year="2024"):
        if not os.path.exists(db_path):
            return None
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? LIMIT 1;", (f'%{target_year}%',))
            row = cur.fetchone()
            
            if not row:
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'data_description' LIMIT 1;")
                row = cur.fetchone()
                
            if not row:
                conn.close()
                return None
                
            table = row[0]
            cur.execute(f"PRAGMA table_info('{table}')")
            cols = [c[1] for c in cur.fetchall()]
            
            cur.execute(f"SELECT * FROM '{table}'")
            rows = cur.fetchall()

            data = {}
            for r in rows:
                rec = dict(zip(cols, r))

                norm_rec = {}
                for k, v in rec.items():
                    clean_key = str(k).lower().strip().replace(' ', '_')
                    norm_rec[clean_key] = v

                iso = None
                def normalize_iso(value):
                    if value is None: return None
                    if isinstance(value, (int, float)): return str(int(value))
                    s = str(value).strip()
                    if not s: return None
                    if s.isdigit(): return str(int(s))
                    return s

                for k in ('iso_numeric', 'iso', 'iso3_numeric', 'iso3', 'country_code', 'iso_code', 'id', 'country_id'):
                    if k in norm_rec and norm_rec[k] not in (None, ''):
                        iso = normalize_iso(norm_rec[k])
                        if iso: break
                
                if not iso or iso == '254': 
                    continue

                lon = lat = None
                for latk in ('latitude', 'lat', 'y'):
                    if latk in norm_rec and norm_rec[latk] not in (None, ''):
                        try: lat = float(norm_rec[latk]); break
                        except: pass
                for lonk in ('longitude', 'lon', 'lng', 'x'):
                    if lonk in norm_rec and norm_rec[lonk] not in (None, ''):
                        try: lon = float(norm_rec[lonk]); break
                        except: pass

                coords = [lon, lat] if lon is not None and lat is not None else None
                name = norm_rec.get('name') or norm_rec.get('country') or norm_rec.get('country_name') or iso
                
                def safe_float(val):
                    try: return float(val)
                    except: return None

                def get_val(possible_keys):
                    for key in possible_keys:
                        if key in norm_rec and norm_rec[key] not in (None, ""):
                            return norm_rec[key]
                    return None

                metrics = {
                    'jobs': safe_float(get_val(['jobs', 'job_creation'])),
                    'data_centers': safe_float(get_val(['data_centers', 'data_center', 'datacenters'])),
                    'electricity_demand': safe_float(get_val(['electricity_demand', 'electricity'])),
                    'headquarters': safe_float(get_val(['headquarters', 'headquarter'])),
                    'publication': safe_float(get_val(['publication', 'publications'])),
                    'accessibility': safe_float(get_val(['accessibility', 'internet_accessibility'])),
                    'talent': safe_float(get_val(['talent', 'talent_migration'])),
                    'water': safe_float(get_val(['water', 'water_consumption'])),
                    'CO2': safe_float(get_val(['co2', 'co2_emissions', 'emissions'])), 
                    'land_footprint': safe_float(get_val(['land_footprint', 'land'])),
                    'lithium': safe_float(get_val(['lithium'])),
                    'cobalt': safe_float(get_val(['cobalt', 'coblat'])),
                    'copper': safe_float(get_val(['copper'])),
                    'patents': safe_float(get_val(['patents', 'patent'])),
                    'chatgpt': safe_float(get_val(['chatgpt', 'chat_gpt'])),
                    'regulation': get_val(['regulation', 'regulations'])
                }

                data[iso] = {
                    'name': name or iso,
                    'coordinates': coords,
                    'metrics': metrics
                }

            conn.close()
            return data
        except Exception as e:
            print(f'Error loading DB for year {target_year}:', e)
            return None

    return load_countries_from_db(target_year=year) or {}

class ContactForm(BaseModel):
    name: str
    email: str
    message: str

@app.post("/api/contact")
async def send_contact_email(form: ContactForm):
    SMTP_SERVER = "smtp.gmail.com" 
    SMTP_PORT = 465
    
    # Récupération sécurisée depuis le fichier .env
    SENDER_EMAIL = os.getenv("SENDER_EMAIL")
    SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")
    RECEIVER_EMAIL = os.getenv("SENDER_EMAIL") 

    if not SENDER_EMAIL or not SENDER_PASSWORD:
        raise HTTPException(status_code=500, detail="Configuration email manquante sur le serveur.")

    msg = EmailMessage()
    msg.set_content(f"Nouveau message reçu depuis l'Atlas IA !\n\nNom : {form.name}\nEmail : {form.email}\n\nMessage :\n{form.message}")
    
    msg['Subject'] = f"Atlas IA - Contact de {form.name}"
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECEIVER_EMAIL
    msg['Reply-To'] = form.email

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        return {"status": "success", "message": "Email envoyé avec succès !"}
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")
        raise HTTPException(status_code=500, detail="Le serveur de messagerie est indisponible.")
    
    if __name__ == "__main__":
    import uvicorn
    # Le port doit être dynamique pour que Render puisse l'attribuer
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)