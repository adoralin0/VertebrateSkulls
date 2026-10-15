# VertebrateSkulls

Website of the DeLeon Lab (UF Anthropology) showing 3D models of vertebrate skulls, part of the
SkeletalGrowth collaboration with the Digital Worlds Institute.

- **Edit the site without programming:** see [EDITING_GUIDE.md](EDITING_GUIDE.md). All content lives in `content/*.json`.
- **3D viewer:** [Smithsonian Voyager](https://smithsonian.github.io/dpo-voyager/), loading models from `models/`
  (split from the [SkeletalGrowthDB](https://github.com/digitalworlds/SkeletalGrowthDB) `.glb` files with `tools/split_glb.py`).
  Any model can switch back to Sketchfab in `content/models.json`.
- Works on phones, tablets and desktops. Light and dark mode.

Preview locally: `python3 -m http.server 8000`, then open http://localhost:8000
