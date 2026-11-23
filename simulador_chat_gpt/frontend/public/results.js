const percent = (x) => (100 * x).toFixed(1) + " %";
const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : Number(n.toFixed(5)).toString());
const views = new Map();
function sphere(canvas, v, initial, q) {
  const ctx = canvas.getContext("2d"),
    scale = 2;
  canvas.width = canvas.height = 150 * scale;
  ctx.scale(scale, scale);
  let [yaw, pitch] = views.get(q) || [0.65, 0.25],
    start = performance.now(),
    drag = null;
  function project(x, y, z) {
    const side = x * Math.cos(yaw) - y * Math.sin(yaw);
    const depth = x * Math.sin(yaw) + y * Math.cos(yaw);
    return [
      75 + 51 * side,
      77 - 51 * (z * Math.cos(pitch) - depth * Math.sin(pitch)),
    ];
  }
  function draw(now) {
    if (!canvas.isConnected) return;
    ctx.clearRect(0, 0, 150, 150);
    ctx.fillStyle = "#eef7f0";
    ctx.beginPath();
    ctx.arc(75, 77, 51, 0, 2 * Math.PI);
    ctx.fill();
    const line = (points, color, width = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    for (let j = 0; j < 3; j++) {
      const points = [];
      for (let k = 0; k <= 72; k++) {
        const a = (k * Math.PI) / 36,
          c = Math.cos(a),
          s = Math.sin(a);
        points.push(
          project(
            ...[
              [c, s, 0],
              [c, 0, s],
              [0, c, s],
            ][j],
          ),
        );
      }
      line(points, "#b1caba");
    }
    for (const [x, y, z, l] of [
      [1, 0, 0, "x"],
      [0, 1, 0, "y"],
      [0, 0, 1, "z"],
    ]) {
      const end = project(x * 1.12, y * 1.12, z * 1.12);
      line([project(-x, -y, -z), end], "#83a692");
      ctx.fillStyle = "#456859";
      ctx.fillText(l, ...end);
    }
    const t = Math.min(1, (now - start) / 430),
      point = project(t * v[0], t * v[1], (1 - t) * initial + t * v[2]);
    line([[75, 77], point], "#0f6c4d", 3);
    ctx.beginPath();
    ctx.arc(...point, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#075840";
    ctx.fill();
    if (t < 1) requestAnimationFrame(draw);
  }
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = [e.clientX, e.clientY];
  };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    yaw += (e.clientX - drag[0]) / 65;
    pitch += (e.clientY - drag[1]) / 65;
    drag = [e.clientX, e.clientY];
    views.set(q, [yaw, pitch]);
    draw(performance.now());
  };
  canvas.onpointerup = canvas.onpointercancel = () => (drag = null);
  requestAnimationFrame(draw);
}
export function results(root, c, r) {
  const keys = r.probabilities.map((_, i) => i.toString(2).padStart(c.n, "0"));
  const p =
    c.mode === "Shot"
      ? keys.map((k) => (r.counts[k] || 0) / c.shots)
      : r.probabilities;
  const max = Math.max(...p),
    best = keys.filter((_, i) => Math.abs(p[i] - max) < 1e-10);
  const bars = keys
    .map((k, i) =>
      p[i] > 1e-12
        ? '<div class="barrow"><span>|' +
          k +
          '⟩</span><div class="track"><div class="fill" style="width:' +
          100 * p[i] +
          '%"></div></div><b>' +
          percent(p[i]) +
          "</b></div>"
        : "",
    )
    .join("");
  const rows = keys
    .map(
      (k, i) =>
        "<tr><td>|" +
        k +
        "⟩</td><td>" +
        percent(r.probabilities[i]) +
        "</td><td>" +
        (r.amplitudes
          ? fmt(r.amplitudes[i][0]) +
            " " +
            (r.amplitudes[i][1] < -1e-9 ? "−" : "+") +
            " " +
            fmt(Math.abs(r.amplitudes[i][1])) +
            "i"
          : "—") +
        "</td></tr>",
    )
    .join("");
  root.innerHTML =
    '<article class="card"><small>BASE COMPUTACIONAL</small><h3>' +
    (c.mode === "Shot"
      ? "Frecuencias · " + c.shots + " shots"
      : "Histograma de probabilidades") +
    '</h3><div class="bars">' +
    bars +
    '</div></article><article class="card"><small>ESTADO DOMINANTE</small><div class="big">|' +
    best[0] +
    "⟩</div><b>" +
    percent(max) +
    "</b><p>" +
    (best.length > 1
      ? "Empate entre " + best.length + " estados."
      : "Mayor probabilidad.") +
    '</p></article><article class="card wide"><small>ESTADOS REDUCIDOS</small><h3>Esferas de Bloch</h3><div class="spheres">' +
    r.bloch
      .map(
        (v, q) =>
          '<figure><canvas aria-label="Esfera de q' +
          q +
          '"></canvas><figcaption>q' +
          q +
          " · (" +
          v.map(fmt).join(", ") +
          ")</figcaption></figure>",
      )
      .join("") +
    '</div></article><article class="card wide"><h3>Tabla de amplitudes</h3>' +
    (r.amplitudes
      ? ""
      : "<p>Estado mixto. Las poblaciones se obtienen de la matriz de densidad.</p>") +
    '<div class="scroll"><table><thead><tr><th>Estado</th><th>Probabilidad teórica</th><th>Amplitud</th></tr></thead><tbody>' +
    rows +
    "</tbody></table></div></article>";
  if (c.mode === "Shot" && c.bits) {
    const a = document.createElement("article");
    a.className = "card wide";
    a.textContent =
      "Memoria clásica · " +
      Object.entries(r.classical)
        .filter(([, v]) => v)
        .map(([k, v]) => k + " → " + v)
        .join("  /  ");
    root.append(a);
  }
  root
    .querySelectorAll("canvas")
    .forEach((el, i) =>
      sphere(el, r.bloch[i], c.initial[c.n - i - 1] === "1" ? -1 : 1, i),
    );
}
