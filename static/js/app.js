document.addEventListener("DOMContentLoaded", async () => {
    
    const enterBtn = document.getElementById("enter-map-btn");
    if (enterBtn) {
        enterBtn.addEventListener("click", () => {
            document.getElementById("app-section").scrollIntoView({ behavior: 'smooth' });
        });
    }

    let db = {};
    let descriptions = {};

    const initialResponse = await fetch('/api/data?year=2024');
    db = await initialResponse.json();

    try {
        const descResponse = await fetch('/api/descriptions');
        descriptions = await descResponse.json();
    } catch (e) {
        console.error("Erreur lors du chargement des descriptions", e);
    }

    const container = document.getElementById("map-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select("#map-container")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const rootGroup = svg.append("g");
    const mapGroup = rootGroup.append("g");

    const zoom = d3.zoom()
        .scaleExtent([1, 5])
        .on("zoom", event => rootGroup.attr("transform", event.transform));

    svg.call(zoom)
        .on("wheel.zoom", null)
        .on("dblclick.zoom", null);

    const tooltip = d3.select("#tooltip").attr("class", "tooltip").style("opacity", 0);

    const projection = d3.geoNaturalEarth1().scale(width / 5.5).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    function getSelectedMetric() {
        const checkedRadio = document.querySelector('input[name="map-metric"]:checked');
        return {
            id: checkedRadio ? checkedRadio.value : null,
            label: checkedRadio ? checkedRadio.getAttribute('data-label') : ""
        };
    }

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(world => {
        const countries = topojson.feature(world, world.objects.countries).features;

        countries.forEach(d => {
            if (d.id) d.id = String(Number(d.id));
        });

        mapGroup.selectAll("path")
            .data(countries)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("id", d => `country-${d.id}`)
            .attr("d", path)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 0.5)
            .on("mouseenter", (event, d) => {
                const data = db[String(d.id)];
                const metric = getSelectedMetric();
                
                if (data && metric.id) {
                    const value = data.metrics[metric.id];
                    let displayValue = "Aucune donnée";
                    
                    if (value !== null && value !== undefined && value !== "") {
                        // NOUVEAUTÉ : Si c'est du texte, on l'affiche direct. Si c'est un chiffre, on formate.
                        if (typeof value === "string" && isNaN(Number(value))) {
                            displayValue = value;
                        } else {
                            displayValue = Number(value).toLocaleString();
                        }
                    }
                    
                    tooltip.style("opacity", 1)
                           .html(`<strong>${data.name}</strong>
                                  <span style="color:#A0AEC0; font-size:11px;">${metric.label} : </span>
                                  <span class="metric-val">${displayValue}</span>`);
                } else if (data) {
                    tooltip.style("opacity", 1).html(`<strong>${data.name}</strong><br><span style="color:#A0AEC0; font-size:11px;">Données disponibles. Sélectionnez un indicateur.</span>`);
                }
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY + 15) + "px");
            })
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
            });

        updateVisuals(); 
    });

    document.getElementById("analysis-axis").addEventListener("change", () => {
        const selected = document.getElementById("analysis-axis").value;
        
        document.getElementById("economic-detail-group").style.display = selected === "economic" ? "block" : "none";
        document.getElementById("environmental-detail-group").style.display = selected === "environmental" ? "block" : "none";
        document.getElementById("social-detail-group").style.display = selected === "social" ? "block" : "none";
        
        document.querySelectorAll('input[name="map-metric"]').forEach(radio => radio.checked = false);
        updateVisuals();
    });

    document.querySelectorAll('input[name="map-metric"]').forEach(radio => {
        radio.addEventListener("change", updateVisuals);
    });

    document.querySelectorAll('.year-tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const year = e.target.getAttribute('data-year');
            const response = await fetch(`/api/data?year=${year}`);
            db = await response.json(); 
            
            updateVisuals();
        });
    });

    function getAxisColors(axis) {
        if (axis === "social") return ["#D6BCFA", "#322659"]; 
        if (axis === "environmental") return ["#F5DEB3", "#5C4033"]; 
        return ["#BFDBFE", "#1E3A8A"]; 
    }

    function updateVisuals() {
        const axis = document.getElementById("analysis-axis").value;
        const colors = getAxisColors(axis);
        const metric = getSelectedMetric();
        const descElement = document.getElementById("analysis-desc");

        if (descElement) {
            if (!metric.id) {
                descElement.innerHTML = "Select an indicator from the list above to generate the choropleth map.";
            } else {
                const info = descriptions[metric.id];
                let text = info ? ((info.description ? info.description.replace(/\n/g, "<br>") : "") || "Description unavailable for this indicator.") : "Description unavailable for this indicator.";
                
                if (info && info.sources) {
                    text += `<div style="text-align: right; margin-top: 10px;">
                                <button id="open-source-btn" class="source-pop-btn">Sources</button>
                             </div>`;
                }
                
                descElement.innerHTML = text;

              const sourceBtn = document.getElementById("open-source-btn");
                if (sourceBtn) {
                    sourceBtn.addEventListener("click", () => {
                        const sourceModal = document.getElementById("source-modal");
                        const sourceModalText = document.getElementById("source-modal-text");
                        
                        // 1. Détection des liens cliquables
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        let sourcesWithLinks = info.sources.replace(urlRegex, function(url) {
                            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
                        });
                        
                        // 2. NOUVEAU : On transforme les sauts de ligne en HTML pour aérer les sources
                        sourcesWithLinks = sourcesWithLinks.replace(/\n/g, "<br><br>");
                        
                        sourceModalText.innerHTML = sourcesWithLinks;
                        sourceModal.classList.add("active");
                    });
                }
            }
        }

        // --- NOUVEAUTÉ : Détection Numérique vs Texte (Catégoriel) ---
        let maxVal = 0;
        let isCategorical = false;
        let categories = [];
        let categoricalColorScale;

        if (metric.id) {
            const allValues = Object.values(db).map(d => d.metrics[metric.id]).filter(v => v !== null && v !== undefined && v !== "");
            
            // Si la première donnée non-vide est un texte, on passe en mode "Catégoriel"
            if (allValues.length > 0 && typeof allValues[0] === "string" && isNaN(Number(allValues[0]))) {
                isCategorical = true;
                categories = [...new Set(allValues)].sort(); // Récupère la liste unique des textes
                
                // Palette de couleurs pour les marqueurs (jusqu'à 8 catégories distinctes)
                const customColors = ["#93C5FD", "#3B82F6", "#1E3A8A"];
                categoricalColorScale = d3.scaleOrdinal()
                    .domain(categories)
                    .range(customColors);
            } else {
                // Mode Numérique classique
                const numericValues = allValues.map(v => Number(v)).filter(v => !isNaN(v));
                maxVal = numericValues.length > 0 ? Math.max(...numericValues) : 0;
            }
        }

        const colorScale = d3.scaleLinear()
            .domain([0, maxVal || 1])
            .range([colors[0], colors[1]]);

        mapGroup.selectAll(".country")
            .transition().duration(500)
            .attr("fill", d => {
                const data = db[String(d.id)];
                
                if (!data) return "#E2E8F0"; 
                if (!metric.id) return "#E2E8F0"; 
                
                const val = data.metrics[metric.id];
                if (val !== null && val !== undefined && val !== "") {
                    // Si c'est un texte, on utilise l'échelle catégorielle, sinon le dégradé continu
                    return isCategorical ? categoricalColorScale(val) : colorScale(Number(val));
                }
                
                return "#E2E8F0"; 
            });

        mapGroup.selectAll(".google-marker").remove(); 

        

        const legendDiv = document.getElementById("map-legend");
        const legendContinuous = document.getElementById("legend-continuous");
        const legendCategorical = document.getElementById("legend-categorical");

        if (metric.id && (maxVal > 0 || isCategorical)) {
            legendDiv.style.display = "block";
            document.getElementById("legend-title").innerText = metric.label;
            
            const legendUnit = document.getElementById("legend-unit");
            const info = descriptions[metric.id];
            if (legendUnit) {
                legendUnit.innerText = (info && info.unit) ? `Unit: ${info.unit}` : "";
            }

            // GESTION DE LA LÉGENDE
            if (isCategorical) {
                // On cache la barre et on affiche les marqueurs carrés
                legendContinuous.style.display = "none";
                legendCategorical.style.display = "flex";
                
                let catHtml = "";
                categories.forEach(cat => {
                    const color = categoricalColorScale(cat);
                    catHtml += `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #4A5568;">
                            <div style="width: 12px; height: 12px; border-radius: 2px; background-color: ${color}; flex-shrink: 0;"></div>
                            <span>${cat}</span>
                        </div>
                    `;
                });
                legendCategorical.innerHTML = catHtml;

            } else {
                // On cache les marqueurs et on affiche la barre de dégradé
                legendCategorical.style.display = "none";
                legendContinuous.style.display = "block";

                document.getElementById("legend-min").innerText = "0";
                document.getElementById("legend-max").innerText = Number(maxVal).toLocaleString();
                document.getElementById("legend-bar").style.background = `linear-gradient(to right, ${colors[0]}, ${colors[1]})`;
            }

        } else {
            legendDiv.style.display = "none";
        }
    }

    const contactBtn = document.getElementById('data-bubble');
    const contactModal = document.getElementById('contact-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const contactForm = document.getElementById('contact-form');

    contactBtn.addEventListener('click', () => {
        contactModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        contactModal.classList.remove('active');
    });

    contactModal.addEventListener('click', (e) => {
        if (e.target === contactModal) {
            contactModal.classList.remove('active');
        }
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const submitBtn = contactForm.querySelector('.submit-btn');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Sending...";
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            message: document.getElementById('user-message').value
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert("Thank you! Your message has been sent directly to our team.");
                contactModal.classList.remove('active');
                contactForm.reset(); 
            } else {
                alert("Oops! Our servers couldn't send the email right now.");
            }
        } catch (error) {
            alert("Network error. Please try again later.");
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    const sourceModal = document.getElementById('source-modal');
    const closeSourceBtn = document.getElementById('close-source-modal');

    if (closeSourceBtn && sourceModal) {
        closeSourceBtn.addEventListener('click', () => {
            sourceModal.classList.remove('active');
        });

        sourceModal.addEventListener('click', (e) => {
            if (e.target === sourceModal) {
                sourceModal.classList.remove('active');
            }
        });
    }

    // --- NOUVEAU : GESTION DU TÉLÉCHARGEMENT CSV (CORRIGÉ POUR EXCEL FRANÇAIS) ---
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', () => {
            if (!db || Object.keys(db).length === 0) return;

            // Liste de toutes les colonnes à exporter
            const metricKeys = [
                'jobs', 'data_centers', 'electricity_demand', 'headquarters',
                'publication', 'accessibility', 'talent', 'water', 'CO2',
                'land_footprint', 'lithium', 'cobalt', 'copper', 'patents',
                'chatgpt', 'regulation'
            ];

            // 1. Ajout du "BOM" (Byte Order Mark) pour forcer Excel à lire les accents (UTF-8)
            let csvContent = "\uFEFF"; 
            
            // 2. On utilise le Point-Virgule (;) au lieu de la virgule pour séparer les colonnes
            csvContent += "ISO;Country;" + metricKeys.map(k => k.replace(/_/g, ' ')).join(";") + "\n";

            // Ajout des données de chaque pays
            for (const iso in db) {
                const countryData = db[iso];
                let row = [iso, `"${countryData.name}"`]; 
                
                metricKeys.forEach(key => {
                    let val = countryData.metrics[key];
                    if (val === null || val === undefined) {
                        val = ""; // Cellule vide
                    } else if (typeof val === "string") {
                        val = `"${val.replace(/"/g, '""')}"`; // Gère le texte contenant déjà des guillemets
                    } else if (typeof val === "number") {
                        // 3. Transforme les points (27.27) en virgules (27,27) pour les décimales françaises
                        val = val.toString().replace('.', ',');
                    }
                    row.push(val);
                });
                
                // On joint la ligne avec des points-virgules
                csvContent += row.join(";") + "\n";
            }

            // Création du fichier "virtuel" et déclenchement du téléchargement
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            
            // Le nom du fichier s'adapte à l'année
            const activeYearTab = document.querySelector('.year-tab.active');
            const year = activeYearTab ? activeYearTab.getAttribute('data-year') : '2024';
            link.setAttribute("download", `Atlas_AI_Data_${year}.csv`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    document.getElementById("environmental-detail-group").style.display = "block";
    updateVisuals();
});