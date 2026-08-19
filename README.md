This code generates random but controlled images from pyramidal TIFF files.

it has only one dependency (to sharp) and is highly configurable;
- dimensions of [tiffoftheday.js](https://github.com/user-attachments/files/31242019/tiffoftheday.js)
generated image
- min and max zooming levels
- polygons to define valid regions for maps for example)
- some colors
- some ratios


usage:

npm install
node tiffoftheday.js image.tif
or 
deno -A tiffoftheday.js image.tif

this generates a tiffoftheday.jpg 

<img width="1280" height="1280" alt="tiffoftheday" src="https://github.com/user-attachments/assets/74b6d75e-c179-4f03-aad7-f37a3d595205" />
