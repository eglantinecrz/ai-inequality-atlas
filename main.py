from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import sqlite3
import json

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/api/data")
async def get_data():
    def load_countries_from_db(db_path="data.db"):
        if not os.path.exists(db_path):
            return None
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1;")
            row = cur.fetchone()
            if not row:
                conn.close()
                return None
            table = row[0]
            cur.execute(f"PRAGMA table_info('{table}')")
            cols = [c[1] for c in cur.fetchall()]
            
            cur.execute(f"""
                SELECT * FROM '{table}'
                WHERE iso_numeric != 254
            """)
            rows = cur.fetchall()

            data = {}
            for r in rows:
                rec = dict(zip(cols, r))

                iso = None
                def normalize_iso(value):
                    if value is None: return None
                    if isinstance(value, (int, float)): return str(int(value))
                    s = str(value).strip()
                    if not s: return None
                    if s.isdigit(): return str(int(s))
                    return s

                for k in ('iso_numeric', 'iso', 'iso3_numeric', 'iso3', 'country_code', 'ISO', 'iso_code', 'id', 'ID', 'country_id'):
                    if k in rec and rec[k] not in (None, ''):
                        iso = normalize_iso(rec[k])
                        if iso: break
                if not iso: continue

                lon = lat = None
                for latk in ('latitude', 'lat', 'y'):
                    if latk in rec and rec[latk] not in (None, ''):
                        try: lat = float(rec[latk]); break
                        except: pass
                for lonk in ('longitude', 'lon', 'lng', 'x'):
                    if lonk in rec and rec[lonk] not in (None, ''):
                        try: lon = float(rec[lonk]); break
                        except: pass

                if 'coords' in rec and (rec['coords'] not in (None, '')) and (lon is None or lat is None):
                    s = str(rec['coords'])
                    parts = [p.strip() for p in s.split(',') if p.strip()]
                    if len(parts) >= 2:
                        try:
                            a = float(parts[0]); b = float(parts[1])
                            if abs(a) > 90: lon = a; lat = b
                            else: lat = a; lon = b
                        except: pass

                coords = [lon, lat] if lon is not None and lat is not None else None
                name = rec.get('name') or rec.get('country') or rec.get('Country') or rec.get('country_name') or iso
                
                # Fonction sécurisée pour convertir en float
                def safe_float(val):
                    try: return float(val)
                    except: return None

                # Extraction de toutes les métriques possibles
                metrics = {
                    'gdp': safe_float(rec.get('gdp')),
                    'sector_gains': safe_float(rec.get('sector_gains') or rec.get('growth')),
                    'hq_locations': safe_float(rec.get('headquarters') or rec.get('hq')),
                    'publications': safe_float(rec.get('publications') or rec.get('Publications')),
                    'data_centers': safe_float(rec.get('data_center') or rec.get('data_centers')),
                    'water_consumption': safe_float(rec.get('water_consumption') or rec.get('water')),
                    'co2_emissions': safe_float(rec.get('co2_emissions') or rec.get('co2')),
                    'land_footprint': safe_float(rec.get('land_footprint') or rec.get('land')),
                    'electricity': safe_float(rec.get('electricity')),
                    'job_creation': safe_float(rec.get('jobs') or rec.get('labour')),
                    'education': safe_float(rec.get('education')),
                    'ethics': safe_float(rec.get('ethics')),
                    'diversity': safe_float(rec.get('diversity'))
                }

                data[iso] = {
                    'name': name or iso,
                    'coordinates': coords,
                    'metrics': metrics
                }

            conn.close()
            return data
        except Exception as e:
            print('Error loading DB:', e)
            return None

    return load_countries_from_db() or {}