import Midi from "https://cdn.jsdelivr.net/npm/midi-player-js@2.0.16/build/index.browser.min.js";
import io from "https://cdn.jsdelivr.net/npm/socket.io-client@4.5.4/dist/socket.io.esm.min.js";
const socket = io("/midiatar");
let primaryMouseButtonDown = false;

function setPrimaryButtonState(e) {
  const flags = e.buttons !== undefined ? e.buttons : e.which;
  primaryMouseButtonDown = (flags & 1) === 1;
}

document.addEventListener("mousedown", setPrimaryButtonState);
document.addEventListener("mousemove", setPrimaryButtonState);
document.addEventListener("mouseup", setPrimaryButtonState);

const notes = document.getElementsByTagName("li");
Array.from(notes).forEach((note, i) => {
  let currentlyPlaying = false;
  let noteI = i + 41;

  note.onmouseenter = () => {
    if (!primaryMouseButtonDown) return;
    currentlyPlaying = true;
    socket.emit("startNote", noteI);
    note.classList.add("active");
  };

  note.onmousedown = () => {
    if (currentlyPlaying) return;
    currentlyPlaying = true;
    console.log("Note on:", noteI);
    socket.emit("startNote", noteI);
    note.classList.add("active");
  };

  note.onmouseleave = () => {
    if (!currentlyPlaying) return;
    if (!primaryMouseButtonDown) return;
    currentlyPlaying = false;
    console.log("Note off:", noteI);
    socket.emit("stopNote", noteI);
    note.classList.remove("active");
  };

  note.onmouseup = () => {
    if (!currentlyPlaying) return;
    currentlyPlaying = false;
    console.log("Note off:", noteI);
    socket.emit("stopNote", noteI);
    note.classList.remove("active");
  };

  socket.on("startNote", (newNoteI) => {
    if (newNoteI != noteI) return;
    currentlyPlaying = true;
    note.classList.add("active");
  });

  socket.on("stopNote", (newNoteI) => {
    if (newNoteI != noteI) return;
    currentlyPlaying = false;
    note.classList.remove("active");
  });
});

const startButton = document.getElementsByTagName("button")[0];
const pauseButton = document.getElementsByTagName("button")[1];
const uploadInput = document.getElementsByTagName("input")[0];

const player = new Midi.Player((event) => {
  switch (event.name) {
    case "Note on":
      if (event.velocity == 0) {
        console.log("Note off:", event.noteNumber);
        return socket.emit("midiStopNote", event.noteNumber);
      }

      console.log("Note on:", event.noteNumber);
      return socket.emit("midiStartNote", event.noteNumber);
    case "Note off":
      console.log("Note off:", event.noteNumber);
      return socket.emit("midiStopNote", event.noteNumber);
  }
});

player.on("endOfFile", () => socket.emit("midiFinished"));

startButton.onclick = () => player.play();
pauseButton.onclick = () => player.pause();

const enableMidiInput = () => {
  startButton.removeAttribute("disabled");
  pauseButton.removeAttribute("disabled");
  uploadInput.removeAttribute("disabled");
};

const disableMidiInput = () => {
  startButton.setAttribute("disabled", undefined);
  pauseButton.setAttribute("disabled", undefined);
  uploadInput.setAttribute("disabled", undefined);
};

uploadInput.onchange = () => {
  if (!uploadInput.files[0]) return;
  socket.emit("midiFinished");
  disableMidiInput();
  const reader = new FileReader();
  reader.onload = function () {
    const arrayBuffer = this.result;
    player.loadArrayBuffer(arrayBuffer);
    enableMidiInput();
  };
  reader.readAsArrayBuffer(uploadInput.files[0]);
};

navigator.requestMIDIAccess().then((midiAccess) => {
  Array.from(midiAccess.inputs).forEach((input) => {
    input[1].onmidimessage = (msg) => {
      const on = msg.data[0] == 144;
      console.log(`Note ${on ? "on" : "off"}:`, msg.data[1]);
      return socket.emit(`${on ? "start" : "stop"}Note`, msg.data[1]);
    };
  });
});
