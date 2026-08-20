This code generates random but controlled detail images from (possibly huge) pyramidal TIFF files.

It selects a location in the full image, a zoom level, and creates a picture of the location  with an overview of global position in full image.

it has only one dependency (to sharp https://www.sharpjs.cn/) and is highly configurable:
- dimensions of image
- zoom level filtering
- colors, ratios, sizes
- polygons describing valid content areas (usefull for maps for example)

Less than 200 lines of code.
TIFF input files brings more configurability but other formats can be used.

usage:

````
npm install
node tiffoftheday.js image.tif
or 
deno -A tiffoftheday.js image.tif
```` 
this generates a tiffoftheday.jpg 

<img width="1280" height="1280" alt="tiffoftheday" src="https://github.com/user-attachments/assets/74b6d75e-c179-4f03-aad7-f37a3d595205" />
