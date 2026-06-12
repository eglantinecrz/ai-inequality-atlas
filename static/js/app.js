document.addEventListener("DOMContentLoaded", async () => {
    const response = await fetch('/api/data');
    const db = await response.json();

    let focusedCountryId = null;
    
    const categoryColors = { materials: "var(--c-materials)", labor: "var(--c-labor)", energy: "var(--c-energy)", talent: "var(--c-talent)" };

    const container = document.getElementById("map-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select("#map-container")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const mapGroup = svg.append("g");
    const flowsGroup = svg.append("g");
    const focusUiGroup = svg.append("g");
    const redPinsGroup = svg.append("g"); // Groupe pour les pins Google Maps

    const projection = d3.geoNaturalEarth1().scale(width / 5.5).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    // Échelle de couleurs très claire et lumineuse pour l'investissement (Jaune -> Orange -> Rouge corail)
    function getColorByInvestment(amount) {
        if (amount >= 100) return "#FF6B6B"; // Rouge corail (USA)
        if (amount >= 10)  return "#FF9F43"; // Orange vif
        if (amount >= 3)   return "#FECA57"; // Jaune orangé (Allemagne)
        if (amount >= 1)   return "#FFDF73"; // Jaune (Inde)
        if (amount > 0)    return "#FFF2B2"; // Jaune très clair (Kenya)
        return "var(--map-land)";
    }

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(world => {
        const countries = topojson.feature(world, world.objects.countries).features;

        // 1. Dessiner la carte de base
        mapGroup.selectAll("path")
            .data(countries)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("id", d => `country-${d.id}`)
            .attr("d", path)
            .on("click", (event, d) => {
                if (db[d.id] && db[d.id].flows) setFocus(d.id);
            });

        // 2. Initialiser les Marqueurs Rouges Google Maps
        const clickableCountries = Object.entries(db).filter(([id, data]) => data.coordinates).map(([id, data]) => ({id, ...data}));
        
        const pins = redPinsGroup.selectAll(".red-pin")
            .data(clickableCountries)
            .enter()
            .append("g")
            .attr("class", "red-pin")
            .attr("transform", d => `translate(${projection(d.coordinates)})`)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (d.flows) setFocus(d.id);
            });

        // Icône épingle rouge
        pins.append("path")
            .attr("d", "M 0,0 C 0,0 -7,-6 -7,-14 A 7,7 0 1,1 7,-14 C 7,-6 0,0 0,0 Z")
            .attr("fill", "#D93025")
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", "1");
        pins.append("circle").attr("cx", 0).attr("cy", -14).attr("r", 2.5).attr("fill", "#FFFFFF");

        updateVisuals(); // Lancer l'affichage initial
    });

    document.getElementById("flow-filter").addEventListener("change", () => {
        if (focusedCountryId) updateVisuals();
    });

    function setFocus(countryId) {
        focusedCountryId = countryId;
        const data = db[countryId];
        
        document.getElementById("btn-back").style.display = "block";
        document.getElementById("sidebar-eyebrow").innerText = "COUNTRY FOCUS";
        document.getElementById("sidebar-title").innerText = data.name;
        document.getElementById("sidebar-desc").innerText = data.description;
        document.getElementById("country-details").style.display = "block";
        
        document.getElementById("flow-filter").value = "materials";
        updateVisuals();
    }

    document.getElementById("btn-back").addEventListener("click", () => {
        focusedCountryId = null;
        document.getElementById("btn-back").style.display = "none";
        document.getElementById("sidebar-eyebrow").innerText = "VUE GLOBALE";
        document.getElementById("sidebar-title").innerText = "Investissement IA";
        document.getElementById("sidebar-desc").innerText = "Carte des investissements privés. Cliquez sur un marqueur rouge (ex: Allemagne) pour explorer ses flux.";
        document.getElementById("country-details").style.display = "none";
        
        updateVisuals();
    });

    function updateVisuals() {
        if (!focusedCountryId) {
            // ----- MODE GLOBAL -----
            // 1. Colorer la carte selon l'investissement
            mapGroup.selectAll(".country")
                .classed("dimmed", false)
                .attr("fill", d => {
                    const data = db[d.id];
                    return (data && data.investment_usd_bn !== undefined) ? getColorByInvestment(data.investment_usd_bn) : "var(--map-land)";
                });
            
            // 2. Afficher les marqueurs rouges et cacher les flux
            redPinsGroup.style("display", "block");
            flowsGroup.selectAll("*").remove();
            focusUiGroup.selectAll("*").remove();

        } else {
            // ----- MODE FOCUS -----
            const category = document.getElementById("flow-filter").value;
            const activeColor = categoryColors[category];
            const data = db[focusedCountryId];
            const flows = data.flows[category] || [];

            // 1. Griser la carte, sauf les pays impliqués
            mapGroup.selectAll(".country").classed("dimmed", true).attr("fill", "var(--map-land)");
            flows.forEach(flow => {
                d3.select(`#country-${flow.iso}`).classed("dimmed", false).attr("fill", activeColor);
            });

            // 2. Cacher les marqueurs rouges normaux
            redPinsGroup.style("display", "none");

            // 3. Dessiner l'interface de focus et les flux
            flowsGroup.selectAll("*").remove();
            focusUiGroup.selectAll("*").remove();
            
            const focusPos = projection(data.coordinates);

            // Cercle animé sur le pays central
            const focusCircle = focusUiGroup.append("g").attr("transform", `translate(${focusPos[0]}, ${focusPos[1]})`);
            focusCircle.append("circle").attr("r", 14).attr("fill", "rgba(245, 192, 48, 0.2)");
            focusCircle.append("circle").attr("class", "focus-ring").attr("r", 18);
            focusCircle.append("circle").attr("r", 6).attr("fill", "#F5A623").attr("stroke", "#FFF").attr("stroke-width", 1.5);
            focusCircle.append("text").attr("y", -10).attr("text-anchor", "middle").style("font-size", "10px").style("font-family", "monospace").style("font-weight", "bold").text("DE");

            // Lignes courbées
            const listContainer = document.getElementById("flows-list");
            listContainer.innerHTML = ""; 

            flows.forEach(flow => {
                const sourcePos = projection(flow.coords);
                const dx = focusPos[0] - sourcePos[0], dy = focusPos[1] - sourcePos[1];
                const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; 
                const sweepFlag = flow.dir === "outbound" ? 1 : 0;
                
                flowsGroup.append("path")
                    .attr("d", `M ${sourcePos[0]},${sourcePos[1]} A ${dr},${dr} 0 0,${sweepFlag} ${focusPos[0]},${focusPos[1]}`)
                    .attr("class", "flow-line")
                    .attr("stroke", activeColor);

                const pointGroup = focusUiGroup.append("g").attr("transform", `translate(${sourcePos[0]}, ${sourcePos[1]})`);
                pointGroup.append("circle").attr("r", 5).attr("fill", activeColor).attr("stroke", "#FFF").attr("stroke-width", 1);
                pointGroup.append("circle").attr("r", 1.5).attr("fill", "#FFF");

                listContainer.innerHTML += `<div class="flow-item" style="border-color: ${activeColor}"><strong>${flow.name}</strong><span>${flow.detail}</span></div>`;
            });
        }
    }
});