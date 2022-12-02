require("dotenv/config");
const { Server: HTTPServer } = require("http");
const express = require("express");
const { Server: IOServer } = require("socket.io");
const { Client: OSCClient } = require("node-osc");

const app = express();
const server = new HTTPServer(app);
const io = new IOServer(server);
const client = new OSCClient("127.0.0.1", 9000);

app.use(express.static("public/"));
io.on("connection", (socket) => {
  console.log(`General: Actor connected!`);
  socket.on("ping", () => {
    console.log("General: Actor ping recieved, ponging...");
    socket.emit("pong");
  });

  // Hot dang batman, this is insecure
  socket.on("update", (path, value) => {
    console.log("General: Actor requested update:", path, value);
  });

  socket.on("disconnect", () => console.log("General: Actor disconnected..."));
});

const actorCursorHook = (socket, namespace) => {
  Array.from(io.of(namespace).sockets)
    .filter((otherSocket) => otherSocket[0] != socket.id)
    .forEach((otherSocket) => socket.emit("newActor", otherSocket[0]));
  socket.broadcast.emit("newActor", socket.id);

  socket.on("mouseMove", (x, y) => {
    //console.log("ActorCursor: Actor mouse moved:", x, y);
    socket.broadcast.emit("actorMouseMove", socket.id, x, y);
  });

  socket.on("disconnect", () =>
    socket.broadcast.emit("removeActor", socket.id)
  );
};

const setParameter = (param, value) =>
  new Promise((resolve, reject) =>
    client.send(
      {
        address: `/avatar/parameters/${param}`,
        args: [value],
      },
      (err) => {
        if (err) reject(err);
        resolve();
      }
    )
  );

// --------------------
// ----- MIDIATAR -----
// --------------------

const findAsync = async (list, predicate) => {
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!(await predicate(item))) continue;
    return item;
  }
};
const reduceAsync = async (list, callback, initialValue) => {
  let accumulator = initialValue;
  for (let i = 0; i < list.length; i++) {
    if (accumulator) accumulator = await callback(accumulator, list[i]);
    else accumulator = list[i];
  }

  return accumulator;
};

const baseNote = 84;
const calculateNoteVal = (note) => Math.pow(2, (note - baseNote) / 12) / 3;
const strayNoteStops = [];
const overwrittenNotes = [];
const noteChannels = 8;

class NoteChannel {
  constructor(channel) {
    this.channel = channel;
  }

  channel = 0;
  playing = false;
  currentNote = 0;
  startTime = 0;

  currentOperation = new Promise((res) => res());

  async play(note) {
    await this.currentOperation;
    const strayNoteStopI = strayNoteStops.indexOf(note);
    if (strayNoteStopI >= 0) return strayNoteStops.splice(strayNoteStopI, 1);
    this.currentOperation = setParameter(this.channel, calculateNoteVal(note));

    await this.currentOperation;
    this.startTime = Date.now();
    this.playing = true;
    this.currentNote = note;
  }

  async stop() {
    await this.currentOperation;
    this.currentOperation = setParameter(this.channel, 0);

    await this.currentOperation;
    this.playing = false;
    this.currentNote = 0;
  }
}

const channels = (function () {
  const arr = [];
  for (let i = 0; i < noteChannels; i++) arr.push(new NoteChannel(i + 1));
  return arr;
})();

class NoteManager {
  constructor(channels) {
    this.channels = channels;
  }

  channels = [];
  playingNotes = [];
  strayNoteStops = [];

  async playNote(note) {
    // Check to see if this has already been stopped
    const strayNoteI = this.strayNoteStops.indexOf(note);
    if (strayNoteI >= 0) return this.strayNoteStops.splice(strayNoteI, 1);

    // Check if there's an available channel
    let channel = await findAsync(this.channels, async (channel) => {
      await channel.currentOperation;
      return !channel.playing;
    });

    if (!channel) {
      console.warn("MidiAtar: Not enough channels, overwriting oldest note...");
      channel = await reduceAsync(
        this.channels,
        async (a, b) => {
          await a.currentOperation;
          await b.currentOperation;
          return a.startTime < b.startTime ? a : b;
        },
        this.channels[0]
      );
      console.log(channel);
      overwrittenNotes.push(channel.currentNote);
    }

    this.playingNotes.push(note);
    io.of("/midiatar").emit("startNote", note);
    await channel.play(note);
  }

  async stopNote(note) {
    if (this.playingNotes.indexOf(note) < 0) {
      console.warn("MidiAtar: Note stop requested, but no note was found...");
      return this.strayNoteStops.push(note);
    }

    let channel = await findAsync(this.channels, async (channel) => {
      await channel.currentOperation;
      return channel.playing && channel.currentNote == note;
    });

    if (!channel) {
      // Check if our note has been overwritten
      const overwrittenNoteI = overwrittenNotes.indexOf(note);
      if (overwrittenNoteI >= 0)
        return overwrittenNotes.splice(overwrittenNoteI, 1);
      // Huh? How did we get here?
      console.error(
        "MidiAtar: Algorithm-breaking bug just occured, this is not good..."
      );
      return;
    }

    io.of("/midiatar").emit("stopNote", note);
    await channel.stop();
  }
}

io.of("/midiatar").on("connection", (socket) => {
  console.log("MidiAtar: Actor connected:", socket.id);
  actorCursorHook(socket, "/midiatar");

  const noteManager = new NoteManager(channels);
  socket.on("startNote", async (noteNumber, cb) => {
    console.log("MidiAtar: Actor started note:", noteNumber);
    noteManager.playNote(noteNumber);
  });

  socket.on("stopNote", async (noteNumber) => {
    console.log("MidiAtar: Actor stopped note:", noteNumber);
    noteManager.stopNote(noteNumber);
  });

  let midiNotes = [];
  socket.on("midiStartNote", (noteNumber) => {
    console.log("MidiAtar: Actor midi started note:", noteNumber);
    midiNotes.push(noteNumber);
    noteManager.playNote(noteNumber);
  });

  socket.on("midiStopNote", (noteNumber) => {
    console.log("MidiAtar: Actor midi stopped note:", noteNumber);
    midiNotes.splice(midiNotes.indexOf(noteNumber), 1);
    noteManager.stopNote(noteNumber);
  });

  socket.on("midiFinished", () => {
    console.log("MidiAtar: Actor midi finished playing!");
    midiNotes.forEach((noteNumber) => noteManager.stopNote(noteNumber));
    midiNotes = [];
  });

  socket.on("disconnect", () => {
    console.log("MidiAtar: Actor disconnected:", socket.id);
    noteManager.playingNotes.forEach((note) => noteManager.stopNote(note));
    // Holy crud, garbage collector, don't fail on me please
  });
});

// --------------------
// ----- OuijAtar -----
// --------------------

let ouijaFocus;
io.of("/ouijatar").on("connect", (socket) => {
  console.log("OuijAtar: Actor connected:", socket.id);

  socket.on("focus", () => {
    console.log("OuijAtar: Actor took focus:", socket.id);
    ouijaFocus = socket.id;
    io.of("/ouijatar").emit("focus", ouijaFocus);
  });
  socket.on("unfocus", () => {
    if (ouijaFocus != socket.id) return;
    console.log("OuijAtar: Actor unfocused:", socket.id);
    ouijaFocus = undefined;
    io.of("/ouijatar").emit("focus", ouijaFocus);
  });

  socket.on("updatePlan", (top, left) => {
    if (ouijaFocus != socket.id) return;
    console.log("OuijAtar: Actor planchette moved:", top, left);
    client.send({
      address: `/avatar/parameters/Top`,
      args: [top],
    });
    client.send({
      address: `/avatar/parameters/Left`,
      args: [left],
    });
    io.of("/ouijatar").emit("updatePlan", top, left);
  });

  socket.on("disconnect", () => {
    console.log("OuijAtar: Actor disconnected:", socket.id);
  });
});

io.of("/trackers").on("connection", (socket) => {
  console.log("Trackers: Actor connected:", socket.id);
  socket.on("position", (tracker, position) =>
    client.send({
      address: `/tracking/trackers/${tracker}/position`,
      args: position,
    })
  );
  socket.on("rotation", (tracker, rotation) =>
    client.send({
      address: `/tracking/trackers/${tracker}/rotation`,
      args: rotation,
    })
  );

  socket.on("disconnect", () => {
    console.log("Trackers: Actor disconnected:", socket.id);
  });
});

server.listen(parseInt(process.env.PORT) || 8080);
