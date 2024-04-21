import React, { useEffect, useState, useRef } from "react";
import * as ROT from "rot-js";
import "./App.css";

let generatedMap = {};
let freeCells = [];
let player = null;
let engine = null;
let scheduler = null;
let enemies = [];

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

class Player {
  constructor(x, y, emoji = "🐶", maxLives = 3, name = "Bolt", toHit = 3) {
    this._x = x;
    this._y = y;
    this._emoji = emoji;
    this.lives = maxLives;
    this.maxLives = maxLives;
    this.score = 0;
    this.name = name;
    this.toHit = toHit;
    this._draw();
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  _draw() {
    generatedMap[this._x + "," + this._y] = this._emoji;
  }

  beHit(rollValue) {
    if (rollValue >= this.toHit) {
      this.lives -= 1;
      console.log("Player is hit!");
      if (this.lives === 0) {
        console.log("Game over - you were captured by the goblins!");
      }
    }
  }

  act() {
    engine.lock();
    /* wait for user input; do stuff when user hits a key */
    window.addEventListener("keydown", this);
  }

  handleEvent(e) {
    var attack = false;
    var keyMap = {};
    keyMap[38] = 0;
    keyMap[33] = 1;
    keyMap[39] = 2;
    keyMap[34] = 3;
    keyMap[40] = 4;
    keyMap[35] = 5;
    keyMap[37] = 6;
    keyMap[36] = 7;

    var code = e.keyCode;

    if (!(code in keyMap)) {
      return;
    }

    var diff = ROT.DIRS[8][keyMap[code]];
    var newX = this._x + diff[0];
    var newY = this._y + diff[1];
    const newKey = newX + "," + newY;

    if (generatedMap[newKey] === "🟫") {
      return; // Can't move into a wall
    } else {
      //Check if there is an enemy and attack it
      console.log(enemies);
      enemies.forEach((enemy) => {
        if (enemy.x === newX && enemy.y === newY && enemy.lives > 0) {
          attack = true;
          enemy.beHit(d6());
          this.score += 100;
          window.removeEventListener("keydown", this);
          engine.unlock();
          return;
        }
      });
    }
    if (!attack) {
      generatedMap[this._x + "," + this._y] = "⬛️"; // Clear the current position
      this._x = newX;
      this._y = newY;
      this._draw(); // Draw the player at the new position
      window.removeEventListener("keydown", this);
      engine.unlock();
    }
  }
}

function createPlayer() {
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  player = new Player(x, y, "🐶", 3);
}

function generateBoxes() {
  for (var i = 0; i < 10; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells[index];
    generatedMap[key] = "📦";
  }
}

class Enemy {
  constructor(x, y, emoji = "👺", maxLives = 1, name = "goblin", toHit = 1) {
    this._x = x;
    this._y = y;
    this._emoji = emoji;
    this.lives = maxLives;
    this.maxLives = maxLives;
    this.score = 0;
    this.name = name;
    this.toHit = toHit;
    this._draw();
    this.path = [];
    enemies.push(this);
  }
  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }
  _draw() {
    generatedMap[this._x + "," + this._y] = this._emoji;
  }
  beHit(rollValue) {
    if (rollValue >= this.toHit) {
      console.log("Goblin is hit!");
      this.lives -= 1;
      if (this.lives === 0) {
        generatedMap[this._x + "," + this._y] = "🦴";
        scheduler.remove(this);
        enemies.splice(enemies.indexOf(this), 1);
      }
    }
  }
  act() {
    var x = player.x;
    var y = player.y;
    var passableCallback = function (x, y) {
      return x + "," + y in generatedMap;
    };
    var astar = new ROT.Path.AStar(x, y, passableCallback, { topology: 4 });

    var path = [];
    var pathCallback = function (x, y) {
      path.push([x, y]);
    };
    astar.compute(this._x, this._y, pathCallback);
    this.path = path.slice(0); // Store the computed path for the goblin

    this.path.shift();
    if (this.path.length <= 1) {
      player.beHit(d6());
    } else {
      generatedMap[this._x + "," + this._y] = "⬛️";
      var nextStep = this.path[0];
      this._x = nextStep[0];
      this._y = nextStep[1];
      this._draw();
    }
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
  const goblins = createBeing(Enemy);
  scheduler = new ROT.Scheduler.Simple();
  scheduler.add(player, true);
  goblins.forEach((element) => {
    scheduler.add(element, true);
  });
  engine = new ROT.Engine(scheduler);
  engine.start();
}

function createBeing(what) {
  const beings = [];
  for (var i = 0; i < 10; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells.splice(index, 1)[0];
    var parts = key.split(",");
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);
    beings.push(new what(x, y));
  }
  return beings;
}

//LOGIC ENDS HERE. DRAWING STARTS HERE

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
    const mapWidth = 20;
    const mapHeight = 20;
    const mapGrid = [];

    const startX = Math.max(
      0,
      Math.min(50 - mapWidth, player._x - Math.floor(mapWidth / 2))
    );
    const startY = Math.max(
      0,
      Math.min(50 - mapHeight, player._y - Math.floor(mapHeight / 2))
    );
    const endX = Math.min(50, startX + mapWidth);
    const endY = Math.min(50, startY + mapHeight);

    for (let y = startY; y < endY; y++) {
      const row = [];
      for (let x = startX; x < endX; x++) {
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

  const renderLivesContainer = () => {
    if (player.lives > 99) {
      return (
        <div className="livesContainer">
          <div style={{ verticalAlign: "middle" }}>
            <div
              style={{
                animation:
                  player.lives === 1
                    ? "final-heartbeat 0.60s infinite"
                    : "heartbeat 1s infinite",
                display: "inline-block",
              }}
            >
              <span style={{ verticalAlign: "middle" }}>❤️</span>
            </div>{" "}
            x {player.lives}
          </div>
        </div>
      );
    } else if (player.maxLives > 8) {
      return (
        <div className="livesContainer">
          <div style={{ verticalAlign: "middle" }}>
            <div
              style={{
                animation:
                  player.lives === 1
                    ? "final-heartbeat 0.60s infinite"
                    : "heartbeat 1s infinite",
                display: "inline-block",
              }}
            >
              <span style={{ verticalAlign: "middle" }}>❤️</span>
            </div>{" "}
            x {player.lives}/{player.maxLives}
          </div>
        </div>
      );
    }

    let heartSize = 36; // Default heart size
    if (player.lives > 4) {
      heartSize = 18; // Halve the size of the hearts if there are between 5 and 8
    }

    const hearts = Array.from({ length: player.maxLives }, (_, index) => (
      <span
        key={index}
        style={{
          fontSize: index < player.lives ? "22px" : "18px",
          verticalAlign: "middle",
          animation:
            index === 0 && player.lives === 1
              ? "final-heartbeat 0.60s infinite"
              : index < player.lives
              ? "heartbeat 1s infinite"
              : "none",
          display: "inline-block",
        }}
      >
        {index < player.lives ? "❤️" : "🖤"}
      </span>
    ));

    return (
      <div className="livesContainer">
        <div style={{ display: "inline-block", verticalAlign: "middle" }}>
          {hearts}
        </div>
      </div>
    );
  };

  const renderScoreKeep = () => {
    return <div className="scoreKeep">Score: {player.score}</div>;
  };

  return (
    <div className="App">
      <div className="ui">
        {renderMap()}
        <div className="inventory"></div>
        <div className="bottomUi">
          {renderLivesContainer()}
          {renderScoreKeep()}
          <div className="log"></div>
        </div>
      </div>
    </div>
  );
}

//STARTING GAME
initializeGame();
export default App;
