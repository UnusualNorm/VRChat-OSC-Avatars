import io from "https://cdn.jsdelivr.net/npm/socket.io-client@4.5.4/dist/socket.io.esm.min.js";
const socket = io("/trackers");

const labels = document.getElementsByTagName("p");
const sliders = document.getElementsByTagName("input");
Array.of(...sliders).forEach((slider, i) => {
  const vectorI = Math.floor(i / 3);
  const groupI = Math.floor(i / 6);

  const label = labels[groupI];
  const type = !!(vectorI % 2) ? "rotation" : "position";

  let tracker = Math.floor(vectorI / 2);
  if (tracker < 2) tracker = "head";
  else tracker = String(tracker);

  slider.addEventListener("change", () => {
    label.innerText = `${label.getAttribute("name")}:`;
    for (let i = 0; i < 6; i++)
      label.innerText += ` ${sliders[groupI * 6 + i].value / 100}`;
    const payload = [];
    for (let i = 0; i < 3; i++)
      payload.push(sliders[vectorI * 3 + i].value / 100);
    console.log(type, tracker, payload);
    socket.emit(type, tracker, payload);
  });
});
