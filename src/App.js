import React, { useEffect, useState } from "react";
import * as ROT from "rot-js";
import "./App.css";
import app from "./firebaseConfig";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getDocs, orderBy, limit, query } from "firebase/firestore";

let player = null;
let engine = null;
let scheduler = null;
let throwing = false;
let dashing = false;
let gotTrophy = false;
let throwingIndex = undefined;
let dungeonLevel = 1;
let MAX_LOG_SIZE = 20;
let MAX_INVENTORY_SIZE = 4;
let MAX_BEASTHOOD = 16;
let TO_LEVEL_2 = 4;
let TO_LEVEL_3 = 8;
let TO_LEVEL_4 = 16;
let selectedAnimal = "🐶";
let won = false;
const db = getFirestore(app);
const ASCEND_LEVEL = 16;
const LIVES_CAP = 6;
const LUCK_CAP = 16;
const COMBAT_TIME = 12;
const generatedMap = {};
let freeCells = [];
const scoringSequence = [
  100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000, 10000,
];
let killStreak = 0;
let score = 0;
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
  "🪚", // Painsaw
  "🏹", // Bow and Arrow
  "🪓", // Axe
  "🔨", // Hammer
  "⛏️", // Pick
  "🎸", // Guitar
  "🔪", // Kitchen Knife
  "🛡️", // Shield
  "🥊", // Glove
];
const addScoreToLeaderboard = async (playerName, score) => {
  try {
    const docRef = await addDoc(collection(db, "leaderboard"), {
      name: playerName,
      champion: selectedAnimal,
      score: score,
      timestamp: new Date(),
    });
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};

function attackCalculation(attacker, defender) {
  let rollValue = d6();
  const disadvantageSources = [
    attacker.passives.has("TwoWeapon"),
    attacker.passives.has("Weak"),
    attacker.passives.has("Innacuracy"),
    defender.passives.has("Great defense"),
  ].filter(Boolean).length;

  const advantageSources = [attacker.passives.has("Keen Eyes")].filter(
    Boolean
  ).length;

  if (disadvantageSources > advantageSources) {
    rollValue = Math.min(d6(), d6()); // More sources of disadvantage
  } else if (advantageSources > disadvantageSources) {
    rollValue = Math.max(d6(), d6()); // More sources of advantage
  }

  if (attacker.passives.has("PlusOne")) {
    rollValue += 1;
  }

  // Check for luck-based adjustments only if the attacker has a luck property
  if (typeof attacker.luck !== "undefined" && attacker.luck > 0) {
    const isVeryLucky =
      attacker.passives.has("Luck mastery") &&
      (rollValue === defender.toHit - 2 || rollValue === 4);
    const isLucky =
      !isVeryLucky && (rollValue === defender.toHit - 1 || rollValue === 5);
    if (isVeryLucky) {
      log("Very lucky!", "#00FF00");
      attacker.luck -= 1;
      rollValue += 2;
    } else if (isLucky) {
      log("Lucky!", "#00FF00");
      attacker.luck -= 1;
      rollValue += 1;
    }
  }
  return rollValue;
}

function damageCalculation(attacker, defender) {
  let might = 1;
  if (attacker.passives.has("TwoWeapon")) might++;
  if (attacker.passives.has("Mighty strikes")) might++;
  if (defender.passives.has("Soft skin")) might++;
  if (defender.passives.has("Thick Skin")) might = Math.max(might - 1, 1);
  if (attacker.passives.has("Mighty")) might *= 2;
  if (attacker.passives.has("Weak")) might = Math.ceil(might / 2);
  let damage = Math.log2(might + 1);
  damage = Math.ceil(damage);
  damage = Math.min(damage, 6);
  return damage;
}

class Enemy {
  constructor(
    x,
    y,
    emoji = "👺",
    maxLives = 2,
    name = "goblin",
    toHit = 3,
    speed = 2,
    passives = new Set()
  ) {
    this._x = x;
    this._y = y;
    this._emoji = emoji;
    this.lives = maxLives;
    this.maxLives = maxLives;
    this.name = name;
    this.toHit = toHit;
    this._draw();
    this.path = [];
    this.ground = "⬛️";
    this.speed = speed;
    this.defaultSpeed = speed;
    this.passives = passives;
    this.tempEffects = new Map();
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
    if (this.passives.has("Invulnerable")) {
      log(this.name + " shrugs off " + attacker.name + "'s attack", "#B0C4DE");
      return;
    }
    let rollValue = attackCalculation(attacker, this);
    if (rollValue >= this.toHit) {
      const damage = damageCalculation(attacker, this);
      this.lives -= damage;
      if (this.lives <= 0) {
        log(attacker.name + " slays the " + this.name + "!", "#FFD700");
        this.die();
      } else if (damage >= 2) {
        log(
          `${attacker.name} deals ${damage} damage to the ${this.name}!`,
          "#E5DE00"
        );
      } else {
        log(attacker.name + " hits the " + this.name + "!", "#E5DE00");
      }
    } else {
      log(attacker.name + " misses the " + this.name + "!", "#F0E68C");
      attacker.luck = Math.min(attacker.luck + 1, attacker.maxLuck);
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
    score += scoringSequence[Math.min(killStreak, scoringSequence.length - 1)];
    killStreak += 1;
    if (this.ground === "⬛️") {
      generatedMap[this._x + "," + this._y] = "🦴";
    } else {
      generatedMap[this._x + "," + this._y] = this.ground;
    }
  }
  act() {
    if (this.passives.has("Asleep")) {
      this.tempTick();
      return;
    }
    if (this.passives.has("Confused")) {
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
      topology: this.passives.has("Orthogonal") ? 4 : 8,
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
        if (this.passives.has("Enfeebling strikes") && d6() >= 6) {
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
    log(this.name + " is hurt by burning!", "#FF4500");
    if (this.lives <= 0) {
      log(this.name + " is slain by burning!", "#FF4500");
      this.die();
    }
  }

  tempTick() {
    if (this.passives.has("On fire")) {
      this.burn();
    }
    for (let key in this.tempEffects) {
      this.tempEffects[key] -= 1;
      if (this.tempEffects[key] <= 0) {
        if (key == "Hasted" || key == "Slowed") {
          this.speed = this.defaultSpeed;
        }
        delete this.tempEffects[key];
        this.passives.delete(key);
        log(this.name + " is no longer affected by " + key, "SkyBlue");
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
    passives = new Set(["Orthogonal", "Mighty strikes"])
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
    passives = new Set()
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
    passives = new Set(["Mighty strikes"])
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
    passives = new Set(["Enfeebling strikes"])
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
    name = "mosquito",
    toHit = 2,
    speed = 3,
    passives = new Set(["Blood draining"])
  ) {
    super(x, y, emoji, maxLives, name, toHit, speed, passives);
  }
}

class Dragon extends Enemy {
  constructor(
    x,
    y,
    emoji = "🐉",
    maxLives = 1,
    name = "dragon",
    toHit = 4,
    speed = 2,
    passives = new Set(["Mighty strikes"])
  ) {
    super(
      x,
      y,
      emoji,
      Math.min(64, maxLives + dungeonLevel),
      name,
      toHit,
      speed + Math.min(6, Math.floor(dungeonLevel / 10)),
      passives
    );
  }
}

const dungeonEnemies = [Goblin, GridBug, Ogre];

function nextLevel() {
  dungeonLevel += 1;
  score += 1000;
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
  populateItems(dungeonLevel);
  populateHoles(dungeonLevel);
  if (dungeonLevel % ASCEND_LEVEL === 0) {
    log(player.name + " senses a gate home", "gold");
    placeGate();
  }
  if (dungeonLevel % (ASCEND_LEVEL / 4) === 0 && dungeonLevel >= ASCEND_LEVEL) {
    log(player.name + " senses their ultimate goal", "gold");
    placeTrophy();
  }
  const goblins = [];
  const baseMonsters = 10;
  const levelModifier = Math.floor((dungeonLevel - 1) / 5);
  const maxModifier = Math.floor((dungeonLevel - 1) / 3) * 3;
  const numberOfMonsters =
    baseMonsters + levelModifier + Math.floor((d6() / 6) * maxModifier);
  for (let i = 0; i < numberOfMonsters; i++) {
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
function extraHealing(eater, value = 4) {
  if (
    eater.lives >= eater.maxLives &&
    eater.maxLives < LIVES_CAP &&
    d6() > eater.maxLives
  ) {
    eater.lives += 1;
    eater.maxLives += 1;
    log(eater.name + " feels tougher!", "#7FFF00");
  } else {
    eater.lives += value;
    if (eater.lives > eater.maxLives) {
      eater.lives = eater.maxLives;
    }
    log(eater.name + " feels much better!", "#7FFF00");
  }
}
function poison(eater) {
  if (eater.passives.has("Coat quills")) {
    eater.passives.add("Poison quills");
    const duration = 6;
    eater.tempEffects["Poison quills"] = duration;
    log(
      eater.name + "'s quills are coated in poison for " + duration + " turns!",
      "brown"
    );
    return;
  }
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
  if (eater.passives.has("Hasted")) {
    log(eater.name + " is even faster!", "#00FFFF");
    eater.speed = 5;
    return;
  }
  if (eater.passives.has("Slowed")) {
    eater.passives.delete("Slowed");
    eater.tempEffects.delete("Slowed");
    log(eater.name + " is no longer slow!", "#00FFFF");
    eater.speed = eater.defaultSpeed;
    return;
  }
  eater.passives.add("Hasted");
  const duration = d6() + d6() + 6;
  eater.speed = 4;
  eater.tempEffects["Hasted"] = duration;
  log(eater.name + " is fast for " + duration + " turns!", "#00FFFF");
}
function might(eater) {
  eater.passives.add("Mighty");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Mighty"] = duration;
  log(eater.name + " is powerful for " + duration + " turns!", "#00BFFF");
}
function confusion(eater) {
  if (eater.passives.has("Coat quills")) {
    eater.passives.add("Confusing quills");
    const duration = 6;
    eater.tempEffects["Confusing quills"] = duration;
    log(
      eater.name +
        "'s quills are coated in a confusing toxin for " +
        duration +
        " turns!",
      "brown"
    );
    return;
  }
  eater.passives.add("Confused");
  const duration = d6() + 6;
  eater.tempEffects["Confused"] = duration;
  log(eater.name + " is confused for " + duration + " turns!", "#FF00FF");
}
function flying(eater) {
  eater.passives.add("Flying");
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
        eater.passives.add("Keen Eyes");
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
        eater.passives.add("Thick skin");
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
        eater.passives.add("Innacuracy");
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
        eater.passives.add("Soft skin");
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
  if (eater.passives.has("Coat quills")) {
    eater.passives.add("Slowing quills");
    const duration = 6;
    eater.tempEffects["Slowing quills"] = duration;
    log(
      eater.name +
        "'s quills are coated in a slowing toxin for " +
        duration +
        " turns!",
      "brown"
    );
    return;
  }
  if (eater.passives.has("Slowed")) {
    log(eater.name + " can't get any slower!", "#00FFFF");
    return;
  }
  if (eater.passives.has("Hasted")) {
    eater.passives.delete("Hasted");
    delete eater.tempEffects["Hasted"];
    log(eater.name + " is no longer hasted!", "#00FFFF");
    eater.speed = eater.defaultSpeed;
    return;
  }
  eater.passives.add("Slowed");
  const duration = d6() + d6() + 6;
  eater.speed = 1;
  eater.tempEffects["Slowed"] = duration;
  log(eater.name + " is slow for " + duration + " turns!", "#00FFFF");
}
function invunlerability(eater) {
  eater.passives.add("Invulnerable");
  const duration = d6() + d6() + 6;
  eater.tempEffects["Invulnerable"] = duration;
  log(
    eater.name + " becomes invulnerable for " + duration + " turns!",
    "#00BFFF"
  );
}
function weakness(eater) {
  eater.passives.add("Weak");
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
  if (eater.tempEffects.size === 0) {
    if (eater.passives.size > 0) {
      const nonPermanentPassives = Array.from(eater.passives).filter(
        (passive) => passive !== "TwoWeapon" && passive !== "PlusOne"
      );
      if (nonPermanentPassives.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * nonPermanentPassives.length
        );
        const removedPassive = nonPermanentPassives[randomIndex];
        eater.passives.delete(removedPassive);
        log(eater.name + " loses the passive: " + removedPassive, "#9932CC");
        return;
      }
    }
  } else {
    eater.tempEffects.forEach((value, effect) => {
      eater.tempEffects.delete(effect);
      eater.passives.delete(effect);
    });
    log(eater.name + "'s temporary effects are cancelled!", "#9932CC");
    return;
  }
  log(eater.name + " is cancelled, but loses nothing", "#9932CC");
}
function sleeping(eater) {
  eater.passives.add("Asleep");
  const duration = d6() + 3;
  eater.tempEffects["Asleep"] = duration;
  log(eater.name + " falls asleep for " + duration + " turns!", "#AFEEEE");
}
function fire(eater) {
  eater.passives.add("On fire");
  const duration = Infinity;
  eater.tempEffects["On fire"] = duration;
  log(eater.name + " is on fire until they pass their turn!", "#FF4500");
}
function luck(eater) {
  if ("luck" in eater) {
    if (eater.luck >= eater.maxLuck && d6() <= 4 && eater.maxLuck < LUCK_CAP) {
      eater.luck += 1;
      eater.maxLuck += 1;
      log(eater.name + " feels luckier!", "#7FFF00");
    } else {
      eater.luck = eater.maxLuck;
      log(eater.name + "'s luck is refilled!", "#7FFF00");
    }
  } else {
    eater.passives.add("Luck");
    log(eater.name + " feels luckier!", "#7FFF00");
  }
}

function eat(eater, fruit) {
  if (eatFruit[fruit]) {
    eatFruit[fruit](eater);
    if (
      fruitNames[fruit] &&
      effectNames[fruit] &&
      !fruitNames[fruit].includes("(")
    ) {
      fruitNames[fruit] += " (" + effectNames[fruit] + ")";
    }
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
    passives = new Set(["Bone chewer"]),
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
    this.name = name;
    this.toHit = toHit;
    this.ground = "⬛️";
    this.wield = "";
    this.wear = "";
    this.inventory = inventory;
    this.passives = passives;
    this.tempEffects = new Map();
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
        this.passives.add(this.levelBenefits[2]);
        if (!this.passives.has(this.levelBenefits[1])) {
          this.passives.add(this.levelBenefits[1]);
        }
        if (!this.passives.has(this.levelBenefits[0])) {
          this.passives.add(this.levelBenefits[0]);
        }
      } else if (this.beasthood >= TO_LEVEL_3 && this.level < 3) {
        log(this.name + " advances to level 3!", "#FF69B4");
        this.level = 3;
        this.passives.add(this.levelBenefits[1]);
        if (!this.passives.has(this.levelBenefits[0])) {
          this.passives.add(this.levelBenefits[0]);
        }
      } else if (this.beasthood >= TO_LEVEL_2 && this.level < 2) {
        log(this.name + " advances to level 2!", "#FF69B4");
        this.level = 2;
        this.passives.add(this.levelBenefits[0]);
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
        this.passives.delete(this.levelBenefits[0]);
        this.passives.delete(this.levelBenefits[1]);
        this.passives.delete(this.levelBenefits[2]);
      } else if (this.beasthood < TO_LEVEL_3 && this.level > 2) {
        log(this.name + " regresses to level 2!", "#FF7F50");
        this.level = 2;
        this.passives.delete(this.levelBenefits[1]);
        this.passives.delete(this.levelBenefits[2]);
      } else if (this.beasthood < TO_LEVEL_4 && this.level > 3) {
        log(this.name + " regresses to level 3!", "#FF7F50");
        this.level = 3;
        this.passives.delete(this.levelBenefits[2]);
      }
    }
  }

  beHit(enemy) {
    this.incombat = true;
    this.combat_timer = COMBAT_TIME;
    if (this.passives.has("Invulnerable")) {
      log(this.name + " shrugs off the " + enemy.name + "'s attack", "#B0C4DE");
      return;
    }
    let rollValue = attackCalculation(enemy, this);
    this.beasthoodUp(1);
    if (rollValue >= this.toHit) {
      const damage = damageCalculation(enemy, this);
      this.lives -= damage;
      if (damage >= 2) {
        log(
          `The ${enemy.name} deals ${damage} damage to ${this.name}!`,
          "#E5DE00"
        );
      } else {
        log("The " + enemy.name + " hits " + this.name + "!", "#E5DE00");
      }
      if (this.lives == 1) {
        log(`${this.name} is on their last breath!`, "#8B0000");
      }
      if (this.lives <= 0) {
        this.die();
      }
      if (enemy.passives.has("Blood draining")) {
        log(`${enemy.name} drains ${this.name}'s blood!`, "red");
        extraHealing(enemy, 1);
      }
      document.querySelector(".App").classList.add("shake");
      setTimeout(() => {
        document.querySelector(".App").classList.remove("shake");
      }, 200);
    } else {
      log("The " + enemy.name + " misses " + this.name + "!", "#FFA500");
    }
    if (this.passives.has("Prickly") && d6() > 3) {
      log("The " + enemy.name + " is pricked!", "brown");
      if (enemy.lives > 0) {
        enemy.lives -= 1;
        if (this.passives.has("Poison quills")) poison(enemy);
        if (this.passives.has("Confusing quills")) confusion(enemy);
        if (this.passives.has("Slowing quills")) slowing(enemy);
        if (enemy.lives <= 0) {
          enemy.die();
        }
      }
    }
  }

  burn() {
    this.incombat = true;
    this.combat_timer = COMBAT_TIME;
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
    if (this.passives.has("Many lives")) {
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
    addScoreToLeaderboard(this.name, score);
  }

  win() {
    if (!won) {
      engine.lock();
      score += dungeonLevel * 1000;
      log(
        this.name +
          " takes the treasure home and finally becomes a true champion!",
        "white"
      );
      log(
        "Congratulations! You and " +
          this.name +
          " have defeated the Labyrinth together! You win!",
        "gold"
      );
      addScoreToLeaderboard(this.name, score);
      won = true;
    }
  }

  useGround() {
    if (this.ground === "🌀") {
      if (!gotTrophy) {
        log(
          this.name +
            " must acquire a trophy before being able to use the warp gate",
          "red"
        );
      } else {
        log(this.name + " steps through the warp gate...", "white");
        this.win();
      }
    }
    if (this.ground === "🏆") {
      log(this.name + " gets a trophy! The ultimate reward!", "gold");
      score += dungeonLevel * 100;
      this.ground = "⬛️";
      if (!gotTrophy) {
        log(
          this.name +
            " can now escape the dungeon through a warp gate to become a true champion, or delve deeper and more greedily!",
          "white"
        );
        gotTrophy = true;
      }
      return true;
    }
    if (this.ground === "🕳️") {
      nextLevel();
      return true;
    }
    if (this.passives.has("Bone chewer") && this.ground === "🦴") {
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

  /*
  "🗡️", // Dagger
  "⚔️", // Double Sword
  "🪚", // Painsaw
  "🏹", // Bow and Arrow
  "🪓", // Axe
  "🔨", // Hammer
  "⛏️", // Pick
  "🎸", // Guitar
  "🔪", // Kitchen Knife
  "🛡️", // Shield
  "🥊", // Glove
  */
  wieldWeapon(item) {
    // Logic to equip the item
    // Example: When equipping a dagger, add the "PlusOne" passive ability
    if (item === "🗡️") {
      log("Dagger equipped", "white");
      this.wield = "🗡️";
      this.passives.add("PlusOne");
      log("You are now attacking at a +1", "cyan");
    }
    if (item === "⚔️") {
      log("Double Sword equipped", "white");
      this.wield = "⚔️";
      this.passives.add("TwoWeapon");
      log("You are innacurate but mighty", "cyan");
    }
    if (item === "🪚") {
      log("Painsaw equipped", "white");
      this.wield = "🪚";
      this.passives.add("Painsaw");
      log("You are now attacking at a +1", "cyan");
    }
    if (item === "🔪") {
      log("Knife equipped", "white");
      this.wield = "🔪";
      this.passives.add("Stabbing");
      log("Move towards foes to make free attacks", "cyan");
    }
    if (item === "⛏️") {
      log("Pickaxe equipped", "white");
      this.wield = "⛏️";
      this.passives.add("Mining");
      log("You can break walls by attacking them", "cyan");
    }
  }

  unwield() {
    // Logic to unequip the item
    // Example: When unequipping a dagger, remove the "PlusOne" passive ability
    if (this.wield === "🗡️") {
      this.passives.delete("PlusOne");
    }
    if (this.wield === "⚔️") {
      this.passives.delete("TwoWeapon");
    }
  }

  act() {
    if (this.passives.has("Asleep")) {
      log(this.name + " is asleep", "red");
    } else {
      engine.lock();
      /* wait for user input; do stuff when user hits a key */
      setTimeout(() => window.addEventListener("keydown", this), 50);
    }
    this.tempTick();
  }

  tempTick() {
    if (!this.incombat) {
      this.lives = Math.min(this.maxLives, this.lives + 1);
      this.luck = Math.min(this.maxLuck, this.luck + 1);
      this.beasthoodDown(1);
    } else {
      this.combat_timer -= 1;
      if (this.combat_timer <= 0) {
        this.incombat = false;
        killStreak = 0;
      }
    }
    for (let key in this.tempEffects) {
      this.tempEffects[key] -= 1;
      if (this.tempEffects[key] <= 0) {
        if (key === "Hasted" || key === "Slowed") {
          this.speed = this.defaultSpeed;
        }
        delete this.tempEffects[key];
        this.passives.delete(key);
        log(this.name + " is no longer affected by " + key, "SkyBlue");
      }
    }
    if (this.passives.has("On fire")) {
      this.burn();
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
      this.passives.has("Sapper") ||
      this.passives.has("Appraise") ||
      this.passives.has("Ultrasonic blast") ||
      this.passives.has("Spin dash")
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
      if (this.passives.has("Ultrasonic blast")) {
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
      if (this.passives.has("Spin dash")) {
        log(this.name + " spins in place!", "gold");
        dashing = true;
        action = true;
      }
      if (this.passives.has("Sapper") && this.ground === "⬛️") {
        log(this.name + " digs a hole!", "gold");
        this.beasthoodDown(Infinity);
        this.ground = "🕳️";
        action = true;
      } else if (this.passives.has("Sapper") && this.ground !== "⬛️") {
        log(this.name + " can't dig if stuff is on the floor", "#F0E68C");
      }
      if (this.passives.has("Appraise")) {
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
        if (!this.passives.has("Fast paws")) {
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
      if (player.passives.has("On fire")) {
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
        if (!this.passives.has("Fast paws")) {
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
        if (!this.passives.has("Fast paws")) {
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
        if (!this.passives.has("Fast paws")) {
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
        if (!this.passives.has("Fast paws")) {
          window.removeEventListener("keydown", this);
          engine.unlock();
        }
        return;
      }
      log(this.name + " has nothing there", "#F0E68C");
      return;
    }
    var confusion = false;
    if (player.passives.has("Confused") && Math.random() < 0.5) {
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
    if (dashing) {
      this.dash(keyMap[code]);
      dashing = false;
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
        this.passives.has("Digger") &&
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
      if (this.passives.has("Pounce")) {
        const pounce_x = this._x + diff[0];
        const pounce_y = this._y + diff[1];
        enemies.forEach((enemy) => {
          if (enemy.x === pounce_x && enemy.y === pounce_y && enemy.lives > 0) {
            log(this.name + " pounces on the " + enemy.name + "!", "gold");
            player.attack(enemy);
            if (enemy.lives > 0) {
              player.attack(enemy);
            }
          }
        });
      }
      engine.unlock();
    }
  }

  attack(enemy) {
    const procRoll = d6();
    if (procRoll >= 6) {
      if (this.passives.has("Pickup") && this.inventory.length < 4) {
        const randomIndex = Math.floor(Math.random() * fruit.length);
        this.inventory.push(fruit[randomIndex]);
        log(
          this.name + " pilfers a " + fruitNames[fruit[randomIndex]] + "!",
          "#00FF00"
        );
      }
    }
    this.incombat = true;
    this.combat_timer = COMBAT_TIME;
    this.beasthoodUp(1);
    enemy.beHit(player);
  }

  dash(direction) {
    let newX = this._x + ROT.DIRS[8][direction][0];
    let newY = this._y + ROT.DIRS[8][direction][1];
    let newKey = newX + "," + newY;
    let hitWall = generatedMap[newKey] === "🟫";
    let hitEnemy = enemies.some(
      (enemy) => enemy.x === newX && enemy.y === newY && enemy.lives > 0
    );

    // Continue dashing until a wall or an enemy is encountered
    while (!hitWall && !hitEnemy) {
      // Update the character's position
      generatedMap[this._x + "," + this._y] = this.ground;
      this.ground = generatedMap[newX + "," + newY];
      this._x = newX;
      this._y = newY;

      // Prepare for the next iteration
      newX += ROT.DIRS[8][direction][0];
      newY += ROT.DIRS[8][direction][1];
      newKey = newX + "," + newY;
      hitWall = generatedMap[newKey] === "🟫";
      hitEnemy = enemies.some(
        (enemy) => enemy.x === newX && enemy.y === newY && enemy.lives > 0
      );
    }

    // If an enemy is hit, attack
    if (hitEnemy) {
      const enemy = enemies.find(
        (enemy) => enemy.x === newX && enemy.y === newY
      );
      log(this.name + " dashes into " + enemy.name + " and attacks!", "gold");
      this.attack(enemy);
    } else if (hitWall) {
      log(this.name + " crashes into a wall!", "#EE82EE");
    }

    // Update the character's position on the map
    this._draw();
  }

  throwFruit(fruit, direction, x = this._x, y = this._y, remove = true) {
    var newX = x + ROT.DIRS[8][direction][0];
    var newY = y + ROT.DIRS[8][direction][1];
    var newKey = newX + "," + newY;
    // Remove the thrown fruit from the player's inventory
    const index = this.inventory.indexOf(fruit);
    if (index !== -1 && remove) {
      this.inventory.splice(index, 1);
    }
    let hitEnemy = false;
    enemies.forEach((enemy) => {
      if (enemy.x === newX && enemy.y === newY && enemy.lives > 0) {
        eat(enemy, fruit);
        if (player.passives.has("Confuse throw")) {
          confusion(enemy);
        }
        hitEnemy = true;
        return;
      }
    });
    if (generatedMap[newKey] !== "🟫" && !hitEnemy) {
      return this.throwFruit(fruit, direction, newX, newY, false);
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
      player = new Player(x, y, "🐱", 2, "Mimi", 2, [], new Set(), 3, 7, 0, [
        "Pounce",
        "Luck mastery",
        "Many lives",
      ]);
      break;
    case "🦝":
      player = new Player(
        x,
        y,
        "🦝",
        3,
        "Max",
        3,
        [],
        new Set(["Pickup"]),
        2,
        5,
        0,
        ["Appraise", "Fast paws", "Confuse throw"]
      );
      break;
    case "🐋":
      player = new Player(
        x,
        y,
        "🐋",
        4,
        "Wave",
        4,
        [],
        new Set(["Aquatic"]),
        2,
        4,
        0,
        ["Mighty strikes", "Great defense", "Ultrasonic blast"]
      );
      break;
    case "🦔":
      player = new Player(
        x,
        y,
        "🦔",
        2,
        "Dorian",
        4,
        [],
        new Set(["Prickly"]),
        3,
        3,
        0,
        ["Great defense", "Coat quills", "Spin dash"]
      );
      break;
    default:
      player = new Player(x, y, selectedAnimal, 3);
      break;
  }
}

function populateItems(level = 1) {
  var averageItems = 20 + (level - 1) * (30 / 199);
  averageItems = Math.min(50, averageItems);
  var itemsToPlace = Math.round(averageItems + (d6() - 3.5) * (10 / d6()));
  for (var i = 0; i < itemsToPlace; i++) {
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
  for (var i = 0; i <= Math.max(1, 6 - Math.floor((level - 1) / 10)); i++) {
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

function placeGate() {
  var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
  var key = freeCells.splice(index, 1)[0];
  var parts = key.split(",");
  var x = parseInt(parts[0]);
  var y = parseInt(parts[1]);
  generatedMap[key] = "🌀";
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
  const numberOfDragons = 1 + Math.floor(dungeonLevel / 100);
  for (let i = 0; i < numberOfDragons; i++) {
    const guardian = createBeing(Dragon, true, guardianCells);
    scheduler.add(guardian, true);
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
    if (guardianCells.length > 0) {
      var index = Math.floor(ROT.RNG.getUniform() * guardianCells.length);
      var key = guardianCells.splice(index, 1)[0];
      var parts = key[0].split(",");
      var x = parseInt(parts[0]);
      var y = parseInt(parts[1]);
      return new what(x, y);
    }
  }
}

//LOGIC ENDS HERE. DRAWING STARTS HERE

function App() {
  const [dungeon, setDungeon] = useState({}); // Initialize dungeon state
  const [gameStarted, setGameStarted] = useState(false);
  const [animalSelected, setAnimalSelected] = useState(false);
  const [playerName, setPlayerName] = useState(""); // New state for player's name
  const [nameSubmitted, setNameSubmitted] = useState(false); // New state to check if name is submitted

  const startGame = () => {
    setGameStarted(true);
  };

  const selectAnimal = () => {
    setAnimalSelected(true);
  };

  const renderStartScreen = () => {
    if (!gameStarted) {
      return (
        <div className="startScreen">
          <h1>Beasts of Labyrinth Tactics (BoLT)</h1>
          <p className="versionInfo">Version 1.5.1 Alpha</p>
          <button onClick={startGame}>Game Start</button>
          <p>ATTRIBUTION CREDITS: Enter Command font is made by jeti</p>
          <Leaderboard />
        </div>
      );
    }
    return null; // Return null if game has started
  };

  const Leaderboard = React.memo(() => {
    return (
      <div className="leaderboard">
        <h2>Hall of Champions</h2>
        <ol>
          {leaderboardEntries.map((entry, index) => (
            <li key={index}>
              {entry.name} -{" "}
              <span style={{ fontFamily: "Noto Color Emoji" }}>
                {entry.champion}
              </span>{" "}
              - {entry.score} - {entry.timestamp.toDate().toLocaleString()}
            </li>
          ))}
        </ol>
      </div>
    );
  });

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
        case "🦔":
          return "Hedgehog - Quick and prickly, with the ability to counter attacks.";
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
          <div
            className="animalGridItem"
            onClick={() => {
              selectedAnimal = "🦔";
              selectAnimal();
            }}
          >
            🦔
            <div className="animalInfo">{animalInfo("🦔")}</div>
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
    if (player.maxLives > 4) {
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
            </div>
            <span className="livesText">
              {player.lives}/{player.maxLives}
            </span>
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
        title="Champion beasthood. Attack and be attacked to gain points and go up levels. Champions unlock abilities as they level up. Being out of combat reduces beasthood."
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

  function renderFloorView() {
    return (
      <div className="floorView" title="Your champion's current dungeon level">
        Dungeon L{dungeonLevel}
      </div>
    );
  }

  const submitName = () => {
    // Function to handle name submission and start the game
    initializeGame(); // Assuming initializeGame is a function that sets up the game
    log("Game started!", "#32CD32");
    player.inventory.push(
      Object.keys(eatFruit).find((key) => eatFruit[key] === healing)
    );
    if (playerName.length > 0) {
      player.name = playerName;
    }
    setNameSubmitted(true); // Set nameSubmitted to true to start the game
  };

  const renderNameInputScreen = () => {
    if (animalSelected && !nameSubmitted) {
      return (
        <div className="nameInputScreen">
          <h2>Enter Your Name</h2>
          <input
            type="text"
            maxLength="6"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Name"
          />
          <button onClick={submitName}>Submit</button>
        </div>
      );
    }
    return null;
  };

  function renderScorekeep() {
    return (
      <div
        className="scorekeep"
        title="Scorekeep. Your champion's current score is shown here."
      >
        {score}
      </div>
    );
  }

  const renderLog = () => {
    return (
      <div
        className="log"
        title="Game log. The last few game events are registered here."
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
            {renderFloorView()}
            {renderScorekeep()}
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
      {gameStarted &&
        animalSelected &&
        !nameSubmitted &&
        renderNameInputScreen()}
      {gameStarted && animalSelected && nameSubmitted ? renderGame() : null}
    </div>
  );
}

let leaderboardEntries = [];

async function fetchLeaderboard() {
  const leaderboardRef = collection(db, "leaderboard");
  const q = query(leaderboardRef, orderBy("score", "desc"), limit(30)); // Construct the query with orderBy
  const querySnapshot = await getDocs(q);
  const entries = [];
  querySnapshot.forEach((doc) => {
    entries.push(doc.data());
  });
  leaderboardEntries = entries;
}

fetchLeaderboard();

//STARTING GAME
export default App;
