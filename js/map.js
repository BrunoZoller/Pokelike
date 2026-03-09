// map.js - Node map generation and rendering

const NODE_TYPES = {
  START: 'start',
  BATTLE: 'battle',
  CATCH: 'catch',
  ITEM: 'item',
  QUESTION: 'question',
  BOSS: 'boss',
  POKECENTER: 'pokecenter',
};

const NODE_WEIGHTS = [
  // L1
  { battle: 50, catch: 30, item: 20, question: 0,  pokecenter: 0  },
  // L2
  { battle: 40, catch: 25, item: 20, question: 15, pokecenter: 0  },
  // L3
  { battle: 35, catch: 15, item: 15, question: 25, pokecenter: 10 },
  // L4
  { battle: 35, catch: 20, item: 15, question: 20, pokecenter: 10 },
  // L5
  { battle: 40, catch: 15, item: 10, question: 25, pokecenter: 10 },
  // L6 — pokecenter guaranteed separately, this is for extra nodes
  { battle: 45, catch: 20, item: 20, question: 15, pokecenter: 0  },
];

function weightedRandom(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, v] of Object.entries(weights)) {
    r -= v;
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

function generateMap(mapIndex) {
  // Start(0) → L1→L2→L3→L4→L5→L6 → Boss(7)
  // L6 always has a pokecenter (n6_0) reachable from all L5 nodes
  // L1–L5 nodes each have exactly 2 children
  const layers = [];

  // Layer 0: Start
  layers.push([{ id: 'n0_0', type: NODE_TYPES.START, layer: 0, col: 0 }]);

  // Layers 1–5: content layers (2–3 nodes each)
  for (let l = 1; l <= 5; l++) {
    const count = Math.random() < 0.5 ? 2 : 3;
    const w = NODE_WEIGHTS[l - 1];
    const layer = [];
    for (let c = 0; c < count; c++) {
      const t = weightedRandom(w);
      layer.push({ id: `n${l}_${c}`, type: t, layer: l, col: c });
    }
    layers.push(layer);
  }

  // Layer 6: pokecenter guaranteed at col 0, plus 1–2 extra random nodes
  {
    const l = 6;
    const w = NODE_WEIGHTS[l - 1];
    const extraCount = 1 + Math.floor(Math.random() * 2); // 1 or 2 extra
    const layer6 = [{ id: 'n6_0', type: NODE_TYPES.POKECENTER, layer: 6, col: 0 }];
    for (let c = 1; c <= extraCount; c++) {
      let t = weightedRandom(w);
      if (t === 'pokecenter') t = 'battle'; // prevent duplicate pokecenter
      layer6.push({ id: `n6_${c}`, type: t, layer: 6, col: c });
    }
    layers.push(layer6);
  }

  // Layer 7: Boss
  layers.push([{ id: 'n7_0', type: NODE_TYPES.BOSS, layer: 7, col: 0 }]);

  const edges = [];

  // L0–L4: each node gets exactly 2 children from next layer
  for (let l = 0; l <= 4; l++) {
    const curr = layers[l];
    const next = layers[l + 1];
    const reachable = new Set();

    for (const from of curr) {
      const shuffled = [...next].sort(() => Math.random() - 0.5);
      // Pick 2 distinct children (or all if next layer has < 2 nodes)
      const count = Math.min(2, next.length);
      for (let i = 0; i < count; i++) {
        edges.push({ from: from.id, to: shuffled[i].id });
        reachable.add(shuffled[i].id);
      }
    }
    // Ensure every next-layer node has at least one incoming edge
    for (const n of next) {
      if (!reachable.has(n.id)) {
        const from = curr[Math.floor(Math.random() * curr.length)];
        edges.push({ from: from.id, to: n.id });
      }
    }
  }

  // L5: each node connects to pokecenter (n6_0) + exactly 1 other L6 node
  {
    const l5 = layers[5];
    const l6 = layers[6];
    const extraL6 = l6.filter(n => n.id !== 'n6_0');
    const reachable = new Set(['n6_0']);

    for (const from of l5) {
      // Always connect to pokecenter
      edges.push({ from: from.id, to: 'n6_0' });
      // Connect to 1 random extra L6 node
      if (extraL6.length > 0) {
        const other = extraL6[Math.floor(Math.random() * extraL6.length)];
        edges.push({ from: from.id, to: other.id });
        reachable.add(other.id);
      }
    }
    // Ensure all L6 nodes have at least one incoming edge
    for (const n of l6) {
      if (!reachable.has(n.id)) {
        const from = l5[Math.floor(Math.random() * l5.length)];
        edges.push({ from: from.id, to: n.id });
      }
    }
  }

  // L6: all nodes connect to boss
  for (const n of layers[6]) {
    edges.push({ from: n.id, to: 'n7_0' });
  }

  // Flatten nodes — ALL start revealed (Slay the Spire style)
  const nodes = {};
  for (const layer of layers) {
    for (const n of layer) {
      n.visited = false;
      n.accessible = false;
      n.revealed = true;
      nodes[n.id] = n;
    }
  }

  // Start node is visited
  nodes['n0_0'].visited = true;

  // Layer-1 nodes connected to start are accessible
  for (const edge of edges) {
    if (edge.from === 'n0_0') {
      nodes[edge.to].accessible = true;
    }
  }


  return { nodes, edges, layers, mapIndex };
}

function getAccessibleNodes(map) {
  return Object.values(map.nodes).filter(n => n.accessible && !n.visited);
}

function advanceFromNode(map, nodeId) {
  const node = map.nodes[nodeId];
  if (!node) return;
  node.visited = true;
  node.accessible = false;

  // Lock sibling nodes in the same layer — the unchosen branches are gone
  for (const n of Object.values(map.nodes)) {
    if (n.layer === node.layer && n.id !== nodeId && n.accessible) {
      n.accessible = false;
    }
  }

  // Make next layer nodes accessible
  for (const edge of map.edges) {
    if (edge.from === nodeId) {
      const target = map.nodes[edge.to];
      if (target) {
        target.revealed = true;
        target.accessible = true;
      }
    }
  }
}

// Rendering — top-to-bottom layout
function renderMap(map, container, onNodeClick) {
  container.innerHTML = '';
  const W = container.clientWidth || 600;
  const H = container.clientHeight || 500;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.width = '100%';
  svg.style.height = '100%';

  const layerCount = map.layers.length; // 9 total (0–7 = start + 6 content + boss)
  const layerGap = H / (layerCount + 1);

  // Positions: layers go DOWN, nodes spread ACROSS
  const positions = {};
  for (let l = 0; l < map.layers.length; l++) {
    const layer = map.layers[l];
    const y = layerGap * (l + 1);
    const nodeGap = W / (layer.length + 1);
    for (let c = 0; c < layer.length; c++) {
      positions[layer[c].id] = { x: nodeGap * (c + 1), y };
    }
  }

  // Draw ALL edges
  for (const edge of map.edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;
    const fromNode = map.nodes[edge.from];
    const toNode = map.nodes[edge.to];
    // "on path" = both endpoints are visited or accessible
    const onPath = (fromNode.visited || fromNode.accessible) && (toNode.visited || toNode.accessible);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    line.setAttribute('stroke', onPath ? '#555' : '#222');
    line.setAttribute('stroke-width', onPath ? '2' : '1');
    if (!onPath) line.setAttribute('stroke-dasharray', '3,5');
    svg.appendChild(line);
  }

  // Draw ALL nodes (all are revealed)
  for (const [id, node] of Object.entries(map.nodes)) {
    const pos = positions[id];
    if (!pos) continue;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);

    const isClickable = node.accessible && !node.visited;
    const isInaccessible = !node.accessible && !node.visited;

    g.style.cursor = isClickable ? 'pointer' : 'default';
    if (isInaccessible) g.style.opacity = '0.55';
    if (node.visited) g.style.opacity = '0.35';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const r = node.type === NODE_TYPES.BOSS ? 22 : 18;
    circle.setAttribute('r', r);
    circle.setAttribute('fill', isInaccessible ? '#1e1e2e' : getNodeColor(node));
    circle.setAttribute('stroke', isClickable ? '#fff' : (isInaccessible ? '#333' : '#555'));
    circle.setAttribute('stroke-width', isClickable ? '3' : '1');

    if (isClickable) {
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      anim.setAttribute('attributeName', 'stroke-opacity');
      anim.setAttribute('values', '1;0.3;1');
      anim.setAttribute('dur', '1.5s');
      anim.setAttribute('repeatCount', 'indefinite');
      circle.appendChild(anim);
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '14');
    text.setAttribute('fill', isInaccessible ? '#444' : '#fff');
    text.textContent = node.visited ? '✓' : getNodeIcon(node);

    g.appendChild(circle);
    g.appendChild(text);

    if (isClickable) {
      g.addEventListener('click', () => onNodeClick(node));
    }

    svg.appendChild(g);
  }

  container.appendChild(svg);
}

function getNodeColor(node) {
  if (node.visited) return '#333';
  const colors = {
    [NODE_TYPES.START]:      '#4a4a6a',
    [NODE_TYPES.BATTLE]:     '#6a2a2a',
    [NODE_TYPES.CATCH]:      '#2a6a2a',
    [NODE_TYPES.ITEM]:       '#2a4a6a',
    [NODE_TYPES.QUESTION]:   '#6a4a2a',
    [NODE_TYPES.BOSS]:       '#8a2a8a',
    [NODE_TYPES.POKECENTER]: '#006666',
  };
  return colors[node.type] || '#444';
}

function getNodeIcon(node) {
  if (node.visited) return '✓';
  const icons = {
    [NODE_TYPES.START]:      '★',
    [NODE_TYPES.BATTLE]:     '⚔',
    [NODE_TYPES.CATCH]:      '⬟',
    [NODE_TYPES.ITEM]:       '✦',
    [NODE_TYPES.QUESTION]:   '?',
    [NODE_TYPES.BOSS]:       '♛',
    [NODE_TYPES.POKECENTER]: '+',
  };
  return icons[node.type] || '●';
}
