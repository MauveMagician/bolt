import React, { useEffect, useState } from "react";
import * as ROT from "rot-js";
import "./App.css";

let player = null;
let engine = null;
let scheduler = null;
let throwing = false;
let throwingIndex = undefined;
let dungeonLevel = 1;
let MAX_LOG_SIZE = 20;
let MAX_INVENTORY_SIZE = 4;
let MAX_BEASTHOOD = 16;
let TO_LEVEL_2 = 4;
let TO_LEVEL_3 = 8;
let TO_LEVEL_4 = 16;
let selectedAnimal = "🐶";
const ASCEND_LEVEL = 16;
const LIVES_CAP = 6;
const generatedMap = {};
let freeCells = [];
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
const effectNames = {};
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

class Enemy {
  constructor(
    x,
    y,
    emoji = "👺",
    maxLives = 2,
    name = "goblin",
    toHit = 3,
    speed = 2,
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
    this._draw();
    this.path = [];
    this.ground = "⬛️";
    this.speed = speed;
    this.defaultSpeed = speed;
    this.passives = passives;
    this.tempEffects = [];
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
  getSpeed() {
    return this.speed;
  }
  beHit(attacker) {
    if (this.passives.includes("Invulnerable")) {
      log(this.name + " shrugs off " + attacker.name + "'s attack", "#B0C4DE");
      return;
    }
    let rollValue = d6();
    if (
      attacker.passives.includes("TwoWeapon") ||
      attacker.passives.includes("Weak") ||
      attacker.passives.includes("Innacuracy")
    ) {
      rollValue = Math.min(d6(), d6());
    }
    if (this.passives.includes("Thick Skin")) {
      rollValue -= 1;
    }
    if (
      attacker.passives.includes("PlusOne") ||
      attacker.passives.includes("Keen Eyes") ||
      this.passives.includes("Soft skin")
    ) {
      rollValue += 1;
    }
    if (
      attacker.passives.includes("Luck mastery") &&
      (rollValue === this.toHit - 2 || rollValue === 4) &&
      attacker.luck > 0
    ) {
      log("Very lucky!", "#00FF00");
      attacker.luck -= 1;
      rollValue += 2;
    } else if (
      (rollValue === this.toHit - 1 || rollValue === 5) &&
      attacker.luck > 0
    ) {
      log("Lucky!", "#00FF00");
      attacker.luck -= 1;
      rollValue += 1;
    }
    if (rollValue >= this.toHit) {
      if (
        (attacker.passives.includes("Mighty") ||
          attacker.passives.includes("TwoWeapon") ||
          attacker.passives.includes("Mighty strikes")) &&
        !attacker.passives.includes("Weak")
      ) {
        this.lives -= 2;
      } else {
        this.lives -= 1;
      }
      if (this.lives <= 0) {
        log(attacker.name + " slays the " + this.name + "!", "#FFD700");
        this.die();
      } else if (
        (attacker.passives.includes("Mighty") ||
          attacker.passives.includes("TwoWeapon") ||
          attacker.passives.includes("Mighty strikes")) &&
        !attacker.passives.includes("Weak")
      ) {
        log(
          attacker.name + " deals a mighty blow to the " + this.name + "!",
          "#E5DE00"
        );
      } else {
        log(attacker.name + " hits the " + this.name + "!", "#E5DE00");
      }
    } else {
      log(attacker.name + " misses the " + this.name + "!", "#F0E68C");
      attacker.luck += 1;
      if (attacker.luck > attacker.maxLuck) {
        attacker.luck = attacker.maxLuck;
      }
    }
    if (rollValue >= 6) {
      log("Critical hit!", "#FFD700");
      if (this.lives > 0) {
        log(attacker.name + " makes an extra attack!", "#FFD700");
        attacker.beasthoodUp(1);
        this.beHit(attacker);
      } else {
        const attackerX = attacker.x;
        const attackerY = attacker.y;
        const directions = [
          [0, -1], // North
          [1, -1], // Northeast
          [1, 0], // East
          [1, 1], // Southeast
          [0, 1], // South
          [-1, 1], // Southwest
          [-1, 0], // West
          [-1, -1], // Northwest
        ];
        let neighborX = undefined;
        let neighborY = undefined;
        for (let i = 0; i < directions.length; i++) {
          const [dx, dy] = directions[i];
          neighborX = attackerX + dx;
          neighborY = attackerY + dy;
          enemies.forEach((enemy) => {
            if (
              enemy.x === neighborX &&
              enemy.y === neighborY &&
              enemy.lives > 0
            ) {
              log(attacker.name + " makes an extra attack!", "#FFD700");
              enemy.beHit(attacker);
              attacker.beasthoodUp(1);
              return;
            }
          });
        }
      }
    }
  }
  die() {
    scheduler.remove(this);
    enemies.splice(enemies.indexOf(this), 1);
    if (this.ground === "⬛️") {
      generatedMap[this._x + "," + this._y] = "🦴";
    } else {
      generatedMap[this._x + "," + this._y] = this.ground;
    }
  }
  act() {
    if (this.passives.includes("Asleep")) {
      this.tempTick();
      return;
    }
    if (this.passives.includes("Confused")) {
      const dir = Math.floor(ROT.RNG.getUniform() * 8);
      const newX = this._x + ROT.DIRS[8][dir][0];
      const newY = this._y + ROT.DIRS[8][dir][1];
      const key = newX + "," + newY;
      if (
        newX >= 0 &&
        newX < 50 &&
        newY >= 0 &&
        newY < 50 &&
        generatedMap[key] !== "🟫" && // Check if the new position is not a wall
        !enemies.some(
          (enemy) => enemy._x === newX && enemy._y === newY && enemy !== this
        ) && // Check if the new position does not have another enemy
        !(player.x === newX && player.y === newY) // Check if the new position is not occupied by the player
      ) {
        generatedMap[this._x + "," + this._y] = this.ground;
        this.ground = generatedMap[key];
        this._x = newX;
        this._y = newY;
        this._draw();
      }
      this.tempTick();
      return;
    }
    var x = player.x;
    var y = player.y;
    var passableCallback = (x, y) => {
      const key = x + "," + y;
      return (
        generatedMap[key] !== "🟫" &&
        !enemies.some(
          (enemy) => enemy._x === x && enemy._y === y && enemy !== this
        )
      );
    };
    var astar = new ROT.Path.AStar(x, y, passableCallback, {
      topology: this.passives.includes("Orthogonal") ? 4 : 8,
    });
    var path = [];
    var pathCallback = function (x, y) {
      path.push([x, y]);
    };
    astar.compute(this._x, this._y, pathCallback);
    if (path.length) {
      this.path = path.slice(0); // Store the computed path for the goblin
      this.path.shift();
      if (this.path.length === 1) {
        if (this.passives.includes("Enfeebling strikes") && d6() >= 6) {
          weakness(player);
        }
        player.beHit(this);
      } else {
        generatedMap[this._x + "," + this._y] = this.ground;
        var nextStep = this.path[0];
        this.ground = generatedMap[nextStep[0] + "," + nextStep[1]];
        this._x = nextStep[0];
        this._y = nextStep[1];
        this._draw();
      }
      this.tempTick();
    }
  }

  burn() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.die();
      log(this.name + " burns to death!", "#FF4500");
      return;
    }
    log(this.name + " is hurt by burning!", "#FF4500");
  }

  tempTick() {
    if (this.passives.includes("On fire")) {
      this.burn();
    }
    for (let key in this.tempEffects) {
      // Access the key and value of the dictionary
      this.tempEffects[key] -= 1;
      if (this.tempEffects[key] <= 0) {
        if (key === "Hasted" || key === "Slowed") {
          this.speed = this.defaultSpeed;
        }
        delete this.tempEffects[key];
        const passiveIndex = this.passives.indexOf(key);
        if (passiveIndex !== -1) {
          this.passives.splice(passiveIndex, 1);
          log(this.name + " is no longer affected by " + key, "SkyBlue");
        }
      }
    }
  }
}

class GridBug extends Enemy {
  constructor(
    x,
    y,
    emoji = "👾",
    maxLives = 1,
    name = "grid bug",
    toHit = 2,
    speed = 2,
    passives = ["Orthogonal", "Mighty strikes"]
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Goblin extends Enemy {
  constructor(
    x,
    y,
    emoji = "👺",
    maxLives = 2,
    name = "goblin",
    toHit = 3,
    speed = 2,
    passives = []
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Ogre extends Enemy {
  constructor(
    x,
    y,
    emoji = "👹",
    maxLives = 5,
    name = "ogre",
    toHit = 4,
    speed = 1,
    passives = ["Mighty strikes"]
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Cockroach extends Enemy {
  constructor(
    x,
    y,
    emoji = "🪳",
    maxLives = 3,
    name = "cockroach",
    toHit = 4,
    speed = 2,
    passives = ["Enfeebling strikes"]
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Mosquito extends Enemy {
  constructor(
    x,
    y,
    emoji = "🦟",
    maxLives = 2,
    name = "cockroach",
    toHit = 2,
    speed = 3,
    passives = ["Blood draining"]
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Dragon extends Enemy {
  constructor(
    x,
    y,
    emoji = "🐉",
    maxLives = 10,
    name = "dragon",
    toHit = 4,
    speed = 3,
    passives = []
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

const dungeonEnemies = [Goblin, GridBug, Ogre];

function nextLevel() {
  dungeonLevel += 1;
  freeCells.length = 0;
  player.ground = "⬛️";
  enemies.forEach((enemy) => {
    scheduler.remove(enemy);
  });
  enemies.length = 0;
  const map = new ROT.Map.Digger(50, 50).create((x, y, value) => {
    const key = x + "," + y;
    generatedMap[key] = value === 1 ? "🟫" : "⬛️";
    if (value === 0) {
      freeCells.push(key);
    }
  });
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  player._x = x;
  player._y = y;
  freeCells = freeCells.filter((cell) => {
    var cellParts = cell.split(",");
    var cellX = parseInt(cellParts[0]);
    var cellY = parseInt(cellParts[1]);
    return Math.abs(cellX - x) > 3 || Math.abs(cellY - y) > 3;
  });
  populateItems();
  populateHoles();
  if (dungeonLevel >= ASCEND_LEVEL) {
    log(dungeonLevel, "white");
    log(player.name + " senses their ultimate goal", "gold");
    placeTrophy();
  }
  const goblins = [];
  for (let i = 0; i < 10; i++) {
    goblins.push(createBeing(Enemy));
  }
  goblins.forEach((element) => {
    scheduler.add(element, true);
  });
  player._draw();
}

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
  // Initialize eatFruit dictionary
  for (let i = 0; i < fruit.length; i++) {
    eatFruit[fruit[i]] = effects[i];
    switch (i) {
      case 0:
        effectNames[fruit[i]] = "healing";
        break;
      case 1:
        effectNames[fruit[i]] = "extra healing";
        break;
      case 2:
        effectNames[fruit[i]] = "poison";
        break;
      case 3:
        effectNames[fruit[i]] = "haste";
        break;
      case 4:
        effectNames[fruit[i]] = "might";
        break;
      case 5:
        effectNames[fruit[i]] = "confusion";
        break;
      case 6:
        effectNames[fruit[i]] = "flying";
        break;
      case 7:
        effectNames[fruit[i]] = "mutation";
        break;
      case 8:
        effectNames[fruit[i]] = "slowing";
        break;
      case 9:
        effectNames[fruit[i]] = "invulnerability";
        break;
      case 10:
        effectNames[fruit[i]] = "weakness";
        break;
      case 11:
        effectNames[fruit[i]] = "beasthood";
        break;
      case 12:
        effectNames[fruit[i]] = "cancellation";
        break;
      case 13:
        effectNames[fruit[i]] = "sleeping";
        break;
      case 14:
        effectNames[fruit[i]] = "fire";
        break;
      case 15:
        effectNames[fruit[i]] = "luck";
        break;
    }
  }
}

function healing(eater, value = 2) {
  eater.lives += value;
  if (eater.lives > eater.maxLives) {
    eater.lives = eater.maxLives;
  }
  log(eater.name + " feels better!", "#7FFF00");
}
function extraHealing(eater) {
  if (eater.lives >= eater.maxLives) {
    eater.lives += 1;
    eater.maxLives += 1;
    log(eater.name + " feels tougher!", "#7FFF00");
  } else {
    eater.lives += 4;
    if (eater.lives > eater.maxLives) {
      eater.lives = eater.maxLives;
    }
    log(eater.name + " feels much better!", "#7FFF00");
  }
}
function poison(eater) {
  if (eater.lives == 1) {
    log(eater.name + " is slain by poison!", "#FF0000");
    eater.lives = 0;
    eater.die();
    return;
  }
  log(eater.name + " is hurt by poison!", "#FF0000");
  eater.lives = 1;
}

function haste(eater) {
  if (eater.passives.includes("Hasted")) {
    log(eater.name + " is even faster!", "#00FFFF");
    eater.speed = 5;
    return;
  }
  if (eater.passives.includes("Slowed")) {
    eater.passives.splice(eater.passives.indexOf("Slowed"), 1);
    delete eater.tempEffects["Slowed"];
    log(eater.name + " is no longer slow!", "#00FFFF");
    eater.speed = eater.defaultSpeed;
    return;
  }
  eater.passives.push("Hasted");
  const duration = d6() + d6() + 6;
  eater.speed = 4;
  eater.tempEffects["Hasted"] = duration;
  log(eater.name + " is fast for " + duration + " turns!", "#00FFFF");
}
function might(eater) {
  eater.passives.push("Mighty");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Mighty"] = duration;
  log(eater.name + " is powerful for " + duration + " turns!", "#00BFFF");
}
function confusion(eater) {
  eater.passives.push("Confused");
  const duration = d6() + 6;
  eater.tempEffects["Confused"] = duration;
  log(eater.name + " is confused for " + duration + " turns!", "#FF00FF");
}
function flying(eater) {
  eater.passives.push("Flying");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Flying"] = duration;
  log(eater.name + " is flying for " + duration + " turns!", "#87CEFA");
}
function mutation(eater) {
  log(eater.name + " mutates!", "#DDA0DD");
  const mutation_quality = d6();
  if (mutation_quality > 4) {
    //Good mutations
    const mutation_type = d6();
    switch (mutation_type) {
      case 1:
        eater.lives += 1;
        eater.maxLives += 1;
        log(eater.name + " becomes tougher!", "#DDA0DD");
        break;
      case 2:
        eater.passives.push("Keen Eyes");
        log(eater.name + " acquires keen accuracy!", "#DDA0DD");
        break;
      case 3:
        if ("luck" in eater) {
          eater.luck += 1;
          eater.maxLuck += 1;
          log(eater.name + " becomes luckier!", "#DDA0DD");
        } else {
          log(eater.name + "'s mutation is unstable!", "#DDA0DD");
          mutation(eater);
          mutation(eater);
        }
        break;
      case 4:
        eater.passives.push("Thick skin");
        log(eater.name + "'s skin thickens!", "#DDA0DD");
        break;
      case 5:
        if ("beasthood" in eater) {
          eater.minBeasthood += 1;
          eater.beasthoodUp(1);
          log(eater.name + " gains permanent beasthood!", "#DDA0DD");
        } else {
          log(eater.name + "'s mutation is unstable!", "#DDA0DD");
          mutation(eater);
          mutation(eater);
        }
        break;
      case 6:
        log(eater.name + "'s mutation is unstable!", "#DDA0DD");
        mutation(eater);
        mutation(eater);
        break;
    }
  } else {
    //Bad mutations
    const mutation_type = d6();
    switch (mutation_type) {
      case 1:
        eater.lives -= 1;
        eater.maxLives -= 1;
        if (eater.lives <= 0) {
          log(eater.name + " is slain by mutation!", "#DDA0DD");
          eater.lives = 0;
          eater.die();
          return;
        }
        log(eater.name + " becomes flimsy!", "#DDA0DD");
        break;
      case 2:
        eater.passives.push("Innacuracy");
        log(eater.name + " loses accuracy!", "#DDA0DD");
        break;
      case 3:
        if ("luck" in eater) {
          eater.luck -= 1;
          eater.maxLuck -= 1;
          log(eater.name + " becomes less lucky!", "#DDA0DD");
        } else {
          log(eater.name + "'s mutation is unstable!", "#DDA0DD");
          mutation(eater);
          mutation(eater);
        }
        break;
      case 4:
        eater.passives.push("Soft skin");
        log(eater.name + " becomes easier to hit!", "#DDA0DD");
        break;
      case 5:
        log(eater.name + "'s mutation is a dud!", "#DDA0DD");
        break;
      case 6:
        log(eater.name + "'s mutation is unstable!", "#DDA0DD");
        mutation(eater);
        mutation(eater);
        break;
    }
  }
}
function slowing(eater) {
  if (eater.passives.includes("Slowed")) {
    log(eater.name + " can't get any slower!", "#00FFFF");
    return;
  }
  if (eater.passives.includes("Hasted")) {
    eater.passives.splice(eater.passives.indexOf("Hasted"), 1);
    delete eater.tempEffects["Hasted"];
    log(eater.name + " is no longer hasted!", "#00FFFF");
    eater.speed = eater.defaultSpeed;
    return;
  }
  eater.passives.push("Slowed");
  const duration = d6() + d6() + 6;
  eater.speed = 1;
  eater.tempEffects["Slowed"] = duration;
  log(eater.name + " is slow for " + duration + " turns!", "#00FFFF");
}
function invunlerability(eater) {
  eater.passives.push("Invulnerable");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Invulnerable"] = duration;
  log(
    eater.name + " becomes invulnerable for " + duration + " turns!",
    "#00BFFF"
  );
}
function weakness(eater) {
  eater.passives.push("Weak");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Weak"] = duration;
  log(eater.name + " becomes weakened for " + duration + " turns!", "#8B0000");
}
function beasthood(eater) {
  log(eater.name + " unleashes their instincts!", "#DC143C");
  if ("beasthood" in eater) {
    eater.beasthoodUp(16);
  } else {
    eater.lives *= 2;
    eater.maxLives *= 2;
    eater.toHit = Math.min(eater.toHit + 1, 6);
    eater.speed += 1;
  }
}
function cancellation(eater) {
  if (Object.keys(eater.tempEffects).length === 0) {
    if (eater.passives.length > 0) {
      const filteredPassives = eater.passives.filter(
        (passive) => passive !== "TwoWeapon" && passive !== "PlusOne"
      );
      if (filteredPassives.length > 0) {
        const randomIndex = Math.floor(Math.random() * filteredPassives.length);
        const removedPassive = filteredPassives.splice(randomIndex, 1)[0];
        eater.passives = filteredPassives;
        log(eater.name + " loses the passive: " + removedPassive, "#9932CC");
        return;
      }
    }
  } else {
    for (let effect in eater.tempEffects) {
      delete eater.tempEffects[effect]; // Remove the effect from tempEffects
      eater.passives = eater.passives.filter((passive) => passive !== effect); // Filter out the passive from passives
    }
    log(eater.name + "'s temporary effects are cancelled!", "#9932CC");
    return;
  }
  log(eater.name + " is cancelled, but loses nothing", "#9932CC");
}
function sleeping(eater) {
  eater.passives.push("Asleep");
  const duration = d6() + 3;
  eater.tempEffects["Asleep"] = duration;
  log(eater.name + " falls asleep for " + duration + " turns!", "#AFEEEE");
}
function fire(eater) {
  eater.passives.push("On fire");
  const duration = Infinity;
  eater.tempEffects["On fire"] = duration;
  log(eater.name + " is on fire until they pass their turn!", "#FF4500");
}
function luck(eater) {
  if ("luck" in eater) {
    if (eater.luck >= eater.maxLuck) {
      eater.luck += 1;
      eater.maxLuck += 1;
      log(eater.name + " feels luckier!", "#7FFF00");
    } else {
      eater.luck = eater.maxLuck;
      log(eater.name + "'s luck is refilled!", "#7FFF00");
    }
  } else {
    eater.passives.push("Luck");
    log(eater.name + " feels luckier!", "#7FFF00");
  }
}

function eat(eater, fruit) {
  if (eatFruit[fruit]) {
    eatFruit[fruit](eater);
  }
}

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

function d2() {
  return Math.floor(Math.random() * 2) + 1;
}

class Player {
  constructor(
    x,
    y,
    emoji = "🐶",
    maxLives = 3,
    name = "Bolt",
    toHit = 4,
    inventory = [],
    passives = ["Bone chewer"],
    speed = 2,
    maxLuck = 4,
    minBeasthood = 0,
    levelBenefits = ["Mighty strikes", "Digger", "Sapper"]
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
    this.tempEffects = {};
    this.speed = speed;
    this.defaultSpeed = speed;
    this.luck = maxLuck;
    this.maxLuck = maxLuck;
    this.level = 1;
    this.beasthood = minBeasthood;
    this.minBeasthood = minBeasthood;
    this.levelBenefits = levelBenefits;
    this.incombat = false;
    this.combat_timer = 0;
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

  getSpeed() {
    return this.speed;
  }

  beasthoodUp(value) {
    if (this.beasthood < MAX_BEASTHOOD) {
      this.beasthood += value;
      if (this.beasthood > MAX_BEASTHOOD) {
        this.beasthood = MAX_BEASTHOOD;
      }
      if (this.beasthood >= TO_LEVEL_4 && this.level < 4) {
        log(this.name + " advances to level 4!", "#FF69B4");
        this.level = 4;
        this.passives.push(this.levelBenefits[2]);
        if (!this.passives.includes(this.levelBenefits[1])) {
          this.passives.push(this.levelBenefits[1]);
        }
        if (!this.passives.includes(this.levelBenefits[0])) {
          this.passives.push(this.levelBenefits[0]);
        }
      } else if (this.beasthood >= TO_LEVEL_3 && this.level < 3) {
        log(this.name + " advances to level 3!", "#FF69B4");
        this.level = 3;
        this.passives.push(this.levelBenefits[1]);
        if (!this.passives.includes(this.levelBenefits[0])) {
          this.passives.push(this.levelBenefits[0]);
        }
      } else if (this.beasthood >= TO_LEVEL_2 && this.level < 2) {
        log(this.name + " advances to level 2!", "#FF69B4");
        this.level = 2;
        this.passives.push(this.levelBenefits[0]);
      }
    }
  }

  beasthoodDown(value) {
    if (this.beasthood > 0) {
      this.beasthood -= value;
      if (this.beasthood < this.minBeasthood) {
        this.beasthood = this.minBeasthood;
      }
      if (this.beasthood < TO_LEVEL_2 && this.level > 1) {
        log(this.name + " regresses to level 1!", "#FF7F50");
        this.level = 1;
        let index = this.passives.indexOf(this.levelBenefits[0]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
        index = this.passives.indexOf(this.levelBenefits[1]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
        index = this.passives.indexOf(this.levelBenefits[2]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
      } else if (this.beasthood < TO_LEVEL_3 && this.level > 2) {
        log(this.name + " regresses to level 2!", "#FF7F50");
        this.level = 2;
        let index = this.passives.indexOf(this.levelBenefits[1]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
        index = this.passives.indexOf(this.levelBenefits[2]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
      } else if (this.beasthood < TO_LEVEL_4 && this.level > 3) {
        log(this.name + " regresses to level 3!", "#FF7F50");
        this.level = 3;
        let index = this.passives.indexOf(this.levelBenefits[2]);
        if (index !== -1) {
          this.passives.splice(index, 1);
        }
      }
    }
  }

  beHit(enemy) {
    this.incombat = true;
    this.combat_timer = 6;
    if (this.passives.includes("Invulnerable")) {
      log(this.name + " shrugs off the " + enemy.name + "'s attack", "#B0C4DE");
      return;
    }
    let rollValue = d6();
    if (
      enemy.passives.includes("TwoWeapon") ||
      enemy.passives.includes("Weak") ||
      enemy.passives.includes("Innacuracy") ||
      this.passives.includes("Great defense")
    ) {
      rollValue = Math.min(d6(), d6());
    }
    if (
      enemy.passives.includes("Lucky") ||
      enemy.passives.includes("Keen Eyes") ||
      this.passives.includes("Soft Skin")
    ) {
      rollValue += 1;
    }
    if (this.passives.includes("Thick Skin")) {
      rollValue -= 1;
    }
    this.beasthoodUp(1);
    if (rollValue >= this.toHit) {
      if (
        enemy.passives.includes("Mighty") ||
        enemy.passives.includes("Mighty strikes")
      ) {
        this.lives -= 2;
        log(
          "The " + enemy.name + " hits " + this.name + " with a mighty blow!",
          "red"
        );
      } else {
        this.lives -= 1;
        log("The " + enemy.name + " hits " + this.name + "!", "red");
      }
      if (this.lives == 1) {
        log(this.name + " is on their last breath!", "#8B0000");
      }
      if (this.lives <= 0) {
        this.die();
      }
      if (enemy.passives.includes("Blood draining")) {
        log(enemy.name + " drains " + this.name + "'s blood!", "red");
        healing(enemy, 1);
      }
      document.querySelector(".App").classList.add("shake");
      setTimeout(() => {
        document.querySelector(".App").classList.remove("shake");
      }, 200);
    } else {
      log("The " + enemy.name + " misses " + this.name + "!", "#FFA500");
    }
  }

  burn() {
    this.incombat = true;
    this.combat_timer = 6;
    document.querySelector(".App").classList.add("shake");
    setTimeout(() => {
      document.querySelector(".App").classList.remove("shake");
    }, 200);
    this.lives -= 1;
    log(this.name + " is hurt by burning!", "#FF4500");
    if (this.lives === 1) {
      log(this.name + " is on their last breath!", "#8B0000");
    }
    if (this.lives <= 0) {
      this.die();
    }
  }

  die() {
    if (this.passives.includes("Many lives")) {
      log(this.name + " is slain but has many lives!", "#FF1493");
      this.beasthoodDown(Infinity);
      if (this.maxLives < 1) {
        this.maxLives = 1;
      }
      this.lives = this.maxLives;
      return;
    }
    engine.lock();
    log("Game over!", "#FF1493");
  }

  win() {
    engine.lock();
    log(
      this.name + " takes the trophy and finally becomes a true champion!",
      "white"
    );
    log(
      "Congratulations! You and " +
        this.name +
        " have defeated the Labyrinth together! You win!",
      "gold"
    );
  }

  useGround() {
    if (this.ground === "🏆") {
      this.win();
      return true;
    }
    if (this.ground === "🕳️") {
      nextLevel();
      return true;
    }
    if (this.passives.includes("Bone chewer") && this.ground === "🦴") {
      this.ground = "⬛️";
      log(this.name + " chews on a bone!", "white");
      healing(this, 1);
      return true;
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
    return false;
  }

  wieldWeapon(item) {
    // Logic to equip the item
    // Example: When equipping a dagger, add the "PlusOne" passive ability
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
    if (this.passives.includes("Asleep")) {
      log(this.name + " is asleep", "red");
    } else {
      engine.lock();
      /* wait for user input; do stuff when user hits a key */
      setTimeout(() => window.addEventListener("keydown", this), 50);
    }
    this.tempTick();
  }

  tempTick() {
    if (this.passives.includes("On fire")) {
      this.burn();
    }
    if (!this.incombat) {
      this.lives = Math.min(this.maxLives, this.lives + 1);
      this.luck = Math.min(this.maxLuck, this.luck + 1);
      this.beasthoodDown(1);
    } else {
      this.combat_timer -= 1;
      if (this.combat_timer <= 0) {
        this.incombat = false;
      }
    }
    for (let key in this.tempEffects) {
      // Access the key and value of the dictionary
      this.tempEffects[key] -= 1;
      if (this.tempEffects[key] <= 0) {
        if (key === "Hasted" || key === "Slowed") {
          this.speed = this.defaultSpeed;
        }
        delete this.tempEffects[key];
        const passiveIndex = this.passives.indexOf(key);
        if (passiveIndex !== -1) {
          this.passives.splice(passiveIndex, 1);
          log(this.name + " is no longer affected by " + key, "SkyBlue");
        }
      }
    }
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
    keyMap[87] = 8;
    keyMap[81] = 8;
    keyMap[65] = 8;
    keyMap[83] = 8;
    keyMap[68] = 8;
    keyMap[69] = 8;
    keyMap[70] = 8;
    if (
      this.passives.includes("Sapper") ||
      this.passives.includes("Appraise") ||
      this.passives.includes("Ultrasonic Blast")
    ) {
      keyMap[82] = 8;
    }
    var code = e.keyCode;
    if (
      throwing &&
      throwingIndex === undefined &&
      ![65, 83, 68, 70].includes(code)
    ) {
      throwing = false;
      throwingIndex = undefined;
      log("Nevermind.", "white");
      return;
    } else if (
      throwing &&
      throwingIndex !== undefined &&
      ![
        38, 33, 39, 34, 40, 35, 37, 36, 75, 85, 76, 78, 74, 66, 72, 89,
      ].includes(code)
    ) {
      throwing = false;
      throwingIndex = undefined;
      log("Nevermind.", "white");
      return;
    }
    if (!(code in keyMap)) {
      return;
    }
    if (code === 82) {
      let action = false;
      if (this.passives.includes("Ultrasonic Blast")) {
        log(this.name + " lets loose an ultrasonic blast!", "gold");
        enemies.forEach((enemy) => {
          if (
            enemy.lives > 0 &&
            Math.abs(this._x - enemy.x) <= 3 &&
            Math.abs(this._y - enemy.y) <= 3
          ) {
            this.attack(enemy);
          }
        });
        this.beasthoodDown(3);
        action = true;
      }
      if (this.passives.includes("Sapper") && this.ground === "⬛️") {
        log(this.name + " digs a hole!", "gold");
        this.beasthoodDown(Infinity);
        this.ground = "🕳️";
        action = true;
      } else if (this.passives.includes("Sapper") && this.ground !== "⬛️") {
        log(this.name + " can't dig if stuff is on the floor", "#F0E68C");
      }
      if (this.passives.includes("Appraise")) {
        if (player.inventory.length > 0) {
          var randomIndex = Math.floor(Math.random() * player.inventory.length);
          var randomFruit = player.inventory[randomIndex];
          log(
            this.name +
              " appraises the " +
              fruitNames[randomFruit] +
              "! It's a fruit of " +
              effectNames[randomFruit] +
              "!",
            "gold"
          );
          this.beasthoodDown(2);
          action = true;
        } else {
          log(this.name + " has nothing to appraise", "#F0E68C");
        }
      }
      if (action) {
        window.removeEventListener("keydown", this);
        engine.unlock();
        return;
      }
      return;
    }
    if (code === 81) {
      if (player.useGround()) {
        if (!this.passives.includes("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      return;
    }
    if (code === 188 || code === 87) {
      // If the comma key is pressed, pass the turn
      window.removeEventListener("keydown", this);
      if (player.passives.includes("On fire")) {
        player.tempEffects["On fire"] = 0;
      }
      engine.unlock();
      return;
    }
    if (code === 69) {
      if (player.inventory.length > 0) {
        throwing = true;
        log("Select an item to throw", "white");
      } else {
        log(this.name + " has nothing to throw", "#F0E68C");
      }
      return;
    }
    if (code === 65) {
      if (player.inventory.length > 0) {
        if (throwing) {
          throwingIndex = 0;
          log(
            "Select a direction to throw the " +
              fruitNames[player.inventory[0]],
            "white"
          );
          return;
        }
        eat(player, player.inventory[0]);
        player.inventory.splice(0, 1);
        if (!this.passives.includes("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      log(this.name + " has nothing there", "#F0E68C");
      return;
    }
    if (code === 83) {
      if (player.inventory.length > 1) {
        if (throwing) {
          throwingIndex = 1;
          log(
            "Select a direction to throw the " +
              fruitNames[player.inventory[1]],
            "white"
          );
          return;
        }
        eat(player, player.inventory[1]);
        player.inventory.splice(1, 1);
        if (!this.passives.includes("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      log(this.name + " has nothing there", "#F0E68C");
      return;
    }
    if (code === 68) {
      if (player.inventory.length > 2) {
        if (throwing) {
          throwingIndex = 2;
          log(
            "Select a direction to throw the " +
              fruitNames[player.inventory[2]],
            "white"
          );
          return;
        }
        eat(player, player.inventory[2]);
        player.inventory.splice(2, 1);
        if (!this.passives.includes("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      log(this.name + " has nothing there", "#F0E68C");
      return;
    }
    if (code === 70) {
      if (player.inventory.length > 3) {
        if (throwing) {
          throwingIndex = 3;
          log(
            "Select a direction to throw the " +
              fruitNames[player.inventory[3]],
            "white"
          );
          return;
        }
        eat(player, player.inventory[3]);
        player.inventory.splice(3, 1);
        if (!this.passives.includes("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      log(this.name + " has nothing there", "#F0E68C");
      return;
    }
    var confusion = false;
    if (player.passives.includes("Confused") && Math.random() < 0.5) {
      var diff = ROT.DIRS[8][Math.floor(Math.random() * 7) + 1];
      confusion = true;
      log(this.name + " moves randomly due to confusion", "#FF00FF");
    } else {
      var diff = ROT.DIRS[8][keyMap[code]];
    }
    var newX = this._x + diff[0];
    var newY = this._y + diff[1];
    if (throwingIndex !== undefined) {
      this.throwFruit(player.inventory[throwingIndex], keyMap[code]);
      throwing = false;
      throwingIndex = undefined;
      window.removeEventListener("keydown", this);
      engine.unlock();
      return;
    }
    const newKey = newX + "," + newY;

    if (generatedMap[newKey] === "🟫") {
      if (confusion) {
        log(this.name + " tries to move into a wall!", "#EE82EE");
        window.removeEventListener("keydown", this);
        engine.unlock();
      }
      if (
        this.passives.includes("Digger") &&
        newX != 0 &&
        newY != 0 &&
        newX != 49 &&
        newY != 49
      ) {
        generatedMap[newKey] = "⬛️";
        window.removeEventListener("keydown", this);
        engine.unlock();
      }
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
      if (this.passives.includes("Pounce")) {
        const pounce_x = this._x + diff[0];
        const pounce_y = this._y + diff[1];
        enemies.forEach((enemy) => {
          if (enemy.x === pounce_x && enemy.y === pounce_y && enemy.lives > 0) {
            log(this.name + " pounces on the " + enemy.name + "!", "gold");
            player.attack(enemy);
          }
        });
      }
      engine.unlock();
    }
  }

  attack(enemy) {
    const procRoll = d6();
    if (procRoll >= 6) {
      if (this.passives.includes("Pickup") && this.inventory.length < 4) {
        const randomIndex = Math.floor(Math.random() * fruit.length);
        this.inventory.push(fruit[randomIndex]);
        log(
          this.name + " pilfers a " + fruitNames[fruit[randomIndex]] + "!",
          "#00FF00"
        );
      }
    }
    this.incombat = true;
    this.combat_timer = 6;
    this.beasthoodUp(1);
    enemy.beHit(player);
  }

  throwFruit(fruit, direction, x = this._x, y = this._y) {
    var newX = x + ROT.DIRS[8][direction][0];
    var newY = y + ROT.DIRS[8][direction][1];
    var newKey = newX + "," + newY;
    // Remove the thrown fruit from the player's inventory
    const index = this.inventory.indexOf(fruit);
    if (index !== -1) {
      this.inventory.splice(index, 1);
    }
    let hitEnemy = false;
    enemies.forEach((enemy) => {
      if (enemy.x === newX && enemy.y === newY && enemy.lives > 0) {
        eat(enemy, fruit);
        if (player.passives.includes("Confuse throw")) {
          confusion(enemy);
        }
        hitEnemy = true;
        return;
      }
    });
    if (generatedMap[newKey] !== "🟫" && !hitEnemy) {
      return this.throwFruit(fruit, direction, newX, newY);
    } else {
      if (generatedMap[newKey] === "🟫" && !hitEnemy) {
        log("The " + fruitNames[fruit] + " hits a wall!", "#EE82EE");
        const key = x + "," + y;
        if (generatedMap[key] === "⬛️") {
          generatedMap[key] = fruit;
        } else {
          log("The " + fruitNames[fruit] + " goes splat!", "#EE82EE");
        }
      }
    }
  }
}

function createPlayer() {
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  switch (selectedAnimal) {
    case "🐶":
      player = new Player(x, y);
      break;
    case "🐱":
      player = new Player(x, y, "🐱", 2, "Mimi", 2, [], [], 3, 5, 0, [
        "Pounce",
        "Luck mastery",
        "Many lives",
      ]);
      break;
    case "🦝":
      player = new Player(x, y, "🦝", 3, "Max", 3, [], ["Pickup"], 2, 5, 0, [
        "Appraise",
        "Confuse throw",
        "Fast paws",
      ]);
      break;
    case "🐋":
      player = new Player(x, y, "🐋", 4, "Wave", 4, [], ["Aquatic"], 2, 4, 0, [
        "Mighty strikes",
        "Great defense",
        "Ultrasonic Blast",
      ]);
      break;
    default:
      player = new Player(x, y, selectedAnimal, 3);
      break;
  }
}

function populateItems(level = 1) {
  for (var i = 0; i < 50; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells.splice(index, 1)[0];
    if (d6() === 6) {
      // 1/6 chance for weapon
      generatedMap[key] = Math.random() < 0.5 ? "🗡️" : "⚔️"; // Equal chance for Dagger or Double Sword
    } else {
      // 5/6 chance for fruit
      var randomFruitIndex = Math.floor(Math.random() * fruit.length);
      generatedMap[key] = fruit[randomFruitIndex];
    }
  }
}

function populateHoles(level = 1) {
  for (var i = 0; i < 5; i++) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells.splice(index, 1)[0];
    var parts = key.split(",");
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);
    generatedMap[key] = "🕳️";

    // Remove adjacent cells from freeCells
    const adjacentOffsets = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    adjacentOffsets.forEach((offset) => {
      const adjacentKey = x + offset[0] + "," + (y + offset[1]);
      const adjacentIndex = freeCells.indexOf(adjacentKey);
      if (adjacentIndex !== -1) {
        freeCells.splice(adjacentIndex, 1);
      }
    });
  }
}

function placeTrophy() {
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  const guardianCells = [];
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  generatedMap[key] = "🏆";

  const adjacentOffsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  adjacentOffsets.forEach((offset) => {
    const adjacentKey = x + offset[0] + "," + (y + offset[1]);
    const adjacentIndex = freeCells.indexOf(adjacentKey);
    if (adjacentIndex !== -1) {
      guardianCells.push(freeCells.splice(adjacentIndex, 1));
    }
  });
  const guardian = createBeing(Dragon, true, guardianCells);
  scheduler.add(guardian, true);
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
  populateItems();
  populateHoles();
  const goblins = [];
  for (let i = 0; i < 10; i++) {
    goblins.push(createBeing());
  }
  scheduler = new ROT.Scheduler.Speed();
  scheduler.add(player, true);
  goblins.forEach((element) => {
    scheduler.add(element, true);
  });
  engine = new ROT.Engine(scheduler);
  engine.start();
}

function createBeing(what = undefined, guardian = false, guardianCells = []) {
  if (!guardian) {
    var roll = d2() + d2(); // Assuming d2() is a function that returns 1 or 2
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var key = freeCells.splice(index, 1)[0];
    var parts = key.split(",");
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);

    switch (roll) {
      case 2:
        return new Goblin(x, y);
      case 3:
        return new GridBug(x, y);
      case 4:
        return new Ogre(x, y);
      default:
        // Optionally handle unexpected roll values
        console.error("Unexpected roll value:", roll);
        return null;
    }
  } else {
    var index = Math.floor(ROT.RNG.getUniform() * guardianCells.length);
    var key = guardianCells.splice(index, 1)[0];
    var parts = key[0].split(",");
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);
    // Adjust this part if you want to use the roll logic for guardians as well
    return new what(x, y);
  }
}

//LOGIC ENDS HERE. DRAWING STARTS HERE

function App() {
  const [dungeon, setDungeon] = useState({}); // Initialize dungeon state
  const [gameStarted, setGameStarted] = useState(false);
  const [animalSelected, setAnimalSelected] = useState(false);

  const startGame = () => {
    setGameStarted(true);
  };

  const selectAnimal = () => {
    initializeGame();
    log("Game started!", "#32CD32");
    player.inventory.push(
      Object.keys(eatFruit).find((key) => eatFruit[key] === healing)
    );
    player.inventory.push(
      Object.keys(eatFruit).find((key) => eatFruit[key] === fire)
    );
    setAnimalSelected(true);
  };

  const renderStartScreen = () => {
    if (!gameStarted) {
      return (
        <div className="startScreen">
          <h1>Beasts of Labyrinth Tactics (BoLT)</h1>
          <p className="versionInfo">Version 1.0.0 Alpha</p>
          <button onClick={startGame}>Game Start</button>
          <p>ATTRIBUTION CREDITS: Enter Command font is made by jeti</p>
        </div>
      );
    }
    return null; // Return null if game has started
  };

  const renderAnimalSelectionScreen = () => {
    const animalInfo = (animal) => {
      switch (animal) {
        case "🐶":
          return "Dog - Loyal and fierce, with a talent for digging.";
        case "🐱":
          return "Cat - Agile and mysterious, with multiple lives.";
        case "🦝":
          return "Raccoon - Clever and resourceful, with a knack for finding items.";
        case "🐋":
          return "Whale - Powerful and resilient, with aquatic abilities.";
        default:
          return "";
      }
    };

    return (
      <div className="animalSelectionScreen">
        <h2 className="selectYourChampion">Select Your Champion</h2>
        <div className="animalGrid">
          <div
            className="animalGridItem"
            onClick={() => {
              selectedAnimal = "🐶";
              selectAnimal();
            }}
          >
            🐶
            <div className="animalInfo">{animalInfo("🐶")}</div>
          </div>
          <div
            className="animalGridItem"
            onClick={() => {
              selectedAnimal = "🐱";
              selectAnimal();
            }}
          >
            🐱
            <div className="animalInfo">{animalInfo("🐱")}</div>
          </div>
          <div
            className="animalGridItem"
            onClick={() => {
              selectedAnimal = "🦝";
              selectAnimal();
            }}
          >
            🦝
            <div className="animalInfo">{animalInfo("🦝")}</div>
          </div>
          <div
            className="animalGridItem"
            onClick={() => {
              selectedAnimal = "🐋";
              selectAnimal();
            }}
          >
            🐋
            <div className="animalInfo">{animalInfo("🐋")}</div>
          </div>
        </div>
      </div>
    );
  };

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
      <div
        className="livesContainer"
        title="Champion lives. You lose if they ever run out."
      >
        <div style={{ display: "inline-block", verticalAlign: "middle" }}>
          {hearts}
        </div>
      </div>
    );
  };

  function renderBeasthoodContainer() {
    let beasthoodValue = player.beasthood;
    if (player.level === 1) {
      beasthoodValue = 4;
    } else if (player.level === 2) {
      beasthoodValue = 8;
    } else if (player.level === 3) {
      beasthoodValue = 16;
    }

    const beasthoodDisplay =
      player.beasthood === 16 ? "MAX" : `${player.beasthood}/${beasthoodValue}`;

    return (
      <div
        className="beasthoodContainer"
        title="Champion beasthood. Attack and be attacked to gain points and go up levels. Champions unlock abilities as they level up. Walking and other actions reduce beasthood points. Passing the turn converts beasthood points into luck."
      >
        <div>
          Beast L{player.level} {beasthoodDisplay}
        </div>
      </div>
    );
  }

  function renderLuckContainer() {
    return (
      <div
        className="luckContainer"
        title="Champion luck. It's spent as needed to give your champion a slight edge in combat."
      >
        <div>
          Luck {player.luck}/{player.maxLuck}
        </div>
      </div>
    );
  }

  function renderGroundView() {
    return (
      <div
        className="groundView"
        title="Ground view. What your champion is standing on can be seen here."
      >
        <div>{player.ground}</div>
      </div>
    );
  }

  function renderEquipView() {
    return (
      <div
        className="equipView"
        title="Equip view. Your equipment can be seen here."
      >
        <div>{player.wield}</div>
        <div>{player.wear}</div>
      </div>
    );
  }

  function renderInventoryView() {
    return (
      <div
        className="inventoryGrid"
        title="Inventory. Press the corresponding key to use the item."
      >
        <div className="inventoryView">
          {player.inventory[0] && (
            <div>
              {player.inventory[0]}
              <div className="inventoryLetter">A</div>
            </div>
          )}
          {player.inventory[1] && (
            <div>
              {player.inventory[1]}
              <div className="inventoryLetter">S</div>
            </div>
          )}
          {player.inventory[2] && (
            <div>
              {player.inventory[2]}
              <div className="inventoryLetter">D</div>
            </div>
          )}
          {player.inventory[3] && (
            <div>
              {player.inventory[3]}
              <div className="inventoryLetter">F</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderLog = () => {
    return (
      <div
        className="log"
        title="Game log. The last 10 game events are registered here."
      >
        {logContents.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
    );
  };

  const renderGame = () => {
    return (
      <div className="App">
        <div className="ui">
          {renderMap()}
          <div className="bottomUi">
            {renderLivesContainer()}
            {renderLuckContainer()}
            {renderBeasthoodContainer()}
            {renderEquipView()}
            {renderInventoryView()}
            {renderGroundView()}
          </div>
          {renderLog()}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {renderStartScreen()}
      {gameStarted && !animalSelected && renderAnimalSelectionScreen()}
      {gameStarted && animalSelected ? renderGame() : null}
    </div>
  );
}

//STARTING GAME
export default App;
