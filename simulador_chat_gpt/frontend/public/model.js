export const groups = [
  ["Básicas", "basic", "H X Y Z I SX"],
  ["Fase", "phase", "S T SDG TDG P"],
  ["Rotación", "rotation", "RX RY RZ"],
  ["Multicúbit", "multi", "CNOT CCNOT SWAP"],
  ["Medición y control", "multi", "M IFX IFZ"],
];
export const angles = ["RX", "RY", "RZ", "P"],
  classical = ["M", "IFX", "IFZ"];
export const arity = (g) => ({ CNOT: 2, CCNOT: 3, SWAP: 2 })[g] || 1;
export const symbol = (g) =>
  ({ SDG: "S†", TDG: "T†", CCNOT: "CCX", IFX: "X|c", IFZ: "Z|c" })[g] || g;
export const kind = (g) =>
  groups.find((a) => a[2].split(" ").includes(g))?.[1] || "multi";
export const wires = (op) =>
  op.gate === "FOR"
    ? [...new Set(op.body.flatMap(wires))].sort((a, b) => a - b)
    : op.q;
export const mapWires = (op, fn) =>
  op.gate === "FOR"
    ? { ...op, body: op.body.map((o) => mapWires(o, fn)) }
    : { ...op, q: op.q.map(fn) };
export const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const label = (op, lib) =>
  op.gate === "SUB"
    ? lib[op.ref]?.name || "Bloque"
    : op.gate === "FOR"
      ? "×" + op.repeat
      : symbol(op.gate);
export const op = (gate, ...q) => ({ gate, q });
export const bell = [op("H", 0), op("CNOT", 0, 1)];
export function preset(which, oracle = "x") {
  let n = 2,
    bits = 2,
    ops = structuredClone(bell);
  if (which === "Teleportación") {
    n = 3;
    ops = [
      op("H", 1),
      op("CNOT", 1, 2),
      op("CNOT", 0, 1),
      op("H", 0),
      { ...op("M", 0), bit: 0 },
      { ...op("M", 1), bit: 1 },
      { ...op("IFX", 2), bit: 1 },
      { ...op("IFZ", 2), bit: 0 },
    ];
  } else if (which === "Deutsch") {
    ops = [op("X", 1), op("H", 0), op("H", 1)];
    if (oracle.includes("x")) ops.push(op("CNOT", 0, 1));
    if (["1", "1−x"].includes(oracle)) ops.push(op("X", 1));
    ops.push(op("H", 0), { ...op("M", 0), bit: 0 });
    bits = 1;
  }
  return {
    n,
    bits,
    initial: "0".repeat(n),
    mode: "Statevector",
    shots: 1024,
    noise: "ninguno",
    ops,
  };
}
export function diagram(
  n,
  ops,
  lib,
  selected = [],
  editable = false,
  initial = "0".repeat(n),
) {
  const length = editable ? Math.max(8, ops.length + 1) : ops.length;
  return Array.from({ length: n }, (_, r) => {
    let row =
      '<div class="wire"><strong>q' +
      r +
      " · |" +
      initial[n - 1 - r] +
      "⟩</strong>";
    for (let i = 0; i < length; i++) {
      const item = ops[i],
        qs = item ? wires(item) : [],
        pos = qs.indexOf(r);
      const min = Math.min(...qs),
        max = Math.max(...qs);
      let token = "";
      if (pos >= 0) {
        let s = label(item, lib);
        if (["CNOT", "CCNOT"].includes(item.gate))
          s = pos === qs.length - 1 ? "⊕" : "●";
        if (item.gate === "SWAP") s = "×";
        if (classical.includes(item.gate)) s += "₍" + item.bit + "₎";
        token =
          '<button class="token ' +
          kind(item.gate) +
          '" ' +
          (editable ? 'draggable="true"' : 'tabindex="-1"') +
          ' title="' +
          esc(label(item, lib)) +
          '">' +
          esc(s) +
          "</button>";
      }
      const link =
        min !== max && r >= min && r <= max
          ? " link " + (r === min ? "top" : r === max ? "bottom" : "")
          : "";
      row +=
        '<div class="cell ' +
        link +
        (selected.includes(i) ? " selected" : "") +
        (pos < 0 ? " empty" : "") +
        '" data-r="' +
        r +
        '" data-i="' +
        i +
        '">' +
        token +
        "</div>";
    }
    return row + "</div>";
  }).join("");
}
