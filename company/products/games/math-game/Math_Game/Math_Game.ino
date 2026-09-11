#include <LiquidCrystal.h>
#include <Keypad.h>

// LCD pins: RS, E, D4, D5, D6, D7
LiquidCrystal lcd(7, 8, 9, 10, 11, 12);

// Buzzer pin
int buzzerPin = 6;

// Keypad setup
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

// Your keypad wiring
byte rowPins[ROWS] = {2, 3, 4, 5};
byte colPins[COLS] = {13, A0, A1, A2};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// Game variables
int num1;
int num2;
int correctAnswer;

String userAnswer = "";

int score = 0;
int totalQuestions = 0;

void setup() {
  pinMode(buzzerPin, OUTPUT);

  lcd.begin(16, 2);

  randomSeed(analogRead(A5));

  showStartScreen();
  startSound();
  delay(1000);

  newQuestion();
}

void loop() {
  char key = keypad.getKey();

  if (key) {
    handleKey(key);
  }
}

void showStartScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Math Game!");
  lcd.setCursor(0, 1);
  lcd.print("Times under 10");
}

void newQuestion() {
  num1 = random(1, 10);   // 1 to 9
  num2 = random(1, 10);   // 1 to 9

  correctAnswer = num1 * num2;
  userAnswer = "";

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(num1);
  lcd.print(" x ");
  lcd.print(num2);
  lcd.print(" = ?");

  lcd.setCursor(0, 1);
  lcd.print("Ans:");
}

void handleKey(char key) {
  // Number keys
  if (key >= '0' && key <= '9') {
    if (userAnswer.length() < 3) {
      userAnswer += key;
      tone(buzzerPin, 700, 30);   // key click sound
      showAnswer();
    }
  }

  // Clear answer
  else if (key == '*') {
    userAnswer = "";
    tone(buzzerPin, 300, 80);
    showAnswer();
  }

  // Enter answer
  else if (key == '#') {
    checkAnswer();
  }

  // A = skip/new question
  else if (key == 'A') {
    tone(buzzerPin, 500, 100);
    newQuestion();
  }
}

void showAnswer() {
  lcd.setCursor(0, 1);
  lcd.print("Ans:            ");

  lcd.setCursor(4, 1);
  lcd.print(userAnswer);
}

void checkAnswer() {
  if (userAnswer.length() == 0) {
    return;
  }

  int answer = userAnswer.toInt();
  totalQuestions++;

  lcd.clear();

  if (answer == correctAnswer) {
    score++;

    lcd.setCursor(0, 0);
    lcd.print("Correct!");

    lcd.setCursor(0, 1);
    lcd.print("Score:");
    lcd.print(score);

    correctSound();
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Wrong!");

    lcd.setCursor(0, 1);
    lcd.print(num1);
    lcd.print("x");
    lcd.print(num2);
    lcd.print("=");
    lcd.print(correctAnswer);

    fartSound();
  }

  delay(1200);

  newQuestion();
}

void startSound() {
  tone(buzzerPin, 523, 100);
  delay(120);
  tone(buzzerPin, 659, 100);
  delay(120);
  tone(buzzerPin, 784, 150);
  delay(180);
  noTone(buzzerPin);
}

void correctSound() {
  // Happy correct sound
  tone(buzzerPin, 523, 100);  // C
  delay(120);
  tone(buzzerPin, 659, 100);  // E
  delay(120);
  tone(buzzerPin, 784, 100);  // G
  delay(120);
  tone(buzzerPin, 1047, 180); // high C
  delay(200);
  noTone(buzzerPin);
}

void fartSound() {
  // Funny fake fart noise
  for (int i = 0; i < 18; i++) {
    int freq = random(70, 160);
    tone(buzzerPin, freq, 35);
    delay(random(25, 55));
  }

  tone(buzzerPin, 90, 180);
  delay(200);

  for (int freq = 130; freq > 60; freq -= 5) {
    tone(buzzerPin, freq, 20);
    delay(25);
  }

  noTone(buzzerPin);
}