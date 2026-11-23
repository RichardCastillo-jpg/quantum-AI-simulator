import {
  groups,
  angles,
  classical,
  arity,
  symbol,
  kind,
  wires,
  mapWires,
  esc,
  label,
  preset,
  diagram,
} from "./model.js";
import { results } from "./results.js";
import { learn } from "./learn.js";
const $ = (id) => document.getElementById(id),
  api = document.querySelector("meta[name=api]").content;
let c = preset("Bell"),
  title = "Par de Bell",
  lib = {},
  history = [],
  selected = [],
  tool = null,
  placement = null,
  paused = false,
  timer,
  controller,
  generation = 0;
const text = (id, v) => ($(id).textContent = v);
const hint = (v) => text("hint", v);
const val = (id) => $(id).value;
const input = (id, name, value, type = "text", attrs = "") =>
  "<label>" +
  name +
  '<input id="' +
  id +
  '" type="' +
  type +
  '" value="' +
  esc(value) +
  '" ' +
  attrs +
  "></label>";
const select = (id, name, values, current) =>
  "<label>" +
  name +
  '<select id="' +
  id +
  '">' +
  values
    .map(
      (v) =>
        "<option " +
        (v === current ? "selected" : "") +
        ">" +
        esc(v) +
        "</option>",
    )
    .join("") +
  "</select></label>";
function modal(name, fields, submit, caption = "Aplicar") {
  text("modalTitle", name);
  $("fields").innerHTML = fields;
  text("error", "");
  text("submit", caption);
  $("submit").hidden = !submit;
  $("form").onsubmit = async (e) => {
    e.preventDefault();
    $("submit").disabled = true;
    try {
      await submit?.();
      $("modal").close();
    } catch (err) {
      text("error", err.message);
    } finally {
      $("submit").disabled = false;
    }
  };
  if (!$("modal").open) $("modal").showModal();
}
$("close").onclick = () => $("modal").close();
async function request(path, method = "GET", body, signal) {
  const res = await fetch(api + path, {
    method,
    signal,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {}
    throw Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((x) => x.msg).join(" · ")
          : "No se pudo completar la petición (" + res.status + ").",
    );
  }
  return res.status === 204 ? null : res.json();
}
function schedule() {
  const gen = ++generation;
  clearTimeout(timer);
  controller?.abort();
  $("results").style.opacity = ".55";
  text("state", paused ? "En pausa" : "Calculando…");
  if (paused) return;
  timer = setTimeout(async () => {
    controller = new AbortController();
    try {
      const r = await request("/simulate", "POST", c, controller.signal);
      if (gen === generation) {
        results($("results"), c, r);
        $("results").style.opacity = "1";
        text("state", "● Actualizado");
      }
    } catch (e) {
      if (gen === generation) {
        text("state", "Error de simulación");
        $("results").textContent = e.message;
      }
    }
  }, 150);
}
function render() {
  text("title", title);
  $("grid").innerHTML = diagram(c.n, c.ops, lib, selected, true, c.initial);
  $("undo").disabled = !history.length;
  for (const id of ["remove", "edit", "loop"])
    $(id).disabled = id === "edit" ? selected.length !== 1 : !selected.length;
  hint(
    tool
      ? "Selecciona los cables para " +
          (lib[tool]?.name || symbol(tool)) +
          " · " +
          (placement?.q.length || 0) +
          " seleccionados."
      : "Selecciona o arrastra una compuerta. Usa Mayús para seleccionar varios pasos.",
  );
  document
    .querySelectorAll("[data-tool]")
    .forEach((el) => el.classList.toggle("on", el.dataset.tool === tool));
}
function commit(fn) {
  history.push(structuredClone({ c, title }));
  if (history.length > 40) history.shift();
  fn();
  selected = [];
  tool = null;
  placement = null;
  render();
  schedule();
}
function choose(g) {
  if (lib[g]?.n > c.n) {
    hint("Este bloque requiere " + lib[g].n + " cúbits.");
    return;
  }
  tool = tool === g ? null : g;
  placement = null;
  selected = [];
  render();
}
function setupPalette() {
  $("palette").innerHTML = groups
    .map(
      ([name, style, list]) =>
        "<div><small>" +
        name +
        '</small><div class="group">' +
        list
          .split(" ")
          .map(
            (g) =>
              '<button draggable="true" class="gate ' +
              style +
              '" data-tool="' +
              g +
              '">' +
              symbol(g) +
              "</button>",
          )
          .join("") +
        "</div></div>",
    )
    .join("");
  $("library").innerHTML = Object.entries(lib)
    .sort((a, b) => a[1].name.localeCompare(b[1].name, "es"))
    .map(
      ([id, b]) =>
        '<div class="librow"><button draggable="true" data-tool="' +
        esc(id) +
        '">' +
        esc(b.name) +
        '</button><button data-inspect="' +
        esc(id) +
        '" aria-label="Inspeccionar ' +
        esc(b.name) +
        '">⋯</button></div>',
    )
    .join("");
  document.querySelectorAll("[data-tool]").forEach((el) => {
    el.onclick = () => choose(el.dataset.tool);
    el.ondragstart = (e) =>
      e.dataTransfer.setData("text/plain", "tool:" + el.dataset.tool);
  });
  document
    .querySelectorAll("[data-inspect]")
    .forEach((el) => (el.onclick = () => inspect(el.dataset.inspect)));
}
async function refresh() {
  lib = await request("/subcircuits");
  setupPalette();
  render();
}
function place(r, i) {
  if (!tool) return;
  if (!placement) placement = { i: Math.min(i, c.ops.length), q: [] };
  if (placement.q.includes(r)) {
    hint("Elige otro cable. Los operandos deben ser distintos.");
    return;
  }
  placement.q.push(r);
  const g = tool,
    needed = lib[g]?.n || arity(g);
  if (placement.q.length < needed) {
    render();
    hint(
      "Selecciona " +
        (placement.q.length === needed - 1
          ? "el último cable"
          : "el siguiente cable") +
        " para " +
        (lib[g]?.name || g) +
        ".",
    );
    return;
  }
  const step = lib[g]
    ? { gate: "SUB", ref: g, q: placement.q }
    : { gate: g, q: placement.q };
  const index = placement.i;
  placement = null;
  tool = null;
  const add = () => commit(() => c.ops.splice(index, 0, step));
  if (angles.includes(g) || classical.includes(g)) {
    render();
    if (classical.includes(g) && !c.bits) {
      hint("Añade al menos un registro clásico en Configuración.");
      return;
    }
    modal(
      "Parámetro de " + g,
      angles.includes(g)
        ? input(
            "param",
            "Ángulo (radianes)",
            Math.PI / 2,
            "number",
            'step="any" required',
          )
        : input(
            "param",
            "Registro clásico",
            0,
            "number",
            'min="0" max="' + (c.bits - 1) + '" required',
          ),
      () => {
        step[angles.includes(g) ? "angle" : "bit"] = Number(val("param"));
        add();
      },
    );
  } else add();
}
$("grid").onclick = (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const i = Number(cell.dataset.i);
  if (tool) return place(+cell.dataset.r, i);
  if (i >= c.ops.length) {
    selected = [];
    render();
    return;
  }
  selected = e.shiftKey
    ? [...new Set([...selected, i])].sort((a, b) => a - b)
    : [i];
  render();
};
$("grid").ondragstart = (e) => {
  const cell = e.target.closest(".cell");
  if (cell) e.dataTransfer.setData("text/plain", "move:" + cell.dataset.i);
};
$("grid").ondragover = (e) => e.preventDefault();
$("grid").ondrop = (e) => {
  e.preventDefault();
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const [action, id] = e.dataTransfer.getData("text/plain").split(":");
  const i = Math.min(+cell.dataset.i, c.ops.length),
    r = +cell.dataset.r;
  if (action === "tool") {
    if (lib[id]?.n > c.n) return hint("El bloque requiere más cúbits.");
    tool = id;
    placement = null;
    place(r, i);
  }
  if (action === "move") {
    const old = Number(id);
    if (!c.ops[old]) return;
    commit(() => {
      const [step] = c.ops.splice(old, 1);
      if (step.q?.length === 1) step.q = [r];
      c.ops.splice(i > old ? i - 1 : i, 0, step);
    });
  }
};
$("undo").onclick = () => {
  const prev = history.pop();
  if (prev) {
    c = prev.c;
    title = prev.title;
    selected = [];
    tool = placement = null;
    render();
    schedule();
  }
};
$("remove").onclick = () =>
  commit(() => {
    c.ops = c.ops.filter((_, i) => !selected.includes(i));
  });
$("clear").onclick = () =>
  commit(() => {
    c.ops = [];
    title = "Circuito vacío";
  });
$("pause").onclick = () => {
  paused = !paused;
  text("pause", paused ? "▷ Reanudar" : "Ⅱ Pausar");
  schedule();
};
$("config").onclick = () =>
  modal(
    "Configuración",
    input("n", "Cúbits", c.n, "number", 'min="1" max="8" required') +
      input(
        "bits",
        "Registros clásicos",
        c.bits,
        "number",
        'min="0" max="8" required',
      ) +
      input(
        "initial",
        "Estado inicial (qₙ₋₁ … q₀)",
        c.initial,
        "text",
        'pattern="[01]+" required',
      ) +
      select("mode", "Modo", ["Statevector", "Shot"], c.mode) +
      input(
        "shots",
        "Número de shots",
        c.shots,
        "number",
        'min="1" max="16384" required',
      ) +
      select(
        "noise",
        "Modelo de ruido",
        ["ninguno", "depolarizing", "thermal relaxation"],
        c.noise,
      ),
    async () => {
      const next = {
        ...c,
        n: +val("n"),
        bits: +val("bits"),
        initial: val("initial"),
        mode: val("mode"),
        shots: +val("shots"),
        noise: val("noise"),
      };
      if (next.initial.length !== next.n)
        throw Error("Ingresa un bit inicial por cúbit.");
      await request("/validate", "POST", next);
      commit(() => (c = next));
    },
  );
$("examples").onclick = () =>
  modal(
    "Cargar algoritmo",
    select(
      "example",
      "Circuito",
      ["Par de Bell", "Teleportación", "Deutsch"],
      "Par de Bell",
    ) +
      select(
        "oracle",
        "Oráculo de Deutsch · f(x)",
        ["0", "1", "x", "1−x"],
        "x",
      ) +
      "<p>El circuito seleccionado reemplaza el lienzo. Puedes recuperar el anterior con Deshacer.</p>",
    () => {
      const name = val("example"),
        oracle = val("oracle");
      commit(() => {
        c = preset(name, oracle);
        title = name === "Deutsch" ? name + " · f(x) = " + oracle : name;
      });
    },
    "Cargar circuito",
  );
$("loop").onclick = () => {
  const first = selected[0],
    last = selected.at(-1);
  modal(
    "Crear ciclo",
    "<p>Repetir los pasos " +
      (first + 1) +
      " a " +
      (last + 1) +
      " (incluidos).</p>" +
      input("rep", "Repeticiones", 2, "number", 'min="1" max="128" required'),
    () =>
      commit(() => {
        const body = c.ops.slice(first, last + 1);
        c.ops.splice(first, body.length, {
          gate: "FOR",
          repeat: +val("rep"),
          body,
        });
      }),
  );
};
function editor(ops, n, after) {
  // Each row represents one serialized layer. Nested structures can be opened recursively.
  const list = $("steps");
  const paint = () => {
    list.innerHTML = ops
      .map(
        (o, i) =>
          '<div class="librow"><span style="flex:1">' +
          (i + 1) +
          ". " +
          esc(label(o, lib)) +
          " · " +
          wires(o)
            .map((q) => "q" + q)
            .join(", ") +
          "</span>" +
          ["↑", "↓", "✎", "×"]
            .map(
              (s, j) =>
                '<button type="button" data-idx="' +
                i +
                '" data-action="' +
                j +
                '">' +
                s +
                "</button>",
            )
            .join("") +
          "</div>",
      )
      .join("");
    list.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          const i = +b.dataset.idx,
            a = +b.dataset.action;
          if (a === 0 && i > 0) [ops[i - 1], ops[i]] = [ops[i], ops[i - 1]];
          if (a === 1 && i + 1 < ops.length)
            [ops[i + 1], ops[i]] = [ops[i], ops[i + 1]];
          if (a === 2) {
            editOp(
              ops[i],
              n,
              (o) => {
                ops[i] = o;
                after();
              },
              after,
            );
            return;
          }
          if (a === 3) ops.splice(i, 1);
          paint();
        }),
    );
  };
  paint();
  $("addStep").onclick = () =>
    editOp(
      { gate: "H", q: [0] },
      n,
      (o) => {
        ops.push(o);
        after();
      },
      after,
    );
}
function editOp(original, n, done, back) {
  const o = structuredClone(original);
  if (o.gate === "FOR") {
    const show = () => {
      modal(
        "Editar ciclo",
        input(
          "rep",
          "Repeticiones",
          o.repeat,
          "number",
          'min="1" max="128" required',
        ) +
          '<div id="steps"></div><button type="button" id="addStep">＋ Añadir paso</button>',
        null,
      );
      $("fields").insertAdjacentHTML(
        "beforeend",
        ' <button type="button" id="accept">Aceptar ciclo</button>',
      );
      $("rep").oninput = () => (o.repeat = +val("rep"));
      $("accept").onclick = () => {
        if (
          !o.body.length ||
          !Number.isInteger(o.repeat) ||
          o.repeat < 1 ||
          o.repeat > 128
        ) {
          text("error", "Revisa el cuerpo y las repeticiones.");
          return;
        }
        done(o);
      };
      editor(o.body, n, show);
    };
    show();
    return;
  }
  const choices = groups
    .flatMap((a) => a[2].split(" "))
    .concat(Object.keys(lib));
  modal(
    "Editar operación",
    '<label>Operación<select id="g">' +
      choices
        .map(
          (k) =>
            '<option value="' +
            esc(k) +
            '" ' +
            (k === (o.ref || o.gate) ? "selected" : "") +
            ">" +
            esc(lib[k]?.name || symbol(k)) +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      input(
        "qs",
        "Cables en orden (control antes de objetivo)",
        o.q.join(","),
      ) +
      '<div id="arg"></div><button type="button" id="accept">Aceptar operación</button>' +
      (back ? ' <button type="button" id="back">Volver</button>' : ""),
    null,
  );
  const args = () => {
    const g = val("g");
    $("arg").innerHTML = angles.includes(g)
      ? input(
          "angle",
          "Ángulo (radianes)",
          o.angle ?? Math.PI / 2,
          "number",
          'step="any" required',
        )
      : classical.includes(g)
        ? input(
            "bit",
            "Registro clásico",
            o.bit ?? 0,
            "number",
            'min="0" max="7" required',
          )
        : "";
  };
  args();
  $("g").onchange = args;
  if (back) $("back").onclick = back;
  $("accept").onclick = () => {
    const g = val("g"),
      qs = val("qs")
        .split(",")
        .map((s) => (/^\s*\d+\s*$/.test(s) ? Number(s) : NaN));
    if (
      !$("form").reportValidity() ||
      qs.length !== (lib[g]?.n || arity(g)) ||
      new Set(qs).size !== qs.length ||
      qs.some((i) => !Number.isInteger(i) || i < 0 || i >= n)
    ) {
      text("error", "Revisa la cantidad y los índices de los cables.");
      return;
    }
    const step = lib[g] ? { gate: "SUB", ref: g, q: qs } : { gate: g, q: qs };
    if (angles.includes(g)) step.angle = +val("angle");
    if (classical.includes(g)) step.bit = +val("bit");
    done(step);
  };
}
$("edit").onclick = () => {
  const i = selected[0];
  editOp(c.ops[i], c.n, (o) => {
    commit(() => (c.ops[i] = o));
    $("modal").close();
  });
};
function blockEditor(id, draft) {
  const show = () => {
    modal(
      id ? "Editar subcircuito" : "Guardar subcircuito",
      input("name", "Nombre", draft.name, "text", 'maxlength="64" required') +
        '<label>Descripción<textarea id="desc" maxlength="500">' +
        esc(draft.description) +
        "</textarea></label>" +
        input(
          "bn",
          "Cúbits requeridos",
          draft.n,
          "number",
          'min="1" max="8" required',
        ) +
        '<div id="steps"></div><button type="button" id="addStep">＋ Añadir paso</button>',
      async () => {
        const candidate = { ...lib, [id]: draft };
        if (id && incompatible(c.ops, candidate))
          throw Error(
            "El número de cúbits debe coincidir con las instancias del lienzo.",
          );
        await request(
          "/subcircuits" + (id ? "/" + id : ""),
          id ? "PUT" : "POST",
          draft,
        );
        await refresh();
        schedule();
      },
      "Guardar",
    );
    $("name").oninput = () => (draft.name = val("name"));
    $("desc").oninput = () => (draft.description = val("desc"));
    $("bn").oninput = () => (draft.n = +val("bn"));
    editor(draft.ops, draft.n, show);
  };
  show();
}
function incompatible(ops, library) {
  return ops.some((o) =>
    o.gate === "SUB"
      ? o.q.length !== library[o.ref]?.n
      : o.gate === "FOR" && incompatible(o.body, library),
  );
}
$("save").onclick = () => {
  const ops = selected.length ? selected.map((i) => c.ops[i]) : c.ops;
  if (!ops.length) {
    hint("Añade una compuerta antes de guardar.");
    return;
  }
  const used = [...new Set(ops.flatMap(wires))].sort((a, b) => a - b);
  blockEditor(null, {
    name: "",
    description: "",
    n: used.length,
    ops: ops.map((o) => mapWires(o, (q) => used.indexOf(q))),
  });
};
function inspect(id) {
  const b = lib[id];
  modal(
    b.name,
    "<p>" +
      esc(b.description) +
      '</p><div class="diagram">' +
      diagram(b.n, b.ops, lib) +
      "</div><ol>" +
      b.ops
        .map(
          (o) =>
            "<li>" +
            esc(label(o, lib)) +
            " · " +
            wires(o)
              .map((q) => "q" + q)
              .join(" → ") +
            "</li>",
        )
        .join("") +
      '</ol><button type="button" id="modify">Editar definición</button> <button type="button" id="deleteBlock">Eliminar definición</button>',
    null,
  );
  $("modify").onclick = () => blockEditor(id, structuredClone(b));
  $("deleteBlock").onclick = async () => {
    const uses = (ops) =>
      ops.some((o) => o.ref === id || (o.body && uses(o.body)));
    if (uses(c.ops)) {
      text("error", "Retira primero las instancias de este bloque del lienzo.");
      return;
    }
    try {
      await request("/subcircuits/" + id, "DELETE");
      history = history.filter((h) => !uses(h.c.ops));
      await refresh();
      schedule();
      $("modal").close();
    } catch (e) {
      text("error", e.message);
    }
  };
}
function route() {
  const page = ["inicio", "aprender", "docs"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "simulador";
  document
    .querySelectorAll("main>section")
    .forEach((el) => (el.hidden = el.id !== page));
  document
    .querySelectorAll("nav a")
    .forEach((a) => a.classList.toggle("on", a.hash === "#" + page));
}
onhashchange = route;
route();
learn();
setupPalette();
render();
refresh().catch((e) => hint(e.message));
schedule();
