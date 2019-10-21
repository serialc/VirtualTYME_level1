VTR = {
    "start_coord": [54.17, -1.21],
    "start_zoom": 9,
    "map_bounds": new L.LatLngBounds(new L.LatLng(53, -3), new L.LatLng(55, 1)), // sw corner, ne corner
    "zoom": {"min": 8, "max": 18},
    "colors": {
        "thyme1": "#896ab3",
        "thyme2": "#9dbb6e"
        },
    "map": {},
    "map_attribution": 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    "markers": {},
    "icon_class": L.Icon.extend({
        options: {
            //shadowUrl: 'shadow.png',
            iconSize:     [50, 50],
            //shadowSize:   [50, 64],
            iconAnchor:   [25, 25],
            //shadowAnchor: [4, 62],
            popupAnchor:  [0, -25]
            }
        })
    };

VTR.get = function(filepath, funcall) {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', filepath);
    xhr.responseType = 'text';
    xhr.onload = function() {
        if (xhr.status === 200) {
            funcall(xhr.responseText);
        }
        else {
            VTR.msg("Failed to retrieve <b>" + filepath + "</b>. Returned status " + xhr.status, "error");
        }
    };
    xhr.send();
}

VTR.msg = function(msg, type) {
    var el;

    if( type != "error" && type != "warning" ) {
        VTR.msg("You requested an error message of an unknown designation/type: " + type, "error");
    }

    el = document.getElementById(type + 's')
    el.style.display = "";
    el.innerHTML = msg;
    setTimeout(function(){el.style.display="none"}, 10000);
};

VTR.parse_config = function(data) {

    var line, parts, filename, tocname, layers, headings, i;

    // populate object with layers from config file
    layers = {};

    // clean up the file end and split into lines
    data = data.trim('\n').split('\n');

    for(linenum in data) {
        line = data[linenum];

        if( line.slice(0,1) === "#" ) {
            if( line.slice(0,3) === "#@ " ) {
                // IMPORTANT, the headings are copied from the config file
                headings = line.slice(3);
                headings = headings.split(',');
            }
            // this is a comment, skip
            continue;
        }

        // parse line
        parts = line.split(',');
        if( parts.length !== headings.length ) {
            VTR.msg("Error parsing the config.csv file.<br>Row number " + (parseInt(linenum,10) + 1) + " has " + parts.length + " elements. Expected " + headings.length + ".", "error");
            console.log(parts);
        }

        tocname = parts[1];
        layers[tocname] = {}
        // copy the data from table format to json
        for( i in headings ) {
            heading = headings[i];
            layers[tocname][heading] = parts[i];
        }

        // get the data now and display on the map
        if( layers[tocname].default_display === "yes" ) {
            // this is displayed by default and should be loaded

            VTR.get(layers[tocname].filename,
                function(index){
                    return function(data) { 
                        var lay = VTR.layers[index];
                        // This is the code that will display the map data
                        
                        if( lay.file_type === "geojson" ) {
                            VTR.map_geojson_data(JSON.parse(data), lay.line_colour, lay.line_width);
                        }

                        if( lay.file_type === "csv" && lay.geom_type === "point" ) {
                            VTR.map_rawcsv_point_data(data, lay.icon, lay.toc_parent, lay.toc_name);
                        }
                    };
                }(tocname)
            );
        }
    }

    console.log(layers);
    // save the layers data to the global object
    VTR.layers = layers;
};

VTR.map_rawcsv_point_data = function(data, icon_path, toc_parent, toc_name) {

    var lines, this_icon, heading, lat, lng, url, bname, pc, markers;
    
    this_icon = new VTR.icon_class({iconUrl: icon_path}),
    lines = data.trim('\n').split('\n');

    markers = [];

    heading = true;
    for( linenum in lines ) {
        parts = lines[linenum].split(',');
        if( heading ) {
            header = parts;
            heading = false;
            lat = header.indexOf("latitude");
            lng = header.indexOf("longitude");
            url = header.indexOf("url");
            bname = header.indexOf("name");
            pc = header.indexOf("postcode");
            continue;
        }

        markers.push( L.marker([parts[lat], parts[lng]], {icon: this_icon}).addTo(VTR.map).bindPopup(
            "<h3>" + parts[bname] + "</h3><p>Post code: " + parts[pc] + "<br>" + parts[url] + "</p>"
        ) );
    }

    // add the markers to the global object
    VTR.markers[toc_parent] = {toc_name: markers};
};

VTR.map_geojson_data = function(data, colour, line_width) {

    // Add municipal bounds
    L.geoJSON(data, {
        style: {
            "color": VTR.colors[colour],
            "weight": line_width,
            "opacity": 0.5,
            "fill": false
        }}
        ).addTo(VTR.map);
};

VTR.init = function() {

    VTR.map = L.map('mapid', {
            attributionControl: false,
            zoomControl: false,
            minZoom: VTR.zoom.min,
            maxZoom: VTR.zoom.max
        }).setView(VTR.start_coord, VTR.start_zoom);

    <!-- Need to update the map token below to my own! -->
    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiY3lyaWxsZW1kYyIsImEiOiJjazIwamZ4cXIwMzN3M2hscmMxYjgxY2F5In0.0BmIVj6tTvXVd2BmmFo6Nw', {
        maxZoom: 18,
        id: 'mapbox.streets'
    }).addTo(VTR.map);

    // Set map bounds
    VTR.map.setMaxBounds( VTR.map_bounds );
    
    // add attribution 'control' to map
    L.control.attribution({position: 'bottomright'}).addAttribution(VTR.map_attribution).addTo(VTR.map);
    // add scale bar
    L.control.scale({position: 'bottomright', imperial: false, maxWidth: 200}).addTo(VTR.map);
    
    // add basemap controls to map
    //L.control.layers(baseMaps, null, {position: 'topright'}).addTo(VTR.map);
    // customize zoom control location
    VTR.map.addControl( L.control.zoom({position: 'topright'}) )

    // get config file
    VTR.get('data/config.csv', VTR.parse_config);
    
};

window.onload = VTR.init;
