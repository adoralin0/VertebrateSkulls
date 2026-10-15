#!/usr/bin/env python3
"""
split_glb.py - split one .glb skull model into smaller .glb files by part,
so Voyager can show / hide / fade each group (Voyager can't hide pieces
inside a single file).

No extra installs needed: plain Python 3.

Usage
-----
    python3 tools/split_glb.py INPUT.glb OUTPUT_FOLDER  group=Part1,Part2  rest=*

  * Each "name=..." argument makes OUTPUT_FOLDER/name.glb holding those parts
    (node names as they appear in Blender / the SkeletalGrowthDB json "PartName").
  * "*" means "every part not already used by another group".
  * Add --no-compress to keep the original float precision.
  * --click GROUP   : the group that clicking the model shows/hides
  * --fade 0.15     : also give the click group a see-through step (cycle:
                      solid -> faded -> hidden), 0.15 = 15% opacity
  * The folder also gets scene.svx.json, the Voyager scene file the website loads.

Example (adult Aotus skull, calotte separate from the rest):

    python3 tools/split_glb.py DWA-Aotus1_Taxon.glb models/DWA-Aotus1_Taxon \
        calotte=Calotte skull=* --click calotte

By default the script also shrinks files ~45% for phones/tablets:
  - normals stored as 8-bit, positions as 16-bit (KHR_mesh_quantization,
    supported by Voyager / three.js; ~0.001 mm precision on a skull)
  - texture coordinates dropped when the model has no textures
  - small meshes get 16-bit triangle indices
"""
import json, struct, sys, os, math
from array import array

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, _ = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67:
        sys.exit(f'{path} is not a .glb file')
    off, gltf, binary = 12, None, b''
    while off < len(data):
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk)
        elif ctype == 0x004E4942:
            binary = chunk
        off += 8 + clen
    return gltf, binary


def read_accessor(g, binary, idx):
    a = g['accessors'][idx]
    bv = g['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    stride = bv.get('byteStride', size * n)
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = array(fmt)
    if stride == size * n:
        out.frombytes(binary[start: start + a['count'] * stride])
    else:
        for i in range(a['count']):
            s = start + i * stride
            out.frombytes(binary[s: s + size * n])
    return a, out, n


class Writer:
    def __init__(self):
        self.bin = bytearray()
        self.g = {'asset': {'version': '2.0', 'generator': 'VertebrateSkulls split_glb.py'},
                  'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
                  'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}]}

    def view(self, raw, target, stride=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        bv = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(raw), 'target': target}
        if stride:
            bv['byteStride'] = stride
        self.bin += raw
        self.g['bufferViews'].append(bv)
        return len(self.g['bufferViews']) - 1

    def accessor(self, raw, ctype, atype, count, target, stride=None, normalized=False, mn=None, mx=None):
        acc = {'bufferView': self.view(raw, target, stride), 'componentType': ctype, 'type': atype, 'count': count}
        if normalized:
            acc['normalized'] = True
        if mn is not None:
            acc['min'], acc['max'] = mn, mx
        self.g['accessors'].append(acc)
        return len(self.g['accessors']) - 1

    def save(self, path):
        self.g['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.g, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        binb = bytes(self.bin) + b'\0' * ((4 - len(self.bin) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(binb)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(binb), 0x004E4942)); f.write(binb)


def add_primitive(w, g, binary, prim, compress, mat_map, has_textures):
    out = {'attributes': {}}
    pos_a, pos, _ = read_accessor(g, binary, prim['attributes']['POSITION'])
    count = pos_a['count']
    dequant = None
    if compress:
        mn = [min(pos[i::3]) for i in range(3)]
        mx = [max(pos[i::3]) for i in range(3)]
        center = [(mn[i] + mx[i]) / 2 for i in range(3)]
        half = [max((mx[i] - mn[i]) / 2, 1e-9) for i in range(3)]
        q = array('h', [0]) * (count * 4)  # pad to 8 bytes per vertex (4-byte alignment)
        for v in range(count):
            for i in range(3):
                q[v * 4 + i] = int(round((pos[v * 3 + i] - center[i]) / half[i] * 32767))
        qmn = [int(round((mn[i] - center[i]) / half[i] * 32767)) for i in range(3)]
        qmx = [int(round((mx[i] - center[i]) / half[i] * 32767)) for i in range(3)]
        out['attributes']['POSITION'] = w.accessor(q.tobytes(), 5122, 'VEC3', count, 34962, 8, True,
                                                   [x / 32767 for x in qmn], [x / 32767 for x in qmx])
        dequant = {'translation': center, 'scale': half}
    else:
        out['attributes']['POSITION'] = w.accessor(pos.tobytes(), 5126, 'VEC3', count, 34962, None, False,
                                                   pos_a.get('min'), pos_a.get('max'))
    for name, idx in prim['attributes'].items():
        if name == 'POSITION':
            continue
        if name.startswith('TEXCOORD') and compress and not has_textures:
            continue
        a, vals, n = read_accessor(g, binary, idx)
        if name == 'NORMAL' and compress:
            q = array('b', [0]) * (count * 4)
            for v in range(count):
                x, y, z = vals[v * 3], vals[v * 3 + 1], vals[v * 3 + 2]
                L = math.sqrt(x * x + y * y + z * z) or 1.0
                q[v * 4], q[v * 4 + 1], q[v * 4 + 2] = (int(round(c / L * 127)) for c in (x, y, z))
            out['attributes'][name] = w.accessor(q.tobytes(), 5120, 'VEC3', count, 34962, 4, True)
        else:
            out['attributes'][name] = w.accessor(vals.tobytes(), a['componentType'], a['type'], count,
                                                 34962, None, a.get('normalized', False), a.get('min'), a.get('max'))
    if 'indices' in prim:
        a, idx, _ = read_accessor(g, binary, prim['indices'])
        if compress and count < 65536 and a['componentType'] == 5125:
            idx = array('H', idx)
            out['indices'] = w.accessor(idx.tobytes(), 5123, 'SCALAR', a['count'], 34963)
        else:
            out['indices'] = w.accessor(idx.tobytes(), a['componentType'], 'SCALAR', a['count'], 34963)
    if 'mode' in prim:
        out['mode'] = prim['mode']
    if 'material' in prim:
        m = prim['material']
        if m not in mat_map:
            w.g.setdefault('materials', []).append(g['materials'][m])
            mat_map[m] = len(w.g['materials']) - 1
        out['material'] = mat_map[m]
    return out, dequant


def build(g, binary, node_ids, compress):
    w = Writer()
    mat_map = {}
    has_textures = bool(g.get('textures'))
    if has_textures and compress:
        print('  note: model has textures; texture images are not copied by this script')
    for ni in node_ids:
        node = g['nodes'][ni]
        if node.get('children'):
            print(f"  warning: '{node.get('name')}' has child parts; only its own mesh is copied")
        base = {k: node[k] for k in ('name', 'translation', 'rotation', 'scale', 'matrix') if k in node}
        w.g['nodes'].append(base)
        base_idx = len(w.g['nodes']) - 1
        w.g['scenes'][0]['nodes'].append(base_idx)
        if 'mesh' not in node:
            continue
        mesh = g['meshes'][node['mesh']]
        prims, deq = [], []
        for p in mesh['primitives']:
            prim, d = add_primitive(w, g, binary, p, compress, mat_map, has_textures)
            prims.append(prim); deq.append(d)
        # one child node per primitive when quantized (each has its own dequant transform)
        for prim, d in zip(prims, deq):
            w.g['meshes'].append({'name': mesh.get('name', ''), 'primitives': [prim]})
            child = {'mesh': len(w.g['meshes']) - 1}
            if d:
                child.update(d)
            w.g['nodes'].append(child)
            base.setdefault('children', []).append(len(w.g['nodes']) - 1)
    if compress:
        w.g['extensionsUsed'] = ['KHR_mesh_quantization']
        w.g['extensionsRequired'] = ['KHR_mesh_quantization']
    if 'copyright' in g.get('asset', {}):
        w.g['asset']['copyright'] = g['asset']['copyright']
    return w


def write_scene(outdir, groups, click=None, fade=None, title=''):
    """Write scene.svx.json (Voyager's scene file) listing every group.
    The click group gets tag 'show'; with fade, a see-through copy tagged 'fade'."""
    tpl = {
        "asset": {"type": "application/si-dpo-3d.document+json", "version": "2.0",
                  "generator": "VertebrateSkulls split_glb.py"},
        "scene": 0,
        "scenes": [{"units": "mm", "name": title, "nodes": [0, 1], "setup": 0}],
        "nodes": [{"translation": [0, 0, 150], "camera": 0},
                  {"name": "Lights", "children": [2, 3, 4]},
                  {"name": "Key", "light": 0, "rotation": [0.4829741, -0.1070728, 0.1880998, 0.8484633]},
                  {"name": "Fill", "light": 1, "rotation": [0.3546969, 0.163893, -0.3861077, 0.8356136]},
                  {"name": "Environment", "light": 2}],
        "cameras": [{"type": "perspective", "perspective": {"yfov": 52, "znear": 0.1, "zfar": 100000}}],
        "lights": [{"color": [1, 0.95, 0.9], "intensity": 1, "type": "directional"},
                   {"color": [0.9, 0.95, 1], "intensity": 0.6, "type": "directional"},
                   {"intensity": 1, "type": "environment"}],
        "models": [],
        "setups": [{
            "units": "mm",
            "interface": {"visible": True, "logo": False, "menu": True, "tools": True},
            "viewer": {"shader": "Default", "toneMapping": False, "exposure": 1, "gamma": 2,
                       "annotationsVisible": False, "activeTags": "show" if click else ""},
            "reader": {"enabled": False, "position": "Overlay"},
            "navigation": {"type": "Orbit", "enabled": True, "autoZoom": True, "lightsFollowCamera": True,
                           "autoRotation": False,
                           "orbit": {"orbit": [-25, -25, 0], "offset": [0, 0, 150],
                                     "minOrbit": [-90, None, None], "maxOrbit": [90, None, None],
                                     "minOffset": [None, None, 0.1], "maxOffset": [None, None, 10000]}},
            "background": {"style": "Solid", "color0": [0.07, 0.07, 0.07], "color1": [0, 0, 0]},
            "floor": {"visible": False, "position": [0, -25, 0], "size": 50, "color": [0.6, 0.75, 0.8],
                      "opacity": 0.5, "receiveShadow": False},
            "grid": {"visible": False, "color": [0.5, 0.7, 0.8]},
            "tape": {"enabled": False, "startPosition": [0, 0, 0], "startDirection": [0, 0, 0],
                     "endPosition": [0, 0, 0], "endDirection": [0, 0, 0]},
            "slicer": {"enabled": False, "axis": "X", "inverted": False, "position": 0.5}
        }]
    }

    def add(name, tags=None, opacity=None):
        path = os.path.join(outdir, name + '.glb')
        model = {"units": "mm", "derivatives": [{"usage": "Web3D", "quality": "High", "assets": [
            {"uri": name + ".glb", "type": "Model", "byteSize": os.path.getsize(path)}]}]}
        if tags:
            model["tags"] = tags
        if opacity is not None:
            g, _ = read_glb(path)
            mats = g.get('materials') or [{}]
            color = mats[0].get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.8, 0.8, 0.8])[:3]
            model["material"] = {"color": color, "opacity": opacity, "roughness": 0.5, "metalness": 0,
                                 "doubleSided": True}
        tpl["models"].append(model)
        tpl["nodes"].append({"name": name + (" (faded)" if opacity is not None else ""),
                             "model": len(tpl["models"]) - 1})
        tpl["scenes"][0]["nodes"].append(len(tpl["nodes"]) - 1)

    for name, _ in groups:
        add(name, "show" if name == click else None)
        if name == click and fade is not None:
            add(name, "fade", fade)
    path = os.path.join(outdir, 'scene.svx.json')
    with open(path, 'w') as f:
        json.dump(tpl, f, indent=2)
    print(f'  {path}: Voyager scene ({len(tpl["models"])} model(s))')


def opt(argv, name):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1]
    return None


def main(argv):
    compress = '--no-compress' not in argv
    click, fade = opt(argv, '--click'), opt(argv, '--fade')
    fade = float(fade) if fade else None
    skip = {v for v in (opt(argv, '--click'), opt(argv, '--fade')) if v}
    args = [a for a in argv if not a.startswith('--') and a not in skip]
    if len(args) < 3:
        sys.exit(__doc__)
    src, outdir, specs = args[0], args[1], args[2:]
    g, binary = read_glb(src)
    scene_nodes = g['scenes'][g.get('scene', 0)]['nodes']
    by_name = {g['nodes'][i].get('name'): i for i in scene_nodes}
    used, groups = set(), []
    for spec in specs:
        name, parts = spec.split('=', 1)
        if parts == '*':
            groups.append((name, None)); continue
        ids = []
        for p in parts.split(','):
            if p not in by_name:
                sys.exit(f"part '{p}' not found. Parts in this file: {', '.join(sorted(by_name))}")
            ids.append(by_name[p]); used.add(by_name[p])
        groups.append((name, ids))
    os.makedirs(outdir, exist_ok=True)
    for name, ids in groups:
        if ids is None:
            ids = [i for i in scene_nodes if i not in used]
        w = build(g, binary, ids, compress)
        path = os.path.join(outdir, name + '.glb')
        w.save(path)
        print(f'  {path}: {len(ids)} part(s), {os.path.getsize(path) / 1e6:.1f} MB')
    if click and click not in [n for n, _ in groups]:
        sys.exit(f"--click {click}: no group with that name")
    write_scene(outdir, groups, click, fade, os.path.basename(outdir.rstrip('/')))


if __name__ == '__main__':
    main(sys.argv[1:])
