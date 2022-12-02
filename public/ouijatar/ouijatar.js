const socket = io("/ouijatar");
const point1 = [117, 157];
const point2 = [980, 615];
const totalDistances = [point2[0] - point1[0], point2[1] - point1[1]];

// const board = document.getElementsByTagName("img")[1];
const cursor = document.getElementsByTagName("img")[0];

// board.onmousedown = () => socket.emit("focus");
document.onmousedown = () => socket.emit("focus");

// board.onmouseleave = () => socket.emit("unfocus");
// board.onmouseup = () => socket.emit("unfocus");
document.onmouseleave = () => socket.emit("unfocus");
document.onmouseup = () => socket.emit("unfocus");

let ouijaFocus;
socket.on("focus", (id) => {
  ouijaFocus = id;
  if (id == socket.id) document.shouldShareMouse = false;
  else document.shouldShareMouse = true;
});

let lastPlanPos = {
  x: 0,
  y: 0,
};
let lastPlanTime = 0;
window.addEventListener("mousemove", (e) => {
  console.log(e.x, e.y);
  if (ouijaFocus != socket.id) return;
  const dist = distance(lastPlanPos, e);
  if (dist < 4) return;
  if (Date.now() - lastPlanTime < 100) return;
  lastPlanPos = e;
  lastPlanTime = Date.now();

  const xProg = (e.x - point1[0]) / totalDistances[0];
  const yProg = (e.y - point1[1]) / totalDistances[1];

  socket.emit("updatePlan", yProg, xProg);
});

socket.on("updatePlan", (yProg, xProg) => {
  const x = xProg * totalDistances[0] - point1[0];
  const y = yProg * totalDistances[1] + point1[1];

  cursor.style.top = y - 110 + "px";
  cursor.style.left = x + 150 + "px";
});
