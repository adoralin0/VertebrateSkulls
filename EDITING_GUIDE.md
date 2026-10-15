# Editing the Vertebrate Skulls website (no programming needed)

All the words, pictures, menus and 3D models on this site come from plain text files in the
**`content/`** folder. The `.html` files and the `js/` folder build the pages from those files,
so you never need to touch them.

```
content/
  site.json          header, logo, menu, Light/Dark mode, 3D viewer settings
  models.json        every 3D model, and which viewer (Voyager or Sketchfab) shows it
  pages/
    index.json       Home page
    aotus.json       Aotus page
    aotus-teeth.json Aotus teeth page
    primates.json    Primates page
    _template.json   copy this to start a new page
models/              Voyager model files (one folder per specimen)
tools/split_glb.py   prepares a new .glb model for Voyager
```

## The 5 rules of JSON

JSON is just labelled text. Keep these rules and it will always work:

1. Text goes inside **straight double quotes**: `"title": "Juvenile Aotus Skull"`
2. Items in a list or group are separated by **commas**, but there is **no comma after the last one**.
3. Lists use square brackets `[ ... ]`, groups use curly braces `{ ... }`. Every opening bracket needs a closing one.
4. To put a double quote inside text, write `\"`.
5. Lines starting with `"_help"` or `"_note"` are notes to yourself. The website ignores them.

If a page goes blank after an edit, the page tells you which file has the mistake. Paste that file into
[jsonlint.com](https://jsonlint.com) to see the exact line. Most editors also show JSON mistakes as you type:
VS Code (free) does this, and GitHub's own editor works too.

**Formatting text:** use `<i>Aotus</i>` or `*Aotus*` for italics, `<b>…</b>` or `**…**` for bold,
and `<a href="https://…">link text</a>` for links.

---

## Change text on a page

Open the page's file in `content/pages/` and edit the words between the quotes. Each
**section** is one row of the page:

```json
{
  "type": "text-and-media",
  "mediaSide": "left",
  "title": "Juvenile <i>Aotus</i> Skull",
  "paragraphs": [
    "First paragraph.",
    "Second paragraph."
  ],
  "model": "Aotus107_Taxon",
  "caption": "Skull of juvenile <i>Aotus nancymaae</i> (Aotus107)."
}
```

Sections appear in the order you list them. To reorder the page, move a whole `{ … }` block
(and fix the commas).

### Section types

| `"type"` | What it shows | Fields |
|---|---|---|
| `text-and-media` | Text beside a picture, 3D model or video | `title`, `paragraphs`, `mediaSide` (`left`/`right`), then **one** of `image`, `model` or `embed`, plus `caption` |
| `text` | Text only | `title`, `paragraphs` |
| `heading` | A large heading | `text` |
| `callout` | The gold "Would you like to know more?" box | `title`, `text`, `links` (list of `{ "label": "…", "link": "page.html" }`) |
| `model-table` | The model grid used on the Home page | `rows` (see `index.json`) |
| `spacer` | An empty line | — |

**Picture:** `"image": "images/photo.jpg"`, `"description": "what the photo shows"` (read aloud to
blind visitors, required for accessibility), `"caption": "credit and license"`. Put the photo file in `images/`.

**Video or other embed (YouTube, a podcast player…):** `"embed": "https://www.youtube.com/embed/VIDEO_ID"`.

**3D model:** `"model": "NAME"`, where NAME is one of the names in `content/models.json`.

### Page settings (top of each page file)

| Field | Meaning |
|---|---|
| `heading` | Big title at the top of the page |
| `menuHighlight` | Which menu item is highlighted, e.g. `"Primates"` |
| `header` | `"standard"` (title + logo row) or `"classic"` (older Home-page header) |
| `fonts` | Optional Google Fonts link for that page |
| `browserTitle` | Optional text for the browser tab |

## Add a new page

1. Copy `content/pages/_template.json` to a new name, e.g. `content/pages/cebus.json`.
2. Edit the text and sections.
3. It is now live at **`page.html?page=cebus`**. Point the menu at it in `content/site.json`:
   `{ "label": "Cebus (Capuchins)", "page": "cebus" }` (use `"page"` instead of `"link"`).

Optional, for a shorter address like `cebus.html`: copy `aotus.html`, rename it, and change
`data-page="aotus"` inside it to `data-page="cebus"`.

## Edit the menu

`content/site.json` → `"menu"`. Each item is `{ "label": "Bats", "link": "bats.html" }`
(or `"page": "bats"`). Add `"submenu": [ … ]` to give an item a pop-out list, like Primates.
On phones and tablets, the first tap on an item with a submenu opens the list, and the second tap opens the page.

## Light and Dark mode

`content/site.json` → `"theme"`:
- `"default": "dark"` keeps the original black look for first-time visitors. Use `"light"` to start in light mode, or `"system"` to follow the visitor's device setting.
- `"showSwitch": false` hides the Light/Dark button under the menu.

Every visitor's choice is remembered on their device. The colors themselves are at the top of
`css/styles.css`, in the `:root` blocks (dark first, then light).

---

## 3D models: Voyager and Sketchfab

Every model has an entry in `content/models.json`:

```json
"Aotus107_Taxon": {
  "viewer": "voyager",
  "voyager":   { "folder": "models/Aotus107_Taxon/", "click": "toggle" },
  "sketchfab": { "id": "e8bcd539e0594f46a96d54da6ea6d99a", "clickParts": ["Calotte"], "click": "toggle" }
}
```

- **Switch viewers:** change `"viewer"` to `"voyager"` or `"sketchfab"`. Nothing else changes.
- **Click behaviour:** `"toggle"` = click to hide/show a part (e.g. the calotte, to see the endocranial base).
  `"cycle"` = solid → faded → hidden (used for the jaws on the teeth page). Leave `click` out to disable it.
- Clicking means a quick tap or click on the model. Dragging still rotates it.

### Add a new model to Voyager

Voyager can only show, hide or fade whole files, not pieces inside one file. So each model is split
into a few small `.glb` files, one per group of parts. The script `tools/split_glb.py` does this and
also writes the Voyager scene file. You need Python 3, which macOS already has.

1. Get the `.glb` (for example from the SkeletalGrowthDB `Models/` folder).
2. Find the part names: they are the `"PartName"` values in the matching SkeletalGrowthDB `.json`
   file. If you run the script with a wrong name, it lists the correct ones.
3. In Terminal, from the VertebrateSkulls folder, run:

   ```
   python3 tools/split_glb.py ~/Downloads/Cp17_Taxon_v0.glb models/Cp17_Taxon \
       calotte=Calotte  cranium=CranialBase  jaw=*  --click calotte
   ```
   - `name=Part1,Part2` creates `name.glb` holding those parts. `*` means "everything else".
   - `--click calotte` makes clicking show/hide that group.
   - Add `--fade 0.15` to get the solid → faded → hidden cycle (15% opacity).
   - Keep every piece under ~25 MB so GitHub and phones handle it well. If one is bigger, split that group further.
4. Add the model to `content/models.json`:
   `"Cp17_Taxon": { "viewer": "voyager", "voyager": { "folder": "models/Cp17_Taxon/", "click": "toggle" } }`
5. Use `"model": "Cp17_Taxon"` in any page section.

The script also shrinks the files by about half (positions are kept to a thousandth of a millimetre),
so models load faster on phones. Run it with `--no-compress` if you need the original files unchanged.

**Fine-tuning a model's look** (start angle, background, lighting, annotations): open the Voyager scene
file `models/NAME/scene.svx.json` in [Voyager Story](https://smithsonian.github.io/dpo-voyager/), the free
Smithsonian authoring tool, then save the result back into the same folder.

---

## Previewing on your computer

The pages read the `content/` files, which browsers block when you double-click an `.html` file.
Use a tiny local web server instead:

1. Open Terminal in the VertebrateSkulls folder. In GitHub Desktop: **Repository → Open in Terminal**.
2. Run `python3 -m http.server 8000`
3. Open <http://localhost:8000> in your browser. Press Ctrl+C in Terminal to stop.

After you commit and push with GitHub Desktop, GitHub Pages publishes the changes within a minute or two.
