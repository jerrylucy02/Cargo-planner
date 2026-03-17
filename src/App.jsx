import React, { useMemo, useState } from "react";

const AIRCRAFTS = {
  "B747-400F": {
    name: "B747-400F",
    q7: 23,
    q6: 7,
    t: 2,
    lowerPmc: 9,
    ld3: 2,
    lowerMaxHeight: 162.6,
    q6MaxHeight: 244,
    q7MaxHeight: 300,
    pmcLength: 317.5,
    pmcWidth: 243.8,
    tLength: 605,
    tWidth: 243.8,
    maxWeight: 4500,
    mode: "FULL",
  },
  "Single Lower Deck PMC (160 cm max)": {
    name: "Single Lower Deck PMC (160 cm max)",
    q7: 0,
    q6: 0,
    t: 0,
    lowerPmc: 1,
    ld3: 0,
    lowerMaxHeight: 160,
    q6MaxHeight: 160,
    q7MaxHeight: 160,
    pmcLength: 317.5,
    pmcWidth: 243.8,
    tLength: 0,
    tWidth: 0,
    maxWeight: 4500,
    mode: "LOWER_SINGLE_ONLY",
  },
};

const sampleRows = [
  { id: 1, qty: 8, length: 147, width: 115, height: 225, weight: 652.5, stackable: false, description: "Set 1 High" },
  { id: 2, qty: 2, length: 250, width: 110, height: 145, weight: 927.5, stackable: false, description: "Set 1 Low" },
  { id: 3, qty: 8, length: 147, width: 115, height: 225, weight: 666.25, stackable: false, description: "Set 2 High" },
  { id: 4, qty: 2, length: 250, width: 110, height: 145, weight: 935, stackable: false, description: "Set 2 Low" },
  { id: 5, qty: 10, length: 253, width: 143, height: 225, weight: 2200, stackable: false, description: "Crates" },
  { id: 6, qty: 1, length: 502, width: 189.5, height: 195.5, weight: 1865, stackable: false, description: "Car 1" },
  { id: 7, qty: 1, length: 502.2, width: 201.5, height: 207, weight: 2235, stackable: false, description: "Car 2" },
  { id: 8, qty: 24, length: 120, width: 80, height: 85, weight: 650, stackable: true, description: "EUR Pallets" },
];

function rotations(l, w) {
  return l === w ? [[l, w]] : [[l, w], [w, l]];
}

function fitLayoutOnPmc(length, width, aircraft) {
  const L = aircraft.pmcLength;
  const W = aircraft.pmcWidth;
  const rots = rotations(length, width);
  let best = { count: 0, boxes: [] };

  function setBest(boxes) {
    if (boxes.length > best.count) best = { count: boxes.length, boxes };
  }

  for (const [l, w] of rots) {
    if (l <= L && w <= W) {
      const cols = Math.floor(L / l);
      const rows = Math.floor(W / w);
      const boxes = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          boxes.push({ x: col * l, y: row * w, l, w });
        }
      }
      setBest(boxes);
    }
  }

  for (const [l1, w1] of rots) {
    for (const [l2, w2] of rots) {
      const maxN1 = Math.floor(W / w1);
      for (let n1 = 0; n1 <= maxN1; n1++) {
        const usedWidth = n1 * w1;
        const remWidth = W - usedWidth;
        if (remWidth < 0) continue;
        const n2 = Math.floor(remWidth / w2);
        const count1 = Math.floor(L / l1);
        const count2 = Math.floor(L / l2);
        const boxes = [];

        for (let stripe = 0; stripe < n1; stripe++) {
          for (let i = 0; i < count1; i++) {
            boxes.push({ x: i * l1, y: stripe * w1, l: l1, w: w1 });
          }
        }
        for (let stripe = 0; stripe < n2; stripe++) {
          for (let i = 0; i < count2; i++) {
            boxes.push({ x: i * l2, y: usedWidth + stripe * w2, l: l2, w: w2 });
          }
        }
        setBest(boxes);
      }
    }
  }

  for (const [l1, w1] of rots) {
    for (const [l2, w2] of rots) {
      const maxN1 = Math.floor(L / l1);
      for (let n1 = 0; n1 <= maxN1; n1++) {
        const usedLength = n1 * l1;
        const remLength = L - usedLength;
        if (remLength < 0) continue;
        const n2 = Math.floor(remLength / l2);
        const count1 = Math.floor(W / w1);
        const count2 = Math.floor(W / w2);
        const boxes = [];

        for (let stripe = 0; stripe < n1; stripe++) {
          for (let i = 0; i < count1; i++) {
            boxes.push({ x: stripe * l1, y: i * w1, l: l1, w: w1 });
          }
        }
        for (let stripe = 0; stripe < n2; stripe++) {
          for (let i = 0; i < count2; i++) {
            boxes.push({ x: usedLength + stripe * l2, y: i * w2, l: l2, w: w2 });
          }
        }
        setBest(boxes);
      }
    }
  }

  return best;
}

function fitCountOnPmc(length, width, aircraft) {
  return fitLayoutOnPmc(length, width, aircraft).count;
}

function classifyRow(row, aircraft) {
  const { qty, length: l, width: w, height: h, stackable } = row;

  if (aircraft.mode === "LOWER_SINGLE_ONLY") {
    const perLayer = fitCountOnPmc(l, w, aircraft);
    const totalRowWeight = qty * row.weight;

    if (perLayer <= 0) {
      return {
        type: "LOWER_SINGLE_ONLY",
        positions: qty,
        perPositionMain: 0,
        perPositionLower: 0,
        lowerPossible: false,
        heightOk: h <= aircraft.lowerMaxHeight,
        weightOk: totalRowWeight <= aircraft.maxWeight,
        notes: "Footprint does not fit on single Lower Deck PMC",
      };
    }

    const layers = stackable && h * 2 <= aircraft.lowerMaxHeight ? 2 : 1;
    const heightOk = h <= aircraft.lowerMaxHeight;
    const weightOk = totalRowWeight <= aircraft.maxWeight;
    const lowerPossible = heightOk && weightOk;
    const perPositionLower = perLayer * layers;

    return {
      type: "LOWER_SINGLE_ONLY",
      positions: Math.ceil(qty / perPositionLower),
      perPositionMain: 0,
      perPositionLower,
      lowerPossible,
      heightOk,
      weightOk,
      notes: !heightOk
        ? `Too high (${h} cm > ${aircraft.lowerMaxHeight} cm)`
        : !weightOk
          ? `Too heavy (${totalRowWeight} kg > ${aircraft.maxWeight} kg)`
          : `${perLayer}/layer, ${layers} layer(s), single lower deck check`,
    };
  }

  if (l > 400 || w > aircraft.pmcWidth) {
    const tNeeded = l <= aircraft.tLength && w <= aircraft.tWidth ? 1 : Math.ceil(l / aircraft.tLength);
    return {
      type: "T",
      positions: qty * tNeeded,
      perPositionMain: 1,
      perPositionLower: 0,
      lowerPossible: false,
      notes: "20-ft / T-position cargo",
    };
  }

  const perLayer = fitCountOnPmc(l, w, aircraft);
  if (perLayer <= 0) {
    return {
      type: "BRIDGE",
      positions: qty * 2,
      perPositionMain: 1,
      perPositionLower: 0,
      lowerPossible: false,
      notes: "Bridge load / footprint issue",
    };
  }

  const mainLayers = stackable && h * 2 <= aircraft.q7MaxHeight ? 2 : 1;
  const lowerPossible = h <= aircraft.lowerMaxHeight;
  const lowerLayers = stackable && h * 2 <= aircraft.lowerMaxHeight ? 2 : 1;

  let type = h <= aircraft.q6MaxHeight ? "Q6" : "Q7";
  if (h > aircraft.q7MaxHeight) type = "OOG";

  return {
    type,
    positions: Math.ceil(qty / (perLayer * mainLayers)),
    perPositionMain: perLayer * mainLayers,
    perPositionLower: perLayer * lowerLayers,
    lowerPossible,
    notes: `${perLayer}/layer, main ${mainLayers} layer(s)`,
  };
}

function allocateRows(rows, aircraft) {
  if (aircraft.mode === "LOWER_SINGLE_ONLY") {
    const totalQty = rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalWeight = rows.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.weight) || 0)), 0);
    const baseRow = rows[0] || { qty: 0, length: 0, width: 0, height: 0, weight: 0, stackable: false, description: "No cargo" };

    const perLayer = fitCountOnPmc(baseRow.length, baseRow.width, aircraft);
    const layers = baseRow.stackable && baseRow.height * 2 <= aircraft.lowerMaxHeight ? 2 : 1;
    const capacity = perLayer * layers;
    const heightOk = baseRow.height <= aircraft.lowerMaxHeight && (!baseRow.stackable || baseRow.height * layers <= aircraft.lowerMaxHeight);
    const weightOk = totalWeight <= aircraft.maxWeight;
    const lowerPossible = perLayer > 0 && heightOk && weightOk;
    const usedLower = lowerPossible && totalQty > 0 ? 1 : 0;
    const unallocated = lowerPossible ? Math.max(0, totalQty - capacity) : totalQty;

    const aggregateDetail = {
      row: {
        id: "single-lower-aggregate",
        qty: totalQty,
        length: baseRow.length,
        width: baseRow.width,
        height: baseRow.height,
        weight: baseRow.weight,
        stackable: baseRow.stackable,
        description: rows.length > 1 ? `Combined cargo (${rows.length} lines)` : baseRow.description,
      },
      type: "LOWER_SINGLE_ONLY",
      positions: totalQty > 0 ? 1 : 0,
      perPositionMain: 0,
      perPositionLower: capacity,
      lowerPossible,
      heightOk,
      weightOk,
      notes: perLayer <= 0
        ? "Footprint does not fit on single Lower Deck PMC"
        : !heightOk
          ? `Too high (${baseRow.height} cm, stack ${layers} layer)`
          : !weightOk
            ? `Too heavy (${totalWeight} kg > ${aircraft.maxWeight} kg)`
            : `${perLayer}/layer, ${layers} layer(s), fill layer 1 before layer 2`,
      allocation: { q7: 0, q6: 0, t: 0, lower: usedLower },
      totalWeight,
      unallocatedQty: unallocated,
      previewQty: totalQty,
      previewPerLayer: perLayer,
      previewLayers: layers,
    };

    return {
      details: [aggregateDetail],
      totalWeight,
      usedQ7: 0,
      usedQ6: 0,
      usedT: 0,
      usedLower,
      freeQ7: 0,
      freeQ6: 0,
      freeT: 0,
      freeLower: aircraft.lowerPmc - usedLower,
      freeLd3: 0,
      fits: lowerPossible && unallocated === 0,
      unallocated,
    };
  }

  const details = rows.map((row) => ({
    row,
    ...classifyRow(row, aircraft),
    allocation: { q7: 0, q6: 0, t: 0, lower: 0 },
    totalWeight: row.qty * row.weight,
    unallocatedQty: 0,
  }));

  let freeQ7 = aircraft.q7;
  let freeQ6 = aircraft.q6;
  let freeT = aircraft.t;
  let freeLower = aircraft.lowerPmc;
  let totalWeight = 0;

  for (const item of details) totalWeight += item.totalWeight;

  for (const item of details.filter((d) => d.type === "T")) {
    const use = Math.min(item.positions, freeT);
    item.allocation.t = use;
    freeT -= use;
  }

  for (const item of details.filter((d) => d.type === "Q7" || d.type === "OOG" || d.type === "BRIDGE")) {
    const use = Math.min(item.positions, freeQ7);
    item.allocation.q7 = use;
    freeQ7 -= use;
  }

  for (const item of details.filter((d) => d.type === "Q6")) {
    let remainingQty = item.row.qty;
    const q6PerPos = item.perPositionMain;
    const lowerPerPos = item.perPositionLower;

    if (freeQ6 > 0) {
      const neededQ6 = Math.ceil(remainingQty / q6PerPos);
      const useQ6 = Math.min(neededQ6, freeQ6);
      item.allocation.q6 = useQ6;
      remainingQty -= useQ6 * q6PerPos;
      freeQ6 -= useQ6;
    }

    if (remainingQty > 0 && item.lowerPossible && freeLower > 0) {
      const neededLower = Math.ceil(remainingQty / lowerPerPos);
      const useLower = Math.min(neededLower, freeLower);
      item.allocation.lower = useLower;
      remainingQty -= useLower * lowerPerPos;
      freeLower -= useLower;
    }

    if (remainingQty > 0 && freeQ7 > 0) {
      const neededQ7 = Math.ceil(remainingQty / q6PerPos);
      const useQ7 = Math.min(neededQ7, freeQ7);
      item.allocation.q7 = useQ7;
      remainingQty -= useQ7 * q6PerPos;
      freeQ7 -= useQ7;
    }

    item.unallocatedQty = Math.max(0, remainingQty);
  }

  const usedQ7 = aircraft.q7 - freeQ7;
  const usedQ6 = aircraft.q6 - freeQ6;
  const usedT = aircraft.t - freeT;
  const usedLower = aircraft.lowerPmc - freeLower;
  const unallocated = details.reduce((sum, d) => sum + (d.unallocatedQty || 0), 0);

  return {
    details,
    totalWeight,
    usedQ7,
    usedQ6,
    usedT,
    usedLower,
    freeQ7,
    freeQ6,
    freeT,
    freeLower,
    freeLd3: aircraft.ld3,
    fits: unallocated === 0 && freeQ7 >= 0 && freeQ6 >= 0 && freeT >= 0 && freeLower >= 0,
    unallocated,
  };
}

function cellStyle(bg) {
  return {
    background: bg,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: 12,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 600,
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function SectionCard({ title, children, right }) {
  return (
    <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function LowerSinglePreview({ row, result, aircraft }) {
  const firstItem = result.details[0];
  const previewRow = firstItem?.row || row;
  const layout = previewRow ? fitLayoutOnPmc(previewRow.length, previewRow.width, aircraft) : { count: 0, boxes: [] };
  const totalQty = firstItem?.previewQty ?? (previewRow?.qty || 0);
  const perLayer = firstItem?.previewPerLayer ?? layout.count;
  const layers = firstItem?.previewLayers ?? 1;
  const layer1Count = Math.min(totalQty, perLayer);
  const layer2Count = Math.max(0, Math.min(totalQty - layer1Count, perLayer));
  const layer1Boxes = layout.boxes.slice(0, layer1Count);
  const layer2Boxes = layout.boxes.slice(0, layer2Count);

  const renderCube = (box, idx, layerIndex) => {
    const offsetX = 22;
    const offsetY = 14;
    const baseLeft = 20 + (box.x / aircraft.pmcLength) * 300;
    const baseTop = 145 - (box.y / aircraft.pmcWidth) * 110;
    const baseWidth = Math.max(26, (box.l / aircraft.pmcLength) * 300);
    const baseHeight = Math.max(18, (box.w / aircraft.pmcWidth) * 110);
    const lift = layerIndex === 2 ? 52 : 0;
    const left = baseLeft + (layerIndex === 2 ? offsetX : 0);
    const top = baseTop - lift - (layerIndex === 2 ? offsetY : 0);

    const ok = firstItem?.lowerPossible;
    const frontColor = ok ? (layerIndex === 1 ? "#c4b5fd" : "#93c5fd") : "#fca5a5";
    const sideColor = ok ? (layerIndex === 1 ? "#a78bfa" : "#60a5fa") : "#f87171";
    const topColor = ok ? (layerIndex === 1 ? "#ddd6fe" : "#bfdbfe") : "#fecaca";
    const borderColor = ok ? (layerIndex === 1 ? "#7c3aed" : "#2563eb") : "#dc2626";

    return (
      <div key={`cube-${layerIndex}-${idx}`} style={{ position: "absolute", left, top, width: baseWidth, height: baseHeight }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: frontColor,
            border: `2px solid ${borderColor}`,
            borderRadius: 8,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#0f172a",
            boxShadow: "0 6px 10px rgba(15,23,42,0.10)",
          }}
        >
          {idx + 1}
        </div>
        <div
          style={{
            position: "absolute",
            left: 8,
            top: -8,
            width: "100%",
            height: 12,
            background: topColor,
            border: `2px solid ${borderColor}`,
            borderBottom: "none",
            transform: "skewX(-45deg)",
            transformOrigin: "left bottom",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -8,
            top: -4,
            width: 12,
            height: "100%",
            background: sideColor,
            border: `2px solid ${borderColor}`,
            borderLeft: "none",
            transform: "skewY(-45deg)",
            transformOrigin: "left top",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  };

  return (
    <SectionCard title="Single Lower Deck PMC Check">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#334155" }}>3D stack preview</div>
          <div style={{ position: "relative", width: 420, maxWidth: "100%", height: layers > 1 ? 330 : 250 }}>
            <div
              style={{
                position: "absolute",
                left: 20,
                bottom: 10,
                width: 340,
                height: 170,
                border: "2px dashed #94a3b8",
                borderRadius: 16,
                background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
                zIndex: 0,
              }}
            />
            <div style={{ position: "absolute", left: 28, bottom: 186, fontSize: 12, color: "#475569", fontWeight: 700 }}>
              PMC {aircraft.pmcLength} × {aircraft.pmcWidth}
            </div>
            {layer1Boxes.map((box, idx) => renderCube(box, idx, 1))}
            {layers > 1 && layer2Boxes.map((box, idx) => renderCube(box, idx, 2))}
          </div>
        </div>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 220px))", gap: 12 }}>
            <div style={cellStyle(result.usedLower > 0 ? "#ddd6fe" : "#ecfdf5")}>Lower Deck PMC 1</div>
          </div>
          <div style={{ marginTop: 18, display: "grid", gap: 8, fontSize: 14, color: "#475569" }}>
            <div>Items on layer 1: {layer1Count}</div>
            <div>Items on layer 2: {layer2Count}</div>
            <div>3D boxes shown: {layer1Count + layer2Count}</div>
            <div>Possible per layer: {perLayer}</div>
            <div>Layers used: {layers}</div>
            <div>Total possible with current stacking: {perLayer * layers}</div>
            <div>Max height: {aircraft.lowerMaxHeight} cm</div>
            <div>Max weight: {aircraft.maxWeight} kg</div>
            {firstItem && !previewRow.stackable && <div>Second layer only activates when Stackable is checked.</div>}
            {firstItem && firstItem.heightOk === false && (
              <div style={{ color: "#b91c1c", fontWeight: 700 }}>Red warning: height exceeds limit.</div>
            )}
            {firstItem && firstItem.weightOk === false && (
              <div style={{ color: "#b91c1c", fontWeight: 700 }}>Red warning: weight exceeds limit.</div>
            )}
            {firstItem && firstItem.lowerPossible && (
              <div style={{ color: "#166534", fontWeight: 700 }}>Fits into the single lower deck PMC.</div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function App() {
  const [aircraftName, setAircraftName] = useState("B747-400F");
  const [rows, setRows] = useState(sampleRows);

  const aircraft = AIRCRAFTS[aircraftName];
  const result = useMemo(() => allocateRows(rows, aircraft), [rows, aircraft]);

  const q6Labels = ["A1", "A2", "B1", "Q6-4", "Q6-5", "Q6-6", "Q6-7"];
  const q7Labels = Array.from({ length: aircraft.q7 }, (_, i) => `Q7-${i + 1}`);
  const tLabels = Array.from({ length: aircraft.t }, (_, i) => `T${i + 1}`);
  const lowerLabels = Array.from({ length: aircraft.lowerPmc }, (_, i) => `L${i + 1}`);
  const ld3Labels = Array.from({ length: aircraft.ld3 }, (_, i) => `LD3-${i + 1}`);

  function updateRow(id, key, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: Date.now(), qty: 1, length: 120, width: 80, height: 80, weight: 100, stackable: false, description: "New Cargo" },
    ]);
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function resetSample() {
    setRows(sampleRows);
  }

  function exportCsv() {
    const header = ["Qty", "L", "W", "H", "KG", "Stackable", "Description"];
    const lines = rows.map((r) => [r.qty, r.length, r.width, r.height, r.weight, r.stackable ? "Yes" : "No", r.description]);
    const csv = [header, ...lines].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cargo-load-planner.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderDeck(labels, used, color, cols) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 10 }}>
        {labels.map((label, i) => (
          <div key={label} style={cellStyle(i < used ? color : "#ecfdf5")}>{label}</div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 20, fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
        <SectionCard
          title="Cargo Load Planner"
          right={
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={aircraftName} onChange={(e) => setAircraftName(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}>
                {Object.keys(AIRCRAFTS).map((name) => <option key={name}>{name}</option>)}
              </select>
              <button onClick={addRow} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: "#2563eb", color: "white", cursor: "pointer" }}>Add Cargo</button>
              <button onClick={resetSample} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>Load Sample</button>
              <button onClick={exportCsv} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>Export CSV</button>
            </div>
          }
        >
          <div style={{ color: "#475569", fontSize: 14 }}>
            {aircraft.mode === "LOWER_SINGLE_ONLY"
              ? "Single Lower Deck PMC check with max height 160 cm."
              : "Web-App für Q7 / Q6 / T / Lower Deck Planung auf der 747-400F."}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 20 }}>
          <SectionCard title="Cargo List">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Qty", "L", "W", "H", "KG", "Stackable", "Description", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 10, fontSize: 13, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      {[
                        ["qty", row.qty],
                        ["length", row.length],
                        ["width", row.width],
                        ["height", row.height],
                        ["weight", row.weight],
                      ].map(([key, value]) => (
                        <td key={key} style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => updateRow(row.id, key, Number(e.target.value))}
                            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                        <input type="checkbox" checked={row.stackable} onChange={(e) => updateRow(row.id, "stackable", e.target.checked)} />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                        <input
                          value={row.description}
                          onChange={(e) => updateRow(row.id, "description", e.target.value)}
                          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                        />
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                        <button onClick={() => removeRow(row.id)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div style={{ display: "grid", gap: 20 }}>
            <SectionCard title="Summary">
              <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Weight</span><strong>{result.totalWeight.toLocaleString()} kg</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Q7 used / free</span><strong>{result.usedQ7} / {result.freeQ7}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Q6 used / free</span><strong>{result.usedQ6} / {result.freeQ6}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>T used / free</span><strong>{result.usedT} / {result.freeT}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Lower PMC used / free</span><strong>{result.usedLower} / {result.freeLower}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>LD3 free</span><strong>{result.freeLd3}</strong></div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ padding: "8px 12px", borderRadius: 999, background: result.fits ? "#16a34a" : "#dc2626", color: "white", fontWeight: 700 }}>
                    {result.fits ? "FITS" : `DOES NOT FIT (${result.unallocated} pcs open)`}
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Calculated Rows">
              <div style={{ display: "grid", gap: 10, maxHeight: 500, overflow: "auto" }}>
                {result.details.map((item) => (
                  <div key={item.row.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: item.unallocatedQty > 0 || item.lowerPossible === false ? "#fff7f7" : "white" }}>
                    <div style={{ fontWeight: 700 }}>{item.row.description}</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                      {item.row.qty} pcs · {item.row.length}×{item.row.width}×{item.row.height} cm · {item.row.weight} kg/pc
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
                      <span style={{ padding: "6px 10px", background: "#eff6ff", borderRadius: 999 }}>{item.type}</span>
                      <span style={{ padding: "6px 10px", background: "#f8fafc", borderRadius: 999 }}>{item.notes}</span>
                      {item.allocation.q6 > 0 && <span style={{ padding: "6px 10px", background: "#fef3c7", borderRadius: 999 }}>Q6 {item.allocation.q6}</span>}
                      {item.allocation.q7 > 0 && <span style={{ padding: "6px 10px", background: "#dbeafe", borderRadius: 999 }}>Q7 {item.allocation.q7}</span>}
                      {item.allocation.t > 0 && <span style={{ padding: "6px 10px", background: "#fecaca", borderRadius: 999 }}>T {item.allocation.t}</span>}
                      {item.allocation.lower > 0 && <span style={{ padding: "6px 10px", background: "#ede9fe", borderRadius: 999 }}>Lower {item.allocation.lower}</span>}
                      {item.unallocatedQty > 0 && <span style={{ padding: "6px 10px", background: "#fee2e2", borderRadius: 999, color: "#991b1b", fontWeight: 700 }}>Open {item.unallocatedQty}</span>}
                      {item.heightOk === false && <span style={{ padding: "6px 10px", background: "#fee2e2", borderRadius: 999, color: "#991b1b", fontWeight: 700 }}>Height warning</span>}
                      {item.weightOk === false && <span style={{ padding: "6px 10px", background: "#fee2e2", borderRadius: 999, color: "#991b1b", fontWeight: 700 }}>Weight warning</span>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        {aircraft.mode === "FULL" && (
          <>
            <SectionCard title="Main Deck Q6 (A1 / A2 / B1 included)">
              {renderDeck(q6Labels, result.usedQ6, "#fde68a", 4)}
            </SectionCard>

            <SectionCard title="Main Deck Q7">
              {renderDeck(q7Labels, result.usedQ7, "#bfdbfe", 6)}
            </SectionCard>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <SectionCard title="T Positions">
                {renderDeck(tLabels, result.usedT, "#fecaca", 2)}
              </SectionCard>
              <SectionCard title="Lower Deck PMC">
                {renderDeck(lowerLabels, result.usedLower, "#ddd6fe", 3)}
              </SectionCard>
            </div>

            <SectionCard title="LD3">
              {renderDeck(ld3Labels, 0, "#e2e8f0", 2)}
            </SectionCard>
          </>
        )}

        {aircraft.mode === "LOWER_SINGLE_ONLY" && (
          <LowerSinglePreview row={rows[0]} result={result} aircraft={aircraft} />
        )}
      </div>
    </div>
  );
}
