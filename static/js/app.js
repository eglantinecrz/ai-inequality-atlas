document.addEventListener("DOMContentLoaded", async () => {
    const response = await fetch('/api/data');
    const db = await response.json();

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

    // Fonction pour récupérer la métrique active
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
                    const displayValue = (value !== null && value !== undefined) ? Number(value).toLocaleString() : "Aucune donnée";
                    
                    tooltip.style("opacity", 1)
                           .html(`<strong>${data.name}</strong>
                                  <span style="color:#A0AEC0; font-size:11px;">${metric.label} : </span>
                                  <span class="metric-val">${displayValue}</span>`);
                } else if (data) {
                    // Si on est dans la vue par défaut (rose) et qu'on survole un pays
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

    // Écouteurs de changement de filtres (Axe Principal)
    document.getElementById("analysis-axis").addEventListener("change", () => {
        const selected = document.getElementById("analysis-axis").value;
        
        // Gère l'affichage des groupes de boutons radio
        document.getElementById("economic-detail-group").style.display = selected === "economic" ? "block" : "none";
        document.getElementById("environmental-detail-group").style.display = selected === "environmental" ? "block" : "none";
        document.getElementById("social-detail-group").style.display = selected === "social" ? "block" : "none";
        
        // Décoche tous les boutons radio pour revenir à la vue globale rose
        document.querySelectorAll('input[name="map-metric"]').forEach(radio => radio.checked = false);

        updateVisuals();
    });

    // Ajoute l'écouteur sur tous les boutons radio
    document.querySelectorAll('input[name="map-metric"]').forEach(radio => {
        radio.addEventListener("change", updateVisuals);
    });

    function getAxisColors(axis) {
        if (axis === "social") {
            return ["#D6BCFA", "#322659"]; // Violet pastel -> Violet très foncé
        }
        if (axis === "environmental") {
            return ["#D9F99D", "#064E3B"]; // Jaune-vert -> Vert très très foncé
        }
        return ["#FEF08A", "#C53030"]; // Economic : Jaune clair -> Rouge brique
    }

    function updateVisuals() {
        const axis = document.getElementById("analysis-axis").value;
        const colors = getAxisColors(axis);
        const metric = getSelectedMetric();
        const descElement = document.getElementById("analysis-desc");

        // Met à jour la description si un indicateur est sélectionné, ou remet le texte par défaut
        if (descElement) {
            if (!metric.id) {
                descElement.innerText = "Select an indicator from the list above to generate the choropleth map.";
            } else if (axis === "economic") {
                descElement.innerText = "Economic analysis based on the selected indicators.";
            } else if (axis === "environmental") {
                descElement.innerText = "Environmental impact analysis of AI infrastructure.";
            } else if (axis === "social") {
                descElement.innerText = "Social dynamics and access to AI analysis.";
            }
        }

        let maxVal = 0;
        if (metric.id) {
            const allValues = Object.values(db).map(d => d.metrics[metric.id]).filter(v => v !== null && v !== undefined);
            maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
        }

        const colorScale = d3.scaleLinear()
            .domain([0, maxVal || 1])
            .range([colors[0], colors[1]]);

        mapGroup.selectAll(".country")
            .transition().duration(500)
            .attr("fill", d => {
                const data = db[String(d.id)];
                
                // Si le pays n'est pas du tout dans la base de données -> Gris
                if (!data) return "#E2E8F0"; 

                // Si AUCUN indicateur n'est sélectionné -> Rose (vue par défaut)
                if (!metric.id) return "#F687B3"; // Rose doux et élégant

                // Si un indicateur est sélectionné ET que le pays a la donnée -> Couleur du dégradé
                if (data.metrics[metric.id] !== null && data.metrics[metric.id] !== undefined) {
                    return colorScale(data.metrics[metric.id]);
                }
                
                // Si un indicateur est sélectionné MAIS que le pays n'a pas cette donnée précise -> Gris
                return "#E2E8F0"; 
            });

        // Met à jour la légende UI
        const legendDiv = document.getElementById("map-legend");
        if (metric.id && maxVal > 0) {
            legendDiv.style.display = "block";
            document.getElementById("legend-title").innerText = metric.label;
            document.getElementById("legend-min").innerText = "0";
            document.getElementById("legend-max").innerText = Number(maxVal).toLocaleString();
            
            document.getElementById("legend-bar").style.background = `linear-gradient(to right, ${colors[0]}, ${colors[1]})`;
        } else {
            legendDiv.style.display = "none";
        }
    }
});