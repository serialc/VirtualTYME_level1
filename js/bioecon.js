"use strict";

var VTR = {
    "start_coord": [54.17, -1.21],
    "start_zoom": 9,
    "map_bounds": new L.LatLngBounds(new L.LatLng(53, -3), new L.LatLng(55, 1)), // sw corner, ne corner
    "zoom": {"min": 8, "max": 15},
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
    var cont, popup;

    if( type != "error" && type != "warning" ) {
        VTR.msg("You requested an error message of an unknown designation/type: " + type, "error");
    }

    cont = document.getElementById('messages');
    popup = document.createElement("div");
    popup.className = "warning";
    popup.innerHTML = msg;
    cont.appendChild(popup);

    setTimeout(function(){cont.removeChild(popup)}, 10000);
};

VTR.parse_config = function(data) {

    let linenum, line, parts, filename, tocname, layers, headings, i, toc;

    // populate object with layers from config file
    layers = [];

    // clean up the file end and split into lines
    data = data.trim('\n').split('\n');
    
    // Populate the TOC headings and fill in the layers
    toc = {};

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

        layers[linenum] = {}
        // copy the data from table format to json
        for( i in headings ) {
            let heading = headings[i];
            layers[linenum][heading] = parts[i];
        }

        // populate the TOC
        if( !toc[layers[linenum].toc_parent] ) {
            toc[layers[linenum].toc_parent] = [];
        }
        toc[layers[linenum].toc_parent].push({"name": layers[linenum].toc_name, "visible": layers[linenum].default_display});

        // get the data now and display on the map
        if( layers[linenum].default_display === "yes" ) {
            // this is displayed by default and should be loaded

            VTR.map_display_triage(layers[linenum]);
        }
    }


    // save the layers data to the global object
    VTR.layers = layers;
    VTR.toc = toc;

    VTR.create_TOC();

};

VTR.find_layer = function(layer_name, parent_name) {
    var lay;

    for( laynum in VTR.layers ) {
        if( VTR.layers[laynum].toc_name === layer_name && VTR.layers[laynum].toc_parent === parent_name ) {
            return VTR.layers[laynum];
        }
    }
    VTR.msg("ERROR: Failed to find the layer '" + layer_name + "' in the group '" + parent_name +"'.", "error");
    return false;
};

VTR.create_TOC = function() {
    var grp, lay, layername, toc_el, toc, group_el, layer_el;
    
    toc = VTR.toc;
    toc_el = document.getElementById('toc');

    for(grp in toc) {
        group_el = document.createElement('div');
        group_el.className = "toc_group";
        group_el.innerHTML = grp;
        group_el.onclick = 
            function(target) {
                return function() {
                    document.getElementById(target).classList.toggle('hidden');
                };
            }(grp + "_layers");
        toc_el.appendChild(group_el);

        // new group element to contain all the layers
        group_el = document.createElement('div');
        group_el.className = "hidden";
        group_el.id = grp + "_layers";

        for(lay in toc[grp]) {
            let layer = toc[grp][lay];
            layer_el = document.createElement('div');
            if( layer.visible === "yes" ) {
                layer_el.className = "toc_layer visible_layer";
            } else {
                layer_el.className = "toc_layer";
            }

            layer_el.innerHTML = layer.name;
            layer_el.onclick = 
            function(this_layer, layer_el, this_grp) {
                return function() {
                    layer_el.classList.toggle('visible_layer');

                    layer_record = VTR.find_layer(this_layer.name, this_grp);
                    if( this_layer.visible === "no" ) {
                        this_layer.visible = "yes";
                        // load layer
                        VTR.map_display_triage(layer_record);
                    } else {
                        this_layer.visible = "no";
                        // remove layer from the map
                        VTR.map_remove(layer_record);
                    }
                };
            }(layer, layer_el, grp);
            group_el.appendChild(layer_el);
        }

        toc_el.appendChild(group_el);
    }
};

VTR.map_rawcsv_point_data = function(data, lay) {

    var lines, this_icon, heading, lat, lng, url, bname, pc, markers;
    
    this_icon = new VTR.icon_class({iconUrl: lay.icon}),
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
    if( !VTR.markers[lay.toc_parent] ) {
        VTR.markers[lay.toc_parent] = {};
    }
    VTR.markers[lay.toc_parent][lay.toc_name] = markers;
};

VTR.map_display_triage = function(lay) {

    VTR.get(lay.filename,
        function(data){
            // This is the code that will display the map data
            if( lay.file_type === "geojson" ) {
                VTR.map_geojson_data(JSON.parse(data), lay);
            }
            if( lay.file_type === "csv" && lay.geom_type === "point" ) {
                VTR.map_rawcsv_point_data(data, lay);
            }
        }
    );

};

VTR.map_remove = function(lay) {
    var i;

    if( lay.file_type === "geojson" ) {
        VTR.map.removeLayer(VTR.markers[lay.toc_parent][lay.toc_name]);
    }
    if( lay.geom_type === "point" ) {
        for( i = 0; i < VTR.markers[lay.toc_parent][lay.toc_name].length; i++ ) {
            VTR.map.removeLayer(VTR.markers[lay.toc_parent][lay.toc_name][i]);
        }
    }
    delete VTR.markers[lay.toc_parent][lay.toc_name];
};

VTR.map_geojson_data = function(data, lay) {

    // Add municipal bounds
    if( !VTR.markers[lay.toc_parent] ) {
        VTR.markers[lay.toc_parent] = {};
    }
    VTR.markers[lay.toc_parent][lay.toc_name] = L.geoJSON(data, {
        style: {
            "color": VTR.colors[lay.line_colour],
            "weight": lay.line_width,
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

    L.tileLayer("https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoiY3lyaWxsZW1kYyIsImEiOiJjazIwamZ4cXIwMzN3M2hscmMxYjgxY2F5In0.0BmIVj6tTvXVd2BmmFo6Nw'
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

    // get config file and display default layers, build TOC
    VTR.get('data/config.csv', VTR.parse_config);
};

window.onload = VTR.init;
