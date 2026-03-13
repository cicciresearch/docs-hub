// =============================
// EQE Analysis Tool for MkDocs
// =============================

// Physical constants
const q = 1.602176634e-19;
const h = 6.62607015e-34;
const c = 299792458;

let AM15 = [];

async function loadAM15(){

    const response = await fetch("../nrel_am15g.csv");
    const text = await response.text();

    const lines = text.trim().split("\n");

    for(let i=1;i<lines.length;i++){

        let parts = lines[i].trim().split(/[\s,\t]+/);

        if(parts.length < 3) continue;

        let wl = parseFloat(parts[0]);
        let irr = parseFloat(parts[2]); // Global tilt column

        if(isNaN(wl) || isNaN(irr)) continue;

        AM15.push([wl,irr]);
    }
}

function parseEQE(text){

    let lines = text.trim().split("\n");

    let wavelength = [];
    let eqe = [];

    for(let line of lines){

        if(line.trim()==="") continue;

        let parts = line.trim().split(/[\s,;\t]+/);

        if(parts.length < 2) continue;

        let wl = parseFloat(parts[0]);
        let val = parseFloat(parts[1]);

        if(isNaN(wl) || isNaN(val)) continue;

        wavelength.push(wl);
        eqe.push(val/100); // convert % → fraction
    }

    return {wavelength, eqe};
}

function interpolate(x,data){

    for(let i=0;i<data.length-1;i++){

        let x1=data[i][0];
        let y1=data[i][1];

        let x2=data[i+1][0];
        let y2=data[i+1][1];

        if(x>=x1 && x<=x2){

            let t=(x-x1)/(x2-x1);
            return y1+t*(y2-y1);
        }
    }

    return 0;
}

function irradianceToPhotonFlux(wavelength_nm, irradiance){

    let wavelength_m = wavelength_nm * 1e-9;

    return irradiance * wavelength_m / (h*c);
}

function calculateJsc(wavelength,eqe){

    let jsc=0;

    for(let i=0;i<wavelength.length-1;i++){

        let wl=wavelength[i];
        let wl_next=wavelength[i+1];

        let irr=interpolate(wl,AM15);

        let flux=irradianceToPhotonFlux(wl,irr);

        let dλ=wl_next-wl;

        jsc+=q*eqe[i]*flux*dλ;
    }

    return jsc*0.1; // mA/cm²
}

function estimateBandgap(wavelength,eqe){

    let threshold=0.1;
    let cutoff=null;

    for(let i=eqe.length-1;i>=0;i--){

        if(eqe[i]>threshold){

            cutoff=wavelength[i];
            break;
        }
    }

    if(cutoff===null) return null;

    return 1240/cutoff;
}

function initializeEQEPlot(){

    if(typeof Plotly==="undefined") return;

    const layout={

        title:"EQE Spectrum and Photocurrent Integration",

        xaxis:{title:"Wavelength (nm)",range:[300,1100],},

        yaxis:{
            title:"EQE",
            range:[0,1], fixedrange:true,
            showline:true,
            linecolor:"black",
            linewidth:1,

            ticks:"outside",
            ticklen:6,
            tickwidth:1
        },

        yaxis2:{
            title:"Spectral Irradiance (W·m⁻²·nm⁻¹)",
            overlaying:"y",
            side:"right",
            anchor:"free",
            autoshift:true,
            showgrid:false,
            range:[0,2],fixedrange:true,

            showline:true,
            linecolor:"black",
            linewidth:1,

            ticks:"outside",
            ticklen:6,
            tickwidth:1
        },

        yaxis3:{
            title:"Cumulative Jsc (mA/cm²)",
            overlaying:"y",
            side:"right",
            anchor:"free",
            autoshift:true,
            showgrid:false,
            range:[0,30],fixedrange:true,

            showline:true,
            linecolor:"black",
            linewidth:1,

            ticks:"outside",
            ticklen:6,
            tickwidth:1
        },

        legend:{
            orientation:"h",
            x:0,
            y:1.15
        }
    };

    // dummy traces so Plotly draws the axes
    const traces = [
    {
        x: [],
        y: [],
        mode: "lines",
        name: "AM1.5G",
        line: {
            color: "rgba(200,0,0,0.35)",
            width: 2
        },
        yaxis: "y2"
    },
    {
        x: [],
        y: [],
        mode: "lines",
        name: "Cumulative Jsc",
        line: {
            color: "blue",
            width: 2
        },
        yaxis: "y3"
    },
    {
        x: [],
        y: [],
        mode: "lines",
        name: "EQE",
        line: {
            color: "black",
            width: 3
        }
    }

    ];

    Plotly.newPlot("eqe_plot",traces,layout);

    document.getElementById("eqe_results").innerHTML=
        "<b>Short Circuit Current Density:</b> – mA/cm²<br>"+
        "<b>Estimated Bandgap:</b> – eV";
}

function plotEQE(wavelength,eqe){

    let xmin = Math.min(...wavelength)-50;
    let xmax = Math.max(...wavelength)+50;

    // let am_wl=AM15.map(v=>v[0]);
    // let am_irr=AM15.map(v=>v[1]);
    let am_wl = [];
    let am_irr = [];

    for(let i=0;i<AM15.length;i++){

        let wl = AM15[i][0];

        if(wl >= xmin && wl <= xmax){

            am_wl.push(wl);
            am_irr.push(AM15[i][1]);
        }
    }

    let cumulativeJsc=[];
    let jsc=0;

    for(let i=0;i<wavelength.length-1;i++){

        let wl=wavelength[i];
        let wl_next=wavelength[i+1];

        let irr=interpolate(wl,AM15);

        let flux=irradianceToPhotonFlux(wl,irr);

        let dλ=wl_next-wl;

        jsc+=q*eqe[i]*flux*dλ;

        cumulativeJsc.push(jsc*0.1);
    }

    let Eg=estimateBandgap(wavelength,eqe);
    let cutoff=Eg?1240/Eg:null;

    let shapes=[];

    if(cutoff){

        shapes.push({
            type:"line",
            x0:cutoff,
            x1:cutoff,
            y0:0,
            y1:1,
            xref:"x",
            yref:"paper",
            line:{
                dash:"dash",
                width:2
            }
        });
    }

    Plotly.relayout("eqe_plot", {
        "xaxis.range": [xmin, xmax]
    });

    Plotly.update(
        "eqe_plot",
        {
            x: [am_wl, wavelength.slice(0,-1), wavelength],
            y: [am_irr, cumulativeJsc, eqe]
        }
    );
    // Plotly.newPlot("eqe_plot",[amTrace, jscTrace, eqeTrace],layout);
}

function analyzeEQE(){

    try{

        let text=document.getElementById("eqe_input").value;

        if(text.trim()===""){
            alert("Please paste EQE data.");
            return;
        }

        let data=parseEQE(text);

        let wl=data.wavelength;
        let eqe=data.eqe;

        if(wl.length<5){
            alert("Not enough data points.");
            return;
        }

        let jsc=calculateJsc(wl,eqe);
        let Eg=estimateBandgap(wl,eqe);

        let html="";

        html+="<b>Short Circuit Current Density:</b> "+jsc.toFixed(2)+" mA/cm²<br>";

        if(Eg){
            html+="<b>Estimated Bandgap:</b> "+Eg.toFixed(2)+" eV";
        }

        document.getElementById("eqe_results").innerHTML=html;

        plotEQE(wl,eqe);

    }
    catch(err){

        console.error(err);

        document.getElementById("eqe_results").innerHTML=
            "<b>Error:</b> "+err.message;
    }
}

document.addEventListener("DOMContentLoaded",async function(){

    await loadAM15();

    initializeEQEPlot();

});