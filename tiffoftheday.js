import sharp from "sharp"
import { parseArgs } from "node:util"
import fs from "node:fs"

const validlevels = [];

// poly is an array of [ x, y ] elements
// range in percent ([0 1])
function pointinpoly(x, y, poly)
{
    let c = false;
    for (let l = poly.length, i = 0, j = l - 1; i < l; j = i++) {
        let xj = poly[j][0], yj = poly[j][1], xi = poly[i][0], yi = poly[i][1];
        let where = (yi - yj) * (x - xi) - (xi - xj) * (y - yi);
        if (yj < yi) {
            if (y >= yj && y < yi) {
                if (where == 0) return true;    // point on the line
                if (where > 0) {
                    if (y == yj) {                // ray intersects vertex
                        if (y > poly[j == 0 ? l - 1 : j - 1][1]) {
                            c = !c;
                        }
                    } else {
                        c = !c;
                    }
                }
            }
        } else if (yi < yj) {
            if (y > yi && y <= yj) {
                if (where == 0) return true;    // point on the line
                if (where < 0) {
                    if (y == yj) {                // ray intersects vertex
                        if (y < poly[j == 0 ? l - 1 : j - 1][1]) {
                            c = !c;
                        }
                    } else {
                        c = !c;
                    }
                }
            }
        } else if (y == yi && (x >= xj && x <= xi || x >= xi && x <= xj)) {
            return true;     // point on horizontal edge
        }
    }
    return c;
}

const cli_config = {
    options: {
        config: { type: 'string', short: "c", default: "" },
        width: { type: 'string', default: "1874" }, // generated image width
        height: { type: 'string', default: "1440" }, // generated image heioht
        border: { type: 'string', default: "4" },  // overview border size
        ovroffset: { type: 'string', default: "50" }, // overview topright offset
        cropborder: { type: 'string', default: "5" }, // hidhlight border  size 
        ovrratio: { type: 'string', default: "5" }, // gernerated iamge width to overiew widtg ratio
        filtlvlmin: { type: 'string', default: "2" }, // minimum tiff level
        filtlvlmax: { type: 'string', default: "256" }, // maximum tiff level
        background: { type: 'string', default: "white" }, // borders color
        validregion: { type: 'string', default: "[[[0.0,0.0],[ 1.0,0.0], [1.0, 1.0],[0.0, 1.0]]]" }, // valid area polygons in %
        verbose: { type: 'boolean', short: "v", default: false }
    },
    allowPositionals: true
};

let params = {};
let verbose = false;

function initParameters()
{
    const { values, positionals } = parseArgs(cli_config);
    params = values;
    verbose = getStringParameterValue('verbose');
    if (verbose) console.log(values, positionals);
    let configfile = getStringParameterValue("config");

    if (configfile != "") {
        const contents = fs.readFileSync(configfile, { encoding: "utf-8" });
        let params_values = JSON.parse(contents);
        for (let name in params_values) {
            params[name] = params_values[name];
        }
    }
    if (positionals.length > 0)
        return positionals[0];

    return "";
}

function getIntParameterValue(name)
{
    return name in params ? Number(params[name]) : undefined;
}

function getStringParameterValue(name)
{
    return name in params ? params[name] : "";
}
function isvalid(xpc, ypc)
{
    let validregionstr = getStringParameterValue("validregion");
    console.log(validregionstr);
    let validregion = JSON.parse(validregionstr);
    let numpolygons = validregion.length;
    let insidearray = [];
    console.log("polygons", numpolygons);
    for (let p = 0; p < numpolygons; ++p) {
        let poly = validregion[p];
        let inside = pointinpoly(xpc, ypc, poly);
        if (inside) insidearray.push(p);
        if (verbose) console.log("polygon", poly, inside);
    }
    if (verbose && insidearray.length == 0)  console.log("rejected");
    return insidearray.length > 0;
}

async function tiffoftheday()
{
    const imagename = initParameters();
    const imageinfo = await sharp(imagename, { limitInputPixels: false }).metadata();
    if (verbose) console.log(imageinfo)
    const pages = "pages" in imageinfo ? imageinfo.pages : 0;
    const validlevels = [];
    let ovrwidth = Infinity;
    let ovrlevel = 0;

    const border = getIntParameterValue('border');
    const ovroffset = getIntParameterValue('ovroffset');
    const ovrratio = getIntParameterValue('ovrratio');
    const cropborder = getIntParameterValue('cropborder');
    const filtlvlmin = getIntParameterValue('filtlvlmin');
    const filtlvlmax = getIntParameterValue('filtlvlmax');
    const outputwidth = getIntParameterValue('width')
    const outputheight = getIntParameterValue('height');
    const background = getStringParameterValue('background')
    if (pages < 1) {
        validlevels.push({ page: 0, width: imageinfo.width, height: imageinfo.height });
        ovrlevel = 0;
        ovrwidth = imageinfo.width;
    } else {
        for (let currentpage = 0; currentpage < pages; currentpage++) {
            const pageinfo = await sharp(imagename, {
                limitInputPixels: false,
                page: currentpage
            }).metadata();
            const lwidth = pageinfo.width;
            const lheight = pageinfo.height;
            if (verbose) console.log("page", lwidth, lheight);
            if ((lwidth >= (outputwidth * filtlvlmin)) && (lheight >= (outputheight * filtlvlmin))
                && (lwidth <= (outputwidth * filtlvlmax)) && (lheight <= (outputheight * filtlvlmax))) {
                validlevels.push({ page: currentpage, width: lwidth, height: lheight });
                if (lwidth < ovrwidth) {
                    ovrwidth = lwidth;
                    ovrlevel = validlevels.length - 1;
                }
            }
        }
    }
    if (validlevels.length == 0) {
        console.log("No valid levels found");
        process.exit(1);
    }

    if (verbose) console.log("ovr", ovrlevel, ovrwidth);

    const level = validlevels[Math.floor(Math.random() * validlevels.length)];
    if (verbose) console.log("selected level", level);
    const page = level.page;
    const width = level.width;
    const height = level.height;

    let x, y, xpc, ypc;

    do {
        x = Math.floor(outputwidth / 2 + Math.random() * (level.width - outputwidth));
        y = Math.floor(outputheight / 2 + Math.random() * (level.height - outputheight));
        if (x < 0 || y < 0) {
            if (verbose) console.log("image too small");
            process.exit();
        }
        xpc = x / level.width;
        ypc = y / level.height;
        if (verbose) console.log("coords in level", xpc, ypc);
    } while (!isvalid(xpc, ypc));

    const overview_original_ratio = validlevels[ovrlevel].width / validlevels[ovrlevel].height;
    const new_overview_width = Math.floor(outputwidth / ovrratio);
    const new_overview_height = Math.floor(new_overview_width / overview_original_ratio);

    const overview = await sharp(imagename, {
        limitInputPixels: false,
        page: ovrlevel
    }).resize(new_overview_width, new_overview_height)
        .extend({ left: border, right: border, top: border, bottom: border, background: background })
        .toFile("overview.jpg");

    const cropzone = {
        left: Math.floor(x - outputwidth / 2),
        top: Math.floor(y - outputheight / 2),
        width: outputwidth,
        height: outputheight
    };

    const cropwidth = Math.floor((cropzone.width / level.width) * new_overview_width);
    const cropheight = Math.floor((cropzone.height / level.height) * new_overview_height);
    const cropx = Math.floor((cropzone.left / level.width) * new_overview_width);
    const cropy = Math.floor((cropzone.top / level.height) * new_overview_height);

    if (verbose) console.log("cropzone", cropzone);

    const extract = await sharp(imagename, {
        limitInputPixels: false, page: level.page
    })
        .extract(cropzone)
        .toFile("extract.jpg");

    if (verbose) console.log("crop", cropx, cropy, cropwidth, cropheight);
    const crophighlight = await sharp("extract.jpg")
        .resize(cropwidth, cropheight)
        // .tint('red')
        .extend({ left: cropborder, right: cropborder, top: cropborder, bottom: cropborder, background: background })
        .toFile("highlight.jpg");

    const generated_name = `tiffoftheday_${Math.floor(Date.now() / 1000)}.jpg`;
    const finalimage = await sharp("extract.jpg")
        .composite([{
            input: "overview.jpg",
            top: ovroffset - border,
            left: outputwidth - new_overview_width - ovroffset - border
        },
        {
            input: "highlight.jpg",
            top: ovroffset + cropy - cropborder,
            left: cropx - cropborder + outputwidth - new_overview_width - ovroffset
        }])
        .toFile(generated_name);
    console.log(`generated ${generated_name}`);
}

tiffoftheday();