import React, { useEffect, useState, useRef } from "react";
import * as ROT from "rot-js";
import "./App.css";

let generatedMap = {};
let freeCells = [];
let player = null;
let engine = null;
let scheduler = null;

class Player {
  constructor(x, y) {
    this._x = x;
    this._y = y;
    this._draw();
  }

  _draw() {
    generatedMap[this._x + "," + this._y] = "🐶";
  }

  move(dx, dy) {
    const newX = this._x + dx;
    const newY = this._y + dy;
    const newKey = newX + "," + newY;

    if (generatedMap[newKey] === "🟫") {
      return; // Can't move into a wall
    }

    generatedMap[this._x + "," + this._y] = "⬛️"; // Clear the current position
    this._x = newX;
    this._y = newY;
    this._draw(); // Draw the player at the new position
    console.log(this._x + "," + this._y);
  }

  act() {
    return new Promise((resolve) => {
      const handleKeyDown = (event) => {
        const keyMap = {
          ArrowUp: { dx: 0, dy: -1 },
          ArrowDown: { dx: 0, dy: 1 },
          ArrowLeft: { dx: -1, dy: 0 },
          ArrowRight: { dx: 1, dy: 0 },
        };

        const move = keyMap[event.key];
        if (move) {
          resolve(move);
        }
      };

      document.addEventListener("keydown", handleKeyDown, { once: true });
    });
  }
}

async function gameLoop() {
  while (true) {
    const move = await player.act();
    player.move(move.dx, move.dy);
    engine.unlock();
  }
}

function createPlayer() {
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  player = new Player(x, y);
}

function generateBoxes() {
  for (var i = 0; i < 10; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells[index];
    generatedMap[key] = "📦";
  }
}

function initializeGame() {
  const map = new ROT.Map.Digger(50, 50).create((x, y, value) => {
    const key = x + "," + y;
    generatedMap[key] = value === 1 ? "🟫" : "⬛️";
    if (value === 0) {
      freeCells.push(key);
    }
  });
  createPlayer();
  generateBoxes();
  scheduler = new ROT.Scheduler.Simple();
  scheduler.add(player, true);
  engine = new ROT.Engine(scheduler);
  engine.start();
}

function App() {
  const [dungeon, setDungeon] = useState({}); // Initialize dungeon state

  useEffect(() => {
    setDungeon({ ...generatedMap }); // Update dungeon state with the initial generatedMap

    const updateDungeon = () => {
      setDungeon({ ...generatedMap }); // Update dungeon state with the updated generatedMap
    };

    const interval = setInterval(updateDungeon, 50); // Update dungeon state periodically

    return () => clearInterval(interval); // Clean up the interval on component unmount
  }, []);

  const renderMap = () => {
    const mapWidth = 50;
    const mapHeight = 50;
    const mapGrid = [];

    for (let y = 0; y < mapHeight; y++) {
      const row = [];
      for (let x = 0; x < mapWidth; x++) {
        const key = x + "," + y;
        row.push(
          <div key={key} className="map-cell">
            {dungeon[key]}
          </div>
        );
      }
      mapGrid.push(
        <div key={y} className="map-row">
          {row}
        </div>
      );
    }

    return <div className="map">{mapGrid}</div>;
  };

  return <div className="App">{renderMap()}</div>;
}

initializeGame();
gameLoop();
export default App;
