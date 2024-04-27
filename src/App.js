import React, { useEffect, useState } from "react";
import * as ROT from "rot-js";
import "./App.css";

let player = null;
let engine = null;
let scheduler = null;
let MAX_LOG_SIZE = 12;
let MAX_INVENTORY_SIZE = 4;
const generatedMap = {};
const freeCells = [];
const enemies = [];
const eatFruit = {};
const logContents = [];
const fruit = [
  "🍏", // Green apple
  "🍎", // Red apple
  "🍐", // Pear
  "🍊", // Tangerine
  "🍋", // Lemon
  "🍌", // Banana
  "🍉", // Watermelon
  "🍇", // Grapes
  "🍓", // Strawberry
  "🍈", // Melon
  "🍒", // Cherries
  "🍑", // Peach
  "🥭", // Mango
  "🍍", // Pineapple
  "🥥", // Coconut
  "🥑", // Avocado
];
const fruitNames = {
  "🍏": "green apple",
  "🍎": "red apple",
  "🍐": "pear",
  "🍊": "tangerine",
  "🍋": "lemon",
  "🍌": "banana",
  "🍉": "watermelon",
  "🍇": "grapes",
  "🍓": "strawberry",
  "🍈": "melon",
  "🍒": "cherries",
  "🍑": "peach",
  "🥭": "mango",
  "🍍": "pineapple",
  "🥥": "coconut",
  "🥑": "avocado",
};
const effects = [
  healing,
  extraHealing,
  poison,
  haste,
  might,
  confusion,
  flying,
  mutation,
  slowing,
  invunlerability,
  weakness,
  beasthood,
  cancellation,
  sleeping,
  fire,
  luck,
];
const weapons = [
  "🗡️", // Dagger
  "⚔️", // Double Sword
  "🔫", // Gun
  "🏹", // Bow and Arrow
  "🪓", // Axe
  "🔨", // Hammer
  "⛏️", // Pick
  "🎸", // Guitar
  "🔪", // Kitchen Knife
  "🛡️", // Shield
  "🧤", // Gloves
];

function log(message, color) {
  const newMessage = (
    <span className="logText" style={{ color }}>
      {message}
    </span>
  );
  logContents.push(newMessage);

  if (logContents.length > MAX_LOG_SIZE) {
    logContents.shift(); // Remove the first element of logContents
  }
}

// Function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Function to initialize eatFruit dictionary
function randomizeFruit() {
  // Shuffle fruits and effects arrays
  shuffleArray(fruit);
  shuffleArray(effects);

  // Initialize eatFruit dictionary
  for (let i = 0; i < fruit.length; i++) {
    eatFruit[fruit[i]] = effects[i];
  }
}

function healing(eater) {
  eater.lives += 2;
  if (eater.lives > eater.maxLives) {
    eater.lives = eater.maxLives;
  }
  log(eater.name + " feels better!", "#7FFF00");
}
function extraHealing(eater) {
  log(eater.name + " experiences the effect of Extra healing", "blue");
}
function poison(eater) {
  log(eater.name + " experiences the effect of Poison", "blue");
}
function haste(eater) {
  log(eater.name + " experiences the effect of Haste", "blue");
}
function might(eater) {
  log(eater.name + " experiences the effect of Might", "blue");
}
function confusion(eater) {
  log(eater.name + " experiences the effect of Confusion", "blue");
}
function flying(eater) {
  log(eater.name + " experiences the effect of Flying", "blue");
}
function mutation(eater) {
  log(eater.name + " experiences the effect of Mutation", "blue");
}
function slowing(eater) {
  log(eater.name + " experiences the effect of Slowing", "blue");
}
function invunlerability(eater) {
  log(eater.name + " experiences the effect of Invulnerability", "blue");
}
function weakness(eater) {
  log(eater.name + " experiences the effect of Weakness", "blue");
}
function beasthood(eater) {
  log(eater.name + " experiences the effect of Beasthood", "blue");
}
function cancellation(eater) {
  log(eater.name + " experiences the effect of Cancellation", "blue");
}
function sleeping(eater) {
  log(eater.name + " experiences the effect of Sleeping", "blue");
}
function fire(eater) {
  log(eater.name + " experiences the effect of Fire", "blue");
}
function luck(eater) {
  log(eater.name + " experiences the effect of Luck", "blue");
}

function eat(eater, fruit) {
  if (eatFruit[fruit]) {
    eatFruit[fruit](eater);
  }
}

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

class Player {
  constructor(
    x,
    y,
    emoji = "🐶",
    maxLives = 3,
    name = "Bolt",
    toHit = 3,
    inventory = [],
    passives = []
  ) {
    this._x = x;
    this._y = y;
    this._emoji = emoji;
    this.lives = maxLives;
    this.maxLives = maxLives;
    this.score = 0;
    this.name = name;
    this.toHit = toHit;
    this.ground = "⬛️";
    this.wield = "";
    this.wear = "";
    this.inventory = inventory;
    this.passives = passives;
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

  beHit(enemy) {
    const rollValue = d6();
    if (rollValue >= this.toHit) {
      this.lives -= 1;
      log("The " + enemy.name + " hits " + this.name + "!", "red");
      if (this.lives == 1) {
        log(this.name + " is on their last breath!", "#8B0000");
      }
      if (this.lives <= 0) {
        engine.lock();
        log("Game over!", "#FF1493");
      }
      document.querySelector(".App").classList.add("shake");
      setTimeout(() => {
        document.querySelector(".App").classList.remove("shake");
      }, 200);
    } else {
      log("The " + enemy.name + " misses " + this.name + "!", "#FFA500");
    }
  }

  useGround() {
    if (
      fruit.includes(this.ground) &&
      this.inventory.length < MAX_INVENTORY_SIZE
    ) {
      this.inventory.push(this.ground);
      const fruitName = fruitNames[this.ground];
      if (this.ground === "🍇" || this.ground === "🍒") {
        log(this.name + " picks up " + fruitName + "!", "#FFE4E1");
      } else {
        const indefiniteArticle = ["a", "e", "i", "o", "u"].includes(
          fruitName[0].toLowerCase()
        )
          ? "an"
          : "a";
        log(
          this.name + " picks up " + indefiniteArticle + " " + fruitName + "!",
          "#FFE4E1"
        );
      }
      this.ground = "⬛️";
      return true;
    } else if (this.inventory.length >= MAX_INVENTORY_SIZE) {
      log(this.name + " has too many items!", "#F08080");
      return false;
    }
    if (this.ground === "📦") {
      if (this.wear === "") {
        this.ground = "⬛️";
      } else {
        this.ground = this.wear;
        this.unequip("📦");
      }
      this.wear = "📦";
      return true;
    } else if (weapons.includes(this.ground)) {
      var weapon = this.ground;
      if (this.wield === "") {
        this.ground = "⬛️";
      } else {
        this.ground = this.wield;
        this.unwield();
      }
      this.wieldWeapon(weapon);
      return true;
    }
    return false;
  }

  wieldWeapon(item) {
    // Logic to equip the item
    // Example: When equipping a dagger, add the "PlusOne" passive ability
    console.log("Wielding " + item);
    if (item === "🗡️") {
      log("Dagger equipped", "white");
      this.wield = "🗡️";
      this.passives.push("PlusOne");
      log("You are now attacking at a +1", "cyan");
    }
    if (item === "⚔️") {
      log("Double Sword equipped", "white");
      this.wield = "⚔️";
      this.passives.push("TwoWeapon");
      log("You are innacurate but mighty", "cyan");
    }
  }

  unwield() {
    // Logic to unequip the item
    // Example: When unequipping a dagger, remove the "PlusOne" passive ability
    if (this.wield === "🗡️") {
      const index = this.passives.indexOf("PlusOne");
      if (index !== -1) {
        this.passives.splice(index, 1);
      }
    }
    if (this.wield === "⚔️") {
      const index = this.passives.indexOf("TwoWeapon");
      if (index !== -1) {
        this.passives.splice(index, 1);
      }
    }
  }

  act() {
    engine.lock();
    /* wait for user input; do stuff when user hits a key */
    window.addEventListener("keydown", this);
  }

  handleEvent(e) {
    e.preventDefault();
    var attack = false;
    var keyMap = {};
    //Direction keys
    keyMap[38] = 0;
    keyMap[33] = 1;
    keyMap[39] = 2;
    keyMap[34] = 3;
    keyMap[40] = 4;
    keyMap[35] = 5;
    keyMap[37] = 6;
    keyMap[36] = 7;
    keyMap[75] = 0;
    keyMap[85] = 1;
    keyMap[76] = 2;
    keyMap[78] = 3;
    keyMap[74] = 4;
    keyMap[66] = 5;
    keyMap[72] = 6;
    keyMap[89] = 7;
    //Action keys
    keyMap[188] = 8;
    keyMap[81] = 8;
    keyMap[65] = 8;
    keyMap[83] = 8;
    keyMap[68] = 8;
    keyMap[70] = 8;

    var code = e.keyCode;

    if (!(code in keyMap)) {
      return;
    }

    if (code === 81) {
      if (player.useGround()) {
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
      return;
    }
    if (code === 188) {
      // If the comma key is pressed, pass the turn
      window.removeEventListener("keydown", this);
      engine.unlock();
      return;
    }
    if (code === 65) {
      if (player.inventory.length > 0) {
        eat(player, player.inventory[0]);
        player.inventory.splice(0, 1);
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
      return;
    }
    if (code === 83) {
      if (player.inventory.length > 1) {
        eat(player, player.inventory[1]);
        player.inventory.splice(1, 1);
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
      return;
    }
    if (code === 68) {
      if (player.inventory.length > 2) {
        eat(player, player.inventory[2]);
        player.inventory.splice(2, 1);
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
      return;
    }
    if (code === 70) {
      if (player.inventory.length > 3) {
        eat(player, player.inventory[3]);
        player.inventory.splice(3, 1);
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
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
      enemies.forEach((enemy) => {
        if (enemy.x === newX && enemy.y === newY && enemy.lives > 0) {
          attack = true;
          player.attack(enemy);
          window.removeEventListener("keydown", this);
          engine.unlock();
          return;
        }
      });
    }
    if (!attack) {
      generatedMap[this._x + "," + this._y] = this.ground; // Clear the current position
      this.ground = generatedMap[newX + "," + newY];
      this._x = newX;
      this._y = newY;
      this._draw(); // Draw the player at the new position
      window.removeEventListener("keydown", this);
      engine.unlock();
    }
  }

  attack(enemy) {
    enemy.beHit(player);
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
  for (var i = 0; i < 50; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells[index];
    var randomValue = Math.random();
    if (randomValue < 0.5) {
      var randomFruitIndex = Math.floor(Math.random() * fruit.length);
      generatedMap[key] = fruit[randomFruitIndex];
    } else if (randomValue < 0.75) {
      generatedMap[key] = "🗡️"; // Dagger
    } else {
      generatedMap[key] = "⚔️"; // Double Sword
    }
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
    this.ground = "⬛️";
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
  beHit(attacker) {
    let rollValue = d6();
    if (attacker.passives.includes("PlusOne")) {
      rollValue += 1;
    }
    if (attacker.passives.includes("TwoWeapon")) {
      rollValue = Math.min(d6(), d6());
    }
    if (rollValue >= this.toHit) {
      if (
        attacker.passives.includes("Mighty") ||
        attacker.passives.includes("TwoWeapon")
      ) {
        this.lives -= 2;
      } else {
        this.lives -= 1;
      }
      if (this.lives <= 0) {
        log(attacker.name + " slays the " + this.name + "!", "#FFD700");
        scheduler.remove(this);
        enemies.splice(enemies.indexOf(this), 1);
        if (this.ground === "⬛️") {
          generatedMap[this._x + "," + this._y] = "🦴";
        } else {
          generatedMap[this._x + "," + this._y] = this.ground;
        }
      } else {
        log(attacker.name + " hits the " + this.name + "!", "#E5DE00");
      }
    } else {
      log(attacker.name + " misses the " + this.name + "!", "#F0E68C");
    }
  }
  act() {
    var x = player.x;
    var y = player.y;
    var passableCallback = (x, y) => {
      const key = x + "," + y;
      return (
        generatedMap[key] !== "🟫" &&
        generatedMap[key] !== "📦" &&
        !enemies.some(
          (enemy) => enemy._x === x && enemy._y === y && enemy !== this
        )
      );
    };
    var astar = new ROT.Path.AStar(x, y, passableCallback, { topology: 8 });
    var path = [];
    var pathCallback = function (x, y) {
      path.push([x, y]);
    };
    astar.compute(this._x, this._y, pathCallback);
    if (path.length) {
      this.path = path.slice(0); // Store the computed path for the goblin
      this.path.shift();
      if (this.path.length === 1) {
        player.beHit(this);
      } else {
        generatedMap[this._x + "," + this._y] = this.ground;
        var nextStep = this.path[0];
        this.ground = generatedMap[nextStep[0] + "," + nextStep[1]];
        this._x = nextStep[0];
        this._y = nextStep[1];
        this._draw();
      }
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
  randomizeFruit();
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
  const [logMessages, setLogMessages] = useState([]);

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
          <div key={key} className="map-square">
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
    if (player.maxLives > 8) {
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
            {player.lives}/{player.maxLives}
          </div>
        </div>
      );
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

  function renderScoreKeep() {
    return <div className="scoreKeep">Score: {player.score}</div>;
  }

  function renderLuckContainer() {
    return (
      <div className="luckContainer">
        <div>Luck:</div>
      </div>
    );
  }

  function renderGroundView() {
    return (
      <div className="groundView">
        <div>{player.ground}</div>
      </div>
    );
  }

  function renderEquipView() {
    return (
      <div className="equipView">
        <div>{player.wield}</div>
        <div>{player.wear}</div>
      </div>
    );
  }

  function renderInventoryView() {
    return (
      <div className="inventoryGrid">
        <div className="inventoryView">
          {player.inventory[0] && (
            <div>
              {player.inventory[0]}
              <div>A</div>
            </div>
          )}
          {player.inventory[1] && (
            <div>
              {player.inventory[1]}
              <div>S</div>
            </div>
          )}
          {player.inventory[2] && (
            <div>
              {player.inventory[2]}
              <div>D</div>
            </div>
          )}
          {player.inventory[3] && (
            <div>
              {player.inventory[3]}
              <div>F</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderLog = () => {
    return (
      <div className="log">
        {logContents.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="App">
      <div className="ui">
        {renderMap()}
        {renderLog()}
        <div className="bottomUi">
          {renderLivesContainer()}
          {renderLuckContainer()}
          {renderScoreKeep()}
          {renderEquipView()}
          {renderInventoryView()}
          {renderGroundView()}
        </div>
      </div>
    </div>
  );
}

//STARTING GAME
initializeGame();
console.log(eatFruit);
log("Game started!", "#32CD32");
export default App;
