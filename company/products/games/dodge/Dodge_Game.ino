#include <LiquidCrystal.h>

// LCD pins: RS, E, D4, D5, D6, D7
LiquidCrystal lcd(7, 8, 9, 10, 11, 12);

// Joystick pins
int xPin = A0;
int yPin = A1;
int buttonPin = 2;

// Buzzer pin
int buzzerPin = 6;

// LCD size
const int width = 16;
const int height = 2;

// Player
int playerX = 1;
int playerY = 0;

// Lives
int lives = 1;
const int maxLives = 4;

bool invincible = false;
unsigned long invincibleStartTime = 0;
int invincibleTime = 1200;

// Lasers / bullets
const int maxLasers = 4;

int laserX[maxLasers];
int laserY[maxLasers];
int laserDX[maxLasers];
bool laserActive[maxLasers];

int activeLaserCount = 1;

// Power-up
int powerX = -1;
int powerY = -1;
bool powerActive = false;

// Game state
int score = 0;
bool gameOver = false;

// Timing
unsigned long lastPlayerMoveTime = 0;
unsigned long lastLaserMoveTime = 0;
unsigned long lastLCDUpdateTime = 0;
unsigned long lastMusicTime = 0;

int playerMoveDelay = 220;
int laserMoveDelay = 900;
int lcdUpdateDelay = 150;

// Catchy arcade music
int musicNotes[] = {
  523, 659, 784, 659,
  587, 698, 880, 698,
  659, 784, 988, 784,
  698, 880, 1047, 880
};

int musicDurations[] = {
  90, 90, 120, 90,
  90, 90, 120, 90,
  90, 90, 140, 90,
  90, 90, 180, 90
};

int musicIndex = 0;
int musicDelay = 140;
const int musicLength = 16;

// Custom laser circle
byte laserChar[8] = {
  B00000,
  B01110,
  B11111,
  B11111,
  B11111,
  B01110,
  B00000,
  B00000
};

// Custom power-up star
byte powerChar[8] = {
  B00100,
  B10101,
  B01110,
  B11111,
  B01110,
  B10101,
  B00100,
  B00000
};

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(buzzerPin, OUTPUT);

  lcd.begin(16, 2);
  lcd.createChar(0, laserChar);
  lcd.createChar(1, powerChar);

  randomSeed(analogRead(A5));

  showStartScreen();
}

void loop() {
  if (gameOver) {
    noTone(buzzerPin);
    showGameOver();

    if (digitalRead(buttonPin) == LOW) {
      delay(300);
      resetGame();
    }

    return;
  }

  playMusic();

  if (invincible && millis() - invincibleStartTime > invincibleTime) {
    invincible = false;
  }

  readJoystick();

  if (millis() - lastLaserMoveTime >= laserMoveDelay) {
    moveLasers();
    lastLaserMoveTime = millis();
  }

  if (millis() - lastLCDUpdateTime >= lcdUpdateDelay) {
    drawGame();
    lastLCDUpdateTime = millis();
  }
}

void showStartScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Laser Dodge!");

  lcd.setCursor(0, 1);
  lcd.print("Press joystick");

  while (digitalRead(buttonPin) == HIGH) {
    tone(buzzerPin, 523, 80);
    delay(250);
    tone(buzzerPin, 784, 80);
    delay(250);
  }

  noTone(buzzerPin);
  delay(300);
  resetGame();
}

void resetGame() {
  playerX = 1;
  playerY = 0;

  lives = 1;
  score = 0;
  gameOver = false;
  invincible = false;

  activeLaserCount = 1;
  laserMoveDelay = 900;

  powerActive = false;
  powerX = -1;
  powerY = -1;

  for (int i = 0; i < maxLasers; i++) {
    laserActive[i] = false;
  }

  spawnLaser(0);

  lastLaserMoveTime = millis();
  lastPlayerMoveTime = millis();
  lastLCDUpdateTime = millis();
  lastMusicTime = millis();

  lcd.clear();
  drawGame();
}

void playMusic() {
  if (millis() - lastMusicTime >= musicDelay) {
    tone(buzzerPin, musicNotes[musicIndex], musicDurations[musicIndex]);

    musicIndex++;

    if (musicIndex >= musicLength) {
      musicIndex = 0;
    }

    lastMusicTime = millis();
  }
}

void readJoystick() {
  int xValue = analogRead(xPin);
  int yValue = analogRead(yPin);

  if (millis() - lastPlayerMoveTime >= playerMoveDelay) {
    bool moved = false;

    // Fixed mapping for your joystick

    // Push up
    if (xValue > 650) {
      playerY = 0;
      moved = true;
    }

    // Push down
    else if (xValue < 350) {
      playerY = 1;
      moved = true;
    }

    // Push right
    else if (yValue > 650) {
      playerX++;
      if (playerX >= width) playerX = width - 1;
      moved = true;
    }

    // Push left
    else if (yValue < 350) {
      playerX--;
      if (playerX < 0) playerX = 0;
      moved = true;
    }

    if (moved) {
      tone(buzzerPin, 600, 25);
      lastPlayerMoveTime = millis();
      checkPowerUp();
      checkCollision();
    }
  }
}

void moveLasers() {
  for (int i = 0; i < activeLaserCount; i++) {
    if (!laserActive[i]) {
      spawnLaser(i);
      continue;
    }

    // Move freely after spawning
    laserX[i] += laserDX[i];

    if (laserX[i] == playerX && laserY[i] == playerY) {
      hitPlayer();
      return;
    }

    if (laserX[i] < 0 || laserX[i] >= width) {
      score++;
      tone(buzzerPin, 900, 40);

      updateDifficulty();

      // Power-up appears every 5 points
      if (!powerActive && score > 0 && score % 5 == 0) {
        spawnPowerUp();
      }

      spawnLaser(i);
    }
  }

  checkPowerUp();
}

void hitPlayer() {
  if (invincible) {
    return;
  }

  lives--;

  tone(buzzerPin, 120, 400);

  if (lives <= 0) {
    gameOver = true;
    return;
  }

  invincible = true;
  invincibleStartTime = millis();

  playerX = 1;
  playerY = 0;

  for (int i = 0; i < maxLasers; i++) {
    laserActive[i] = false;
  }

  for (int i = 0; i < activeLaserCount; i++) {
    spawnLaser(i);
  }
}

void spawnLaser(int i) {
  int tries = 0;

  while (tries < 20) {
    int side = random(0, 2);
    int newX;
    int newDX;

    if (side == 0) {
      newX = width - 1;
      newDX = -1;
    } else {
      newX = 0;
      newDX = 1;
    }

    int newY = random(0, 2);

    if (isSafeLaserSpot(newX, newY)) {
      laserX[i] = newX;
      laserY[i] = newY;
      laserDX[i] = newDX;
      laserActive[i] = true;
      return;
    }

    tries++;
  }

  laserActive[i] = false;
}

bool isSafeLaserSpot(int newX, int newY) {
  for (int i = 0; i < activeLaserCount; i++) {
    if (!laserActive[i]) continue;

    // Opposite rows need at least 1 empty column between them.
    // Distance must be 2 or more.
    if (laserY[i] != newY) {
      if (abs(laserX[i] - newX) < 2) {
        return false;
      }
    }

    // Same row bullets should not stack too close.
    if (laserY[i] == newY) {
      if (abs(laserX[i] - newX) < 2) {
        return false;
      }
    }
  }

  return true;
}



void updateDifficulty() {
  int level = score / 1;

  activeLaserCount = 1 + level;

  if (activeLaserCount > maxLasers) {
    activeLaserCount = maxLasers;
  }

  laserMoveDelay = 900 - (level * 60);

  if (laserMoveDelay < 300) {
    laserMoveDelay = 300;
  }

  for (int i = 0; i < activeLaserCount; i++) {
    if (!laserActive[i]) {
      spawnLaser(i);
    }
  }
}

void spawnPowerUp() {
  powerX = random(2, width - 2);
  powerY = random(0, 2);

  if (powerX == playerX && powerY == playerY) {
    powerX = width - 3;
    powerY = 1 - playerY;
  }

  powerActive = true;
}

void checkPowerUp() {
  if (powerActive && playerX == powerX && playerY == powerY) {
    lives = lives + 2;

    if (lives > maxLives) {
      lives = maxLives;
    }

    tone(buzzerPin, 1000, 100);
    delay(80);
    tone(buzzerPin, 1400, 120);

    powerActive = false;
    powerX = -1;
    powerY = -1;
  }
}

void checkCollision() {
  if (invincible) {
    return;
  }

  for (int i = 0; i < activeLaserCount; i++) {
    if (laserActive[i] && laserX[i] == playerX && laserY[i] == playerY) {
      hitPlayer();
      return;
    }
  }
}

void drawGame() {
  lcd.clear();

  for (int y = 0; y < height; y++) {
    lcd.setCursor(0, y);

    for (int x = 0; x < width; x++) {
      bool printed = false;

      if (x == playerX && y == playerY) {
        if (invincible && ((millis() / 200) % 2 == 0)) {
          lcd.print(" ");
        } else {
          lcd.print("A");
        }

        printed = true;
      }

      if (!printed && powerActive && x == powerX && y == powerY) {
        lcd.write(byte(1));
        printed = true;
      }

      for (int i = 0; i < activeLaserCount; i++) {
        if (!printed && laserActive[i] && laserX[i] == x && laserY[i] == y) {
          lcd.write(byte(0));
          printed = true;
        }
      }

      if (!printed) {
        lcd.print(" ");
      }
    }
  }
}

void showGameOver() {
  tone(buzzerPin, 300, 150);
  delay(150);
  tone(buzzerPin, 200, 150);
  delay(150);
  tone(buzzerPin, 100, 300);

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("GAME OVER!");

  lcd.setCursor(0, 1);
  lcd.print("Score:");
  lcd.print(score);
  lcd.print(" Press");

  delay(500);
}