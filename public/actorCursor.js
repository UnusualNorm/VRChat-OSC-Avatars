import io from "https://cdn.jsdelivr.net/npm/socket.io-client@4.5.4/dist/socket.io.esm.min.js";

const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
class CursorShare {
  constructor() {
    this.socket = io();
    this.socket.on("connect", () =>
      this.socket.emit("setPath", location.pathname)
    );

    this.lastAnimation = Date.now();
    requestAnimationFrame(this.animate);
  }

  socket = {};
  cursors = {};
  positions = {};
  targetPositions = {};
  lastAnimation = 0;

  animate() {
    requestAnimationFrame(animateActors);
    const now = Date.now();
    const delta = now - this.lastAnimation;
    this.lastAnimation = now;

    Object.keys(this.cursors).forEach((id) => {
      const cursor = this.cursors[id];
      const position = this.positions[id];
      const target = this.targetPositions[id];

      const x = lerp(position?.x || 0, target?.x || 0, (delta / 1000) * 8);
      const y = lerp(position?.y || 0, target?.y || 0, (delta / 1000) * 8);

      cursor.style.left = x - 5 + "px";
      cursor.style.top = y + "px";

      this.positions[id] = { x, y };
    });
  }

  createCursor(id) {
    const cursor = document.createElement("img");
    cursor.src = "https://cdn-icons-png.flaticon.com/512/6002/6002300.png";
    cursor.style.position = "absolute";
    cursor.style.width = "20px";
    cursor.style.zIndex = "1000";
    cursor.style.userSelect = "none";
    document.body.prepend(cursor);
    actorCursors[id] = cursor;
    return cursor;
  }
}

socket.on("newActor", (id) => {
  const img = document.createElement("img");
  img.src = "https://cdn-icons-png.flaticon.com/512/6002/6002300.png";
  img.classList.add("cursor");
  document.body.prepend(img);
  actorCursors[id] = img;
});

socket.on(
  "actorMouseMove",
  (id, x, y) => (actorTargetPositions[id] = { x, y })
);

socket.on("removeActor", (id) => {
  actorCursors[id]?.remove();
  delete actorCursors[id];
});

socket.on("disconnect", () => {
  Object.keys(actorCursors).forEach((id) => {
    actorCursors[id]?.remove();
    delete actorCursors[id];
  });
});

let lastMousePos = {
  x: 0,
  y: 0,
};
let lastMouseTime = 0;
document.shouldShareMouse = true;
document.onmousemove = (e) => {
  if (!document.shouldShareMouse) return;
  const dist = distance(lastMousePos, e);
  if (dist < 7.5) return;
  if (Date.now() - lastMouseTime < 100) return;
  lastMousePos = e;
  lastMouseTime = Date.now();
  socket.emit("mouseMove", e.x, e.y);
};

requestAnimationFrame(animateActors);
