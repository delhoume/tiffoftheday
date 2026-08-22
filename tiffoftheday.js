import sharp from "sharp"
import { parseArgs } from "node:util"
import fs from "node:fs"

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
        level: { type: 'string', default: "-1" }, // selected level in image
        x: { type: 'string', default: "-1" }, // x position in level imagee
        y: { type: 'string', default: "-1" }, // y position in level image
        overviewoffset: { type: 'string', default: "50" }, // overview topright offset
        highlightborder: { type: 'string', default: "5" }, // highlight border  size 
        overviewborder: { type: 'string', default: "5" }, // generated iamge width to overiew width ratio
        overviewratio: { type: 'string', default: "5" }, // generated iamge width to overiew width ratio
        levelratiomin: { type: 'string', default: "2" }, // minimum ratio between full and selected images
        levelratiomax: { type: 'string', default: "256" }, // maximum ratio between full and selected images
        overviewbordercolor: { type: 'string', default: "white" }, // borders color
        hisghlightbordercolor: { type: 'string', default: "white" }, // borders color
        validregion: { type: 'string', default: "[[[0.0,0.0],[ 1.0,0.0], [1.0, 1.0],[0.0, 1.0]]]" }, // valid area polygons in %
        verbose: { type: 'boolean', short: "v", default: false },
        notimestamp: { type: 'boolean', default: false }
    },
    allowPositionals: true,
    tokens: true
};


let params = {};
let verbose = false;

function initParameters()
{
    const { values, positionals, tokens } = parseArgs(cli_config);
    console.log(tokens);
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
    console.log(params);
    // second pass on token to overwrite with cli arguments 
    //  --width 2000 -c congif.json alwas sets width to 2000
    tokens.filter((token) => token.kind === 'option')
        .forEach((token) =>
        {
            const name = token.name;
            if (token.value)
                params[name] = token.value;
        });
    console.log(params);
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
    if (verbose && insidearray.length == 0) console.log("rejected");
    return insidearray.length > 0;
}

async function tiffoftheday()
{
    const imagename = initParameters();
    const imageinfo = await sharp(imagename, { limitInputPixels: false }).metadata();
    if (verbose) console.log(imageinfo)
    const pages = "pages" in imageinfo ? imageinfo.pages : 0;
    const validlevels = [];
    const levels = [];
    let overviewwidth = Infinity;
    let overviewlevel = 0;

    const overviewborder = getIntParameterValue('overviewborder');
    const highlightborder = getIntParameterValue('highlightborder');
    const overviewoffset = getIntParameterValue('overviewoffset');
    const overviewratio = getIntParameterValue('overviewratio');
    const levelratiomin = getIntParameterValue('levelratiomin');
    const levelratiomax = getIntParameterValue('levelratiomax');
    const outputwidth = getIntParameterValue('width')
    const outputheight = getIntParameterValue('height');
    const overviewbordercolor = getStringParameterValue('overviewbordercolor')
    const highlighbordercolor = getStringParameterValue('highlightbordercolor')
    if (pages == 0) {
        validlevels.push({ page: 0, width: imageinfo.width, height: imageinfo.height });
        overviewlevel = 0;
        overviewwidth = imageinfo.width;
    } else {
        for (let currentpage = 0; currentpage < pages; currentpage++) {
            const pageinfo = await sharp(imagename, {
                limitInputPixels: false,
                page: currentpage
            }).metadata();
            const lwidth = pageinfo.width;
            const lheight = pageinfo.height;
            let isvalid = (lwidth >= (outputwidth * levelratiomin)) && (lheight >= (outputheight * levelratiomin))
                && (lwidth <= (outputwidth * levelratiomax)) && (lheight <= (outputheight * levelratiomax))
            levels.push({ page: currentpage, width: lwidth, height: lheight, valid: isvalid });
            if (isvalid) {
                validlevels.push(currentpage);
                // find smallest of valid pages
                if (lwidth < overviewwidth) {
                    overviewwidth = lwidth;
                    overviewlevel = currentpage;
                }
            }
        }
    }
    if (validlevels.length == 0) {
        console.log("No valid levels found");
        process.exit(1);
    }

    if (verbose) console.log("levels", levels);
    if (verbose) console.log("valid levels", validlevels);
    if (verbose) console.log("overview level", overviewlevel, levels[overviewlevel]);

    let levelidx = getIntParameterValue("level")
    if (levelidx == -1)
        levelidx = validlevels[Math.floor(Math.random() * validlevels.length)];
     const level = levels[levelidx];
    if (verbose) console.log("selected level", levelidx, level);
  if (!validlevels.includes(levelidx)) {
        console.log("selected level does not respect constraints");
        process.exit(1)
    }
    let x, y, xpc, ypc;

    if (verbose) console.log("Selecting valid area");
    do {
        x = Math.floor(outputwidth / 2 + Math.random() * (level.width - outputwidth));
        y = Math.floor(outputheight / 2 + Math.random() * (level.height - outputheight));
        if (x < 0 || y < 0) {
            if (verbose) console.log("image too small");
            process.exit();
        }
        xpc = x / level.width;
        ypc = y / level.height;
        if (verbose) console.log("tring", x, y, "(", Math.round(xpc * 100) / 100, Math.round(ypc * 100) / 100., "%)");
    } while (!isvalid(xpc, ypc));

    let xorig = getIntParameterValue("x");
    let yorig = getIntParameterValue("y");

    if (xorig != -1) x = xorig;
    if (yorig != -1) y = yorig;

    xpc = x / level.width;
    ypc = y / level.height;


    const overview_original_ratio = levels[overviewlevel].width / levels[overviewlevel].height;
    const new_overview_width = Math.floor(outputwidth / overviewratio);
    const new_overview_height = Math.floor(new_overview_width / overview_original_ratio);

    if (verbose) console.log("generating overview");
    const overview = await sharp(imagename, {
        limitInputPixels: false,
        page: overviewlevel
    }).resize(new_overview_width, new_overview_height)
        .extend({ left: overviewborder, right: overviewborder, top: overviewborder, bottom: overviewborder, background: overviewbordercolor })
        .toFile("overview.jpg");

    const cropzone = {
        left: Math.floor(x - outputwidth / 2),
        top: Math.floor(y - outputheight / 2),
        width: outputwidth,
        height: outputheight
    };
    if (verbose) console.log("extracting selected detail image");
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

    if (verbose) console.log("generating highlight in overview");
    if (verbose) console.log("highlight location in overview", cropx, cropy, cropwidth, cropheight);
    const crophighlight = await sharp("extract.jpg")
        .resize(cropwidth, cropheight)
        // .tint('red')
        .extend({ left: highlightborder, right: highlightborder, top: highlightborder, bottom: highlightborder, background: highlighbordercolor })
        .toFile("highlight.jpg");
    if (verbose) console.log("compositing final image");
    const suffix = getStringParameterValue('notimestamp') ? "" : `_${Math.floor(Date.now() / 1000)}`;
    const generated_name = `tiffoftheday${suffix}.jpg`;
    const finalimage = await sharp("extract.jpg")
        .composite([{
            input: "overview.jpg",
            top: overviewoffset - overviewborder,
            left: outputwidth - new_overview_width - overviewoffset - overviewborder
        },
        {
            input: "highlight.jpg",
            top: overviewoffset + cropy - highlightborder,
            left: cropx - highlightborder + outputwidth - new_overview_width - overviewoffset
        }])
        .toFile(generated_name);
    console.log(`generated ${generated_name}`);
}

tiffoftheday();