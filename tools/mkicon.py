import zlib, struct, math

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y*w*4:(y+1)*w*4]) for y in range(h))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(raw, 9))
    out += chunk(b'IEND', b'')
    open(path, 'wb').write(out)

def lerp(a, b, t): return a + (b - a) * t
def mix(c1, c2, t): return tuple(lerp(c1[i], c2[i], t) for i in range(3))

def over(dst, i, col, a):
    """Alpha-composite col over the pixel at index i."""
    if a <= 0: return
    a = min(1.0, a)
    for k in range(3):
        dst[i+k] = int(round(dst[i+k] * (1 - a) + col[k] * a))
    dst[i+3] = int(round(dst[i+3] * (1 - a) + 255 * a))

def tri_dist(px, py, a, b, c):
    """Signed-ish coverage test: inside if on the same side of all three edges."""
    def side(p, q, r):
        return (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])
    d1 = side(a, b, (px, py)); d2 = side(b, c, (px, py)); d3 = side(c, a, (px, py))
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)

def build(size, pad_frac):
    """pad_frac leaves a safe margin so a maskable icon survives being cropped
       to a circle by the launcher."""
    SS = 4                      # supersample for smooth edges
    W = size * SS
    px = bytearray(W * W * 4)

    inner = W * (1 - 2 * pad_frac)
    ox = W * pad_frac
    r = inner * 0.235           # corner radius of the rounded square

    top = (0x9B, 0x7B, 0xFF)    # --grape
    bot = (0xFF, 0x5D, 0x8F)    # --berry

    # rounded-square background with a vertical gradient
    for y in range(W):
        ty = (y - ox) / inner if inner else 0
        col = mix(top, bot, min(1.0, max(0.0, ty)))
        for x in range(W):
            lx, ly = x - ox, y - ox
            if lx < 0 or ly < 0 or lx >= inner or ly >= inner: continue
            cx = min(max(lx, r), inner - r)
            cy = min(max(ly, r), inner - r)
            if (lx-cx)**2 + (ly-cy)**2 > r*r: continue
            i = (y*W + x) * 4
            px[i] = int(col[0]); px[i+1] = int(col[1]); px[i+2] = int(col[2]); px[i+3] = 255

    # fox, drawn in the middle of the safe area
    S = inner
    cx0 = ox + S/2
    cy0 = ox + S/2 + S*0.03
    FUR   = (0xFF, 0x8A, 0x3D)
    LIGHT = (0xFF, 0xE3, 0xB0)
    DARK  = (0x2A, 0x1F, 0x12)

    ear_w = S*0.20
    # ears
    ears = [
        ((cx0 - S*0.30, cy0 - S*0.10), (cx0 - S*0.27, cy0 - S*0.40), (cx0 - S*0.07, cy0 - S*0.19)),
        ((cx0 + S*0.30, cy0 - S*0.10), (cx0 + S*0.27, cy0 - S*0.40), (cx0 + S*0.07, cy0 - S*0.19)),
    ]
    head_r = S*0.27
    # snout triangle
    snout = ((cx0 - S*0.20, cy0 + S*0.02), (cx0 + S*0.20, cy0 + S*0.02), (cx0, cy0 + S*0.33))

    for y in range(W):
        for x in range(W):
            i = (y*W + x) * 4
            if px[i+3] == 0: continue
            p = (x, y)
            drew = False
            for e in ears:
                if tri_dist(x, y, *e):
                    over(px, i, FUR, 1); drew = True; break
            if not drew:
                d = math.hypot(x - cx0, y - cy0)
                if d <= head_r:
                    over(px, i, FUR, 1); drew = True
            if tri_dist(x, y, *snout):
                over(px, i, LIGHT, 1); drew = True
            # eyes
            for sx in (-1, 1):
                if math.hypot(x - (cx0 + sx*S*0.115), y - (cy0 - S*0.045)) <= S*0.035:
                    over(px, i, DARK, 1)
            # nose
            if math.hypot(x - cx0, (y - (cy0 + S*0.135))*1.25) <= S*0.033:
                over(px, i, DARK, 1)

    # downsample
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            r_ = g_ = b_ = a_ = 0
            for dy in range(SS):
                for dx in range(SS):
                    i = ((y*SS+dy)*W + (x*SS+dx)) * 4
                    r_ += px[i]; g_ += px[i+1]; b_ += px[i+2]; a_ += px[i+3]
            n = SS*SS
            o = (y*size + x) * 4
            out[o] = r_//n; out[o+1] = g_//n; out[o+2] = b_//n; out[o+3] = a_//n
    return out

import sys
for size, pad, name in [(192, 0.0, 'icon-192.png'), (512, 0.0, 'icon-512.png'),
                        (512, 0.14, 'icon-maskable-512.png'), (180, 0.0, 'apple-touch-icon.png')]:
    png('public/icons/' + name, size, size, build(size, pad))
    print('wrote', name)
