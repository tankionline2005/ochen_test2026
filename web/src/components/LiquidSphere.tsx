import { useEffect, useRef } from 'react'

/**
 * The loading sphere: a soft four-colour glow seen through vertical fluted glass, like the reference cards
 * (Solar Flare, Ultraviolet, Glacier, Lime Soda). The colours flow inside and the whole palette slowly moves from one
 * reference to the next. WebGL fragment shader; a CSS gradient stands in where WebGL is missing.
 */

const PALETTES: [string, string, string, string][] = [
  ['#FFB020', '#FF8A00', '#FF2E63', '#FF5A1F'], // Solar Flare
  ['#8A2BFF', '#FF3EC8', '#3A1CFF', '#5CE1FF'], // Ultraviolet
  ['#B9F3FF', '#6FD3FF', '#2F6BFF', '#8C7BFF'], // Glacier
  ['#C6FF3D', '#2BE0A0', '#00B8FF', '#FFE53B'], // Lime Soda
]

// seconds a reference holds, and seconds it takes to flow into the next one
const HOLD = 1.8
const BLEND = 0.85

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p; gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision highp float;
varying vec2 uv;
uniform float t;
uniform vec3 c0, c1, c2, c3;
uniform float ribs;

float blob(vec2 q, vec2 c, float s) { vec2 d = q - c; return exp(-dot(d, d) / s); }

void main() {
  vec2 q = uv;
  // fluted glass: every rib magnifies and shifts its own slice of what is behind it
  float rw = 2.0 / ribs;
  float k = (q.x + 1.0) / rw;
  float id = floor(k);
  float f = fract(k);
  float centre = (id + 0.5) * rw - 1.0;
  float shift = sin(id * 1.7 + t * 0.35) * 0.07;
  // each rib squeezes its slice and mirrors it slightly: the image breaks at every rib, as through reeded glass
  float lens = (f - 0.5) * rw * 0.28 - (f - 0.5) * (f - 0.5) * rw * 0.5;
  vec2 g = vec2(centre + lens + shift, q.y * (0.92 + 0.06 * sin(id * 2.3 + t * 0.5)));

  // the glow: a base colour and three moving centres, mixed by soft weights
  float s = 0.42;
  vec2 a = vec2(0.30 * sin(t * 0.50), 0.26 * cos(t * 0.41));
  vec2 b = vec2(0.42 * cos(t * 0.33 + 1.0), 0.34 * sin(t * 0.29 + 2.0));
  vec2 c = vec2(0.36 * sin(t * 0.27 + 4.0), 0.40 * cos(t * 0.37 + 3.0));
  // the first colour is the core: it fills the middle, the others drift around it
  float core = exp(-dot(g, g) / 0.10);
  float w0 = 0.25 + 1.6 * core;
  float w1 = blob(g, a, s * 0.55);
  float w2 = blob(g, b, s * 0.75);
  float w3 = blob(g, c, s * 0.65);
  vec3 col = (c0 * w0 + c1 * w1 * 1.3 + c2 * w2 + c3 * w3) / (w0 + w1 * 1.3 + w2 + w3);

  // a round, very soft edge (the references look out of focus); measured on the refracted point, so the rim steps
  // from rib to rib like real fluted glass
  // ribs in the middle reach higher and lower than the ones at the sides, like light caught in the glass
  float r = length(vec2(mix(centre, q.x, 0.45) * 1.04, q.y * (0.98 + 0.12 * abs(centre))));
  float breathe = 0.80 + 0.02 * sin(t * 0.8);
  float alpha = 1.0 - smoothstep(breathe - 0.5, breathe + 0.16, r);
  alpha *= 1.0 - smoothstep(0.78, 1.0, abs(q.y));

  // rib edges: a crisp bright line on the left, a soft shade before the right edge
  float edge = smoothstep(0.045, 0.0, f) * 0.85 + smoothstep(0.985, 1.0, f) * 0.5;
  float shade = smoothstep(0.55, 1.0, f) * 0.16;
  col *= 1.0 - shade;
  col = mix(col, vec3(1.0), edge * 0.55 * smoothstep(0.02, 0.4, alpha));

  // a lazy specular highlight, the "liquid" in the glass
  float spec = blob(g, vec2(-0.25 + 0.1 * sin(t * 0.3), 0.32 + 0.06 * cos(t * 0.4)), 0.06);
  col = mix(col, vec3(1.0), spec * 0.28);

  gl_FragColor = vec4(col * alpha, alpha);
}
`

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k)
const ease = (x: number) => x * x * (3 - 2 * x)

function paletteAt(time: number): number[][] {
  const cycle = HOLD + BLEND
  const n = PALETTES.length
  const pos = time / cycle
  const i = Math.floor(pos) % n
  const local = (pos - Math.floor(pos)) * cycle
  const k = local < HOLD ? 0 : ease((local - HOLD) / BLEND)
  const from = PALETTES[i].map(hex)
  const to = PALETTES[(i + 1) % n].map(hex)
  return from.map((c, j) => lerp(c, to[j], k))
}

export function LiquidSphere({ size = 360 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fallback = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true })
    if (!gl) {
      canvas.style.display = 'none'
      if (fallback.current) fallback.current.style.display = 'block'
      return
    }
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn('sphere shader:', gl.getShaderInfoLog(sh))
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.display = 'none'
      if (fallback.current) fallback.current.style.display = 'block'
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const uT = u('t')
    const uC = [u('c0'), u('c1'), u('c2'), u('c3')]
    gl.uniform1f(u('ribs'), 8)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)

    const slow = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1
    // start on a random reference, so two runs don't look the same
    const offset = Math.random() * (HOLD + BLEND) * PALETTES.length
    const start = performance.now()
    let frame = 0
    const draw = () => {
      const time = ((performance.now() - start) / 1000) * slow
      const pal = paletteAt(time + offset)
      gl.uniform1f(uT, time + offset)
      pal.forEach((c, i) => gl.uniform3f(uC[i], c[0], c[1], c[2]))
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      frame = requestAnimationFrame(draw)
    }
    draw()
    // no loseContext() here: the canvas keeps its context across a remount (React's StrictMode runs effects twice),
    // and a lost one would fail the second run; the context goes away with the canvas
    return () => cancelAnimationFrame(frame)
  }, [size])

  return (
    <div className="sphere" style={{ width: size, height: size }}>
      <canvas ref={ref} style={{ width: size, height: size }} />
      <div ref={fallback} className="sphere-fallback" />
    </div>
  )
}
