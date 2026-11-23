export function opticalProbabilities(phase, second, blocked) {
  if (blocked) return second ? [0.25, 0.25, 0.5] : [0.5, 0, 0.5];
  if (!second) return [0.5, 0.5, 0];
  const p = Math.cos(phase / 2) ** 2;
  return [p, 1 - p, 0];
}
export function outcome(p, r = Math.random()) {
  return r < p[0] ? 0 : r < p[0] + p[1] ? 1 : 2;
}
export function learn() {
  const navbar = document.getElementById("lessons"),
    root = document.getElementById("lesson");
  const items = [
    ["intro", "Introducción"],
    ["gates", "Compuertas básicas"],
    ["guide", "Uso del simulador"],
    ["mz", "Mach–Zehnder"],
    ["ev", "Elitzur–Vaidman"],
  ];
  function open(id) {
    navbar
      .querySelectorAll("button")
      .forEach((b) => b.classList.toggle("on", b.dataset.id === id));
    if (["intro", "gates", "guide"].includes(id)) {
      root.replaceChildren(document.getElementById(id).content.cloneNode(true));
      return;
    }
    experiment(root, id === "ev");
  }
  items.forEach(([id, title]) => {
    const b = document.createElement("button");
    b.textContent = title;
    b.dataset.id = id;
    b.onclick = () => open(id);
    navbar.append(b);
  });
  open("intro");
}
function experiment(root, bomb) {
  const title = bomb
    ? "Medida libre de interacción"
    : "Interferómetro de Mach–Zehnder";
  root.innerHTML =
    "<h2>" +
    title +
    "</h2><p>" +
    (bomb
      ? "Un clic en D1 identifica un objeto activo sin absorber el fotón. D0 deja el diagnóstico abierto."
      : "Ajusta la fase relativa de los dos caminos y observa dónde llegan los fotones.") +
    '</p><div class="experiment"><div><svg class="optical" viewBox="0 0 400 210" role="img" aria-label="Trayectorias ópticas"><path d="M25 140H96 L175 60 H251 L320 130 H372"/><path id="lower" d="M96 140 H240 L251 129 H320 L372 178"/><g><text x="14" y="163">Fuente</text><text x="76" y="128">BS1</text><text x="161" y="49">M1</text><text x="207" y="158">M2</text><text x="300" y="116" id="bs2text">BS2</text><text x="366" y="119">D0</text><text x="366" y="199">D1</text><text x="215" y="49" id="phaseLabel">φ</text><text x="132" y="163" id="object"></text></g><circle id="photon" cx="25" cy="140" r="5"/></svg><p id="event" aria-live="polite"></p></div><div id="controls"></div></div><h3>Resultados del experimento</h3><div class="stats" id="stats"></div><div id="optbars"></div>';
  const get = (id) => root.querySelector("#" + id);
  get("controls").innerHTML =
    (bomb
      ? '<label>Escenario<select id="scenario"><option>Funcional</option><option>Defectuosa</option><option>Prueba oculta</option></select></label><div id="guess" hidden><button data-pick="1">Creo que es funcional</button> <button data-pick="0">Creo que es defectuosa</button></div>'
      : '<label>Desfase <output id="phi"></output><input type="range" id="phase" min="0" max="' +
        2 * Math.PI +
        '" step="any" value="0"></label><label><span><input type="checkbox" id="second" checked> Segundo divisor (BS2)</span></label><label><span><input type="checkbox" id="blocked"> Bloquear brazo B</span></label>') +
    '<label>Fotones por ráfaga<input type="number" id="burst" min="1" max="10000" value="100" required></label><button id="one">Un fotón</button> <button id="many">Emitir ráfaga</button> <button id="reset">Reiniciar</button>';
  let active = true,
    counts = [0, 0, 0],
    p,
    hidden = false,
    revealed = false,
    frame,
    animation;
  function refresh() {
    const phase = bomb ? 0 : +get("phase").value,
      second = bomb || get("second").checked,
      blocked = bomb ? active : get("blocked").checked;
    p = opticalProbabilities(phase, second, blocked);
    if (!bomb) get("phi").textContent = phase.toFixed(3) + " rad";
    get("bs2text").textContent = second ? "BS2" : "Sin BS2";
    get("object").textContent = bomb
      ? hidden && !revealed
        ? "Objeto ?"
        : active
          ? "Activo"
          : "Inactivo"
      : blocked
        ? "Bloqueado"
        : "";
    get("lower").classList.toggle("dim", blocked && (!hidden || revealed));
    const names = ["D0", "D1", bomb ? "Detonación" : "Absorción"],
      total = counts.reduce((a, b) => a + b);
    get("stats").innerHTML =
      "<span>Emitidos<b>" +
      total +
      "</b></span>" +
      names
        .map((k, i) => "<span>" + k + "<b>" + counts[i] + "</b></span>")
        .join("");
    get("optbars").innerHTML =
      "<p>Frecuencia observada · la marca vertical indica la probabilidad teórica.</p>" +
      names
        .map((k, i) => {
          const f = total ? counts[i] / total : 0;
          return (
            '<div class="barrow"><span>' +
            k +
            '</span><div class="track"><div class="fill" style="width:' +
            100 * f +
            '%"></div>' +
            (hidden && !revealed
              ? ""
              : '<i class="expected" style="left:clamp(0px,' +
                100 * p[i] +
                '%,calc(100% - 2px))"></i>') +
            "</div><span>" +
            (f * 100).toFixed(1) +
            " %</span></div>"
          );
        })
        .join("") +
      "<p>Teoría (D0 / D1 / " +
      names[2] +
      ") · " +
      (hidden && !revealed
        ? "oculta durante la prueba"
        : p.map((x) => (x * 100).toFixed(1) + " %").join(" / ")) +
      "</p>";
  }
  function reset() {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(animation);
    counts = [0, 0, 0];
    revealed = false;
    if (bomb) {
      const s = get("scenario").value;
      hidden = s === "Prueba oculta";
      active = hidden ? Math.random() < 0.5 : s === "Funcional";
      get("guess").hidden = !hidden;
    }
    get("event").textContent = "";
    root.querySelector(".amplitude")?.remove();
    get("photon").setAttribute("cx", "25");
    get("photon").setAttribute("cy", "140");
    refresh();
  }
  function emit(n) {
    cancelAnimationFrame(frame);
    refresh();
    let i;
    for (let j = 0; j < n; j++) {
      i = outcome(p);
      counts[i]++;
    }
    refresh();
    get("event").textContent =
      (n === 1 ? "Resultado" : "Último fotón") +
      " · " +
      [
        "D0" + (bomb ? " · inconcluso" : ""),
        "D1" + (bomb ? " · detección libre de interacción" : ""),
        bomb
          ? "Detonación · absorción en el brazo B"
          : "Absorción en el brazo B",
      ][i];
    // Unblocked coherent arms carry both amplitudes until recombination.
    const photon = get("photon"),
      svg = photon.parentNode;
    svg.querySelector(".amplitude")?.remove();
    const other = photon.cloneNode(false);
    other.removeAttribute("id");
    other.classList.add("amplitude");
    svg.append(other);
    const top = [
      [25, 140],
      [96, 140],
      [175, 60],
      [251, 60],
      [320, 130],
      [372, i === 0 ? 130 : 178],
    ];
    const bottom = [
      [25, 140],
      [96, 140],
      [160, 140],
      [240, 140],
      [320, 130],
      [372, i === 0 ? 130 : 178],
    ];
    const duration = 650,
      start = performance.now();
    cancelAnimationFrame(animation);
    const animate = (now) => {
      if (!root.contains(photon)) return;
      const f = Math.min(1, (now - start) / duration),
        steps = i === 2 ? 2 : 5,
        k = Math.min(steps - 1, Math.floor(f * steps)),
        a = f * steps - k;
      const move = (el, points) => {
        for (const [axis, prop] of ["cx", "cy"].entries())
          el.setAttribute(
            prop,
            points[k][axis] * (1 - a) + points[k + 1][axis] * a,
          );
      };
      move(
        photon,
        i === 2 || (!bomb && !get("second").checked && i === 1) ? bottom : top,
      );
      move(other, bottom);
      const coherent =
        i !== 2 &&
        !(bomb ? active : get("blocked").checked) &&
        (bomb || get("second").checked);
      other.style.opacity =
        coherent && (!hidden || revealed) && k >= 1 && k < 4 ? ".6" : "0";
      if (f < 1) animation = requestAnimationFrame(animate);
      else other.remove();
    };
    animation = requestAnimationFrame(animate);
  }
  get("one").onclick = () => emit(1);
  get("many").onclick = () => {
    if (get("burst").reportValidity()) emit(+get("burst").value);
  };
  get("reset").onclick = reset;
  if (bomb) {
    get("scenario").onchange = reset;
    get("guess")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            revealed = true;
            refresh();
            get("event").textContent =
              (Boolean(+b.dataset.pick) === active
                ? "Correcto. "
                : "El diagnóstico no coincide. ") +
              "El objeto era " +
              (active ? "funcional." : "defectuoso.");
            get("guess").hidden = true;
          }),
      );
  } else {
    for (const id of ["phase", "second", "blocked"])
      get(id).oninput = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(reset);
      };
  }
  reset();
}
