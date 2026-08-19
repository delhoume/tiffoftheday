import sharp from "sharp"

const imagename = process.argv[2];
const imageinfo = await sharp(imagename, { limitInputPixels: false }).metadata();

const validlevels = [];

const cassini_valid_polygon = [[.55, .05], [.9, .25], [.8, .8], [.3, .85], [.1, .3]];

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

const output = {
    // trmnlx 
    // width: 1872,
    // height: 1440,
    width: 1280,
    height: 1280,
    border: 4,
    ovroffset: 50, // offset from top right
    cropborder: 2,
    ovrratio: 4,
    filtlvlmin: 2, // filter level
    filtlvlmax: 16, // filter level
    background: 'white',
   // clip: [cassini_valid_polygon],
    isvalid: function (out, xpc, ypc)
    {
        if ("clip" in out) {
            for (const poly of out.clip) {
                if (!pointinpoly(xpc, ypc, poly)) {
                    return false;
                }
            }
        }
        return true;
    }
};

console.log(imageinfo);
if (imageinfo.format == "tiff") {
    const pages = imageinfo.pages;
    const zvalidlevels = [];
    let ovrwidth = Infinity;
    let ovrlevel = 0;

    const filtlvlmin = 'filtlvlmin' in output ? output.filtlvlmin : 1;
    const filtlvlmax = 'filtlvlmax' in output ? output.filtlvlmax : 128;
    console.log(output);
    for (let currentpage = 0; currentpage < pages; currentpage++) {
        const pageinfo = await sharp(imagename, {
            limitInputPixels: false,
            page: currentpage
        }).metadata();
        const lwidth = pageinfo.width;
        const lheight = pageinfo.height;
        console.log("page", lwidth, lheight);
        if ((lwidth >= (output.width * filtlvlmin)) && (lheight >= (output.height * filtlvlmin))
            && (lwidth <= (output.width * filtlvlmax)) && (lheight <= (output.height * filtlvlmax))) {
            validlevels.push({page: currentpage, width: lwidth, height: lheight });                
            if (lwidth < ovrwidth) {    
                ovrwidth = lwidth;
                ovrlevel = validlevels.length;
            }
        }
    }

    if (validlevels.length == 0) {
        console.log("No valid levels found");
        process.exit(1);
    }

    ovrlevel -= 1;
    console.log("ovr", ovrlevel, ovrwidth);

    const level = validlevels[Math.floor(Math.random() * validlevels.length)];
    console.log("level", level);
    const page = level.page;
    const width = level.width;
    const height = level.height;

    let x, y, xpc, ypc;

    do {
        x = output.width / 2 + Math.floor(Math.random() * (level.width - output.width));
        y = output.height / 2 + Math.floor(Math.random() * (level.height - output.height));
        xpc = x / level.width;
        ypc = y / level.height;
        console.log(x, y, xpc, ypc);
    } while (!output.isvalid(output, xpc, ypc));

    const overview_original_ratio = validlevels[ovrlevel].width / validlevels[ovrlevel].height;
    const new_overview_width = Math.floor(output.width / output.ovrratio);
    const new_overview_height = Math.floor(new_overview_width / overview_original_ratio);

    const border = 'border' in output ? output.border : 8;
    const ovroffset = 'ovroffset' in output ? output.ovroffset : 50;
    const cropborder = 'cropborder' in output ? output.cropborder : 4;
    const background = 'background' in output ? output.background : 'white';
    const overview = await sharp(imagename, {
        limitInputPixels: false,
        page: ovrlevel
    }).resize(new_overview_width, new_overview_height)
        .extend({ left: border, right: border, top: border, bottom: border, background: background })
        .toFile("overview.jpg");

    const cropzone = {
        left: x - output.width / 2,
        top: y - output.height / 2,
        width: output.width,
        height: output.height
    };

    const cropwidth = Math.floor((cropzone.width / level.width) * new_overview_width);
    const cropheight = Math.floor((cropzone.height / level.height) * new_overview_height);
    const cropx = Math.floor((cropzone.left / level.width) * new_overview_width);
    const cropy = Math.floor((cropzone.top / level.height) * new_overview_height);

    console.log(cropzone);

    const extract = await sharp(imagename, {
        limitInputPixels: false, page: level.page
    })
        .extract(cropzone)
        .toFile("extract.jpg");

    console.log("crop", cropx, cropy, cropwidth, cropheight);
    const crophighlight = await sharp("extract.jpg")
        .resize(cropwidth, cropheight)
        // .tint('red')
        .extend({ left: cropborder, right: cropborder, top: cropborder, bottom: cropborder, background: background })
        .toFile("highlight.jpg");

    const finalimage = await sharp("extract.jpg")
        .composite([{
            input: "overview.jpg",
            top: ovroffset - border,
            left: output.width - new_overview_width - ovroffset - border
        },
        {
            input: "highlight.jpg",
            top: ovroffset + cropy - cropborder,
            left: cropx - cropborder + output.width - new_overview_width - ovroffset
        }])
        .toFile("tiffoftheday.jpg");
}