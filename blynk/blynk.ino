#define BLYNK_TEMPLATE_ID "TMPL6nzfqMilE"
#define BLYNK_TEMPLATE_NAME "IOT ASG"
#define BLYNK_AUTH_TOKEN "iZ2PtUzaHi1QhRCuzo8swxTuoorWPioO"
#define BLYNK_PRINT Serial
#define DHT_TYPE DHT11
#define DHT_PIN 21

// Firebase details
#define API_KEY "AIzaSyDqQnnyfqtBZWIzv_E3_FvvbjpnUu4JU_w"
#define DATABASE_URL "https://iotfirebase-69ec6-default-rtdb.firebaseio.com/"
#define USERNAME "carolynchai1998@gmail.com"
#define PWD "jesusloveme"

// Ultrasonic sensor and feeder parameters

// ------- for relay control
#define ULTRASONIC_TRIG_PIN_WATER 25
#define ULTRASONIC_ECHO_PIN_WATER 26
#define BOTTLE_DEPTH_CM 17


// ------- for food percentage
#define ULTRASONIC_TRIG_PIN_FOOD 23
#define ULTRASONIC_ECHO_PIN_FOOD 22
#define FEEDER_DEPTH_CM 10  // Depth of the feeder in cm
#define LED_PIN 2            // LED for low food alert



#include <ESP32Servo.h>
#include "HX711.h"
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <DHT.h>

static const int ledPin = 2;

char blynkAuth[] = BLYNK_AUTH_TOKEN; 
// char ssid[] = "susumoomoo"; 
// char pass[] = "qqm00d4rc1toj";
char ssid[] = "B100M"; 
char pass[] = "12345678"; 
// char ssid[] = "V2025"; 
// char pass[] = "12345678";  
unsigned long blynkPrevMillis = 0;
const long blynkInterval = 1000; 

// Load cell pins
const int LOADCELL_DOUT_PIN = 13;
const int LOADCELL_SCK_PIN = 12;
HX711 scale;
float currentWeight = 0;

// Servo motor
static const int servoPin = 18;
Servo servo1;

// Relay pin for water pump
const int RELAY_PIN = 4;

// Firebase object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
unsigned long sendDataPrevMillis = 0;
const long firebaseInterval = 60000;
int count = 0;
bool signupOK = false;

const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 25200;
const int daylightOffset_sec = 3600; 
int startTimeInSec = -100;

// Variables for ultrasonic sensor
float duration_us, distance_cm, food_fullness_cm, water_fullness_cm;
float food_fullness_percentage, water_fullness_percentage;

// Time management
unsigned long previousMillis = 0;
unsigned long interval = 5000;  // Set to 5 seconds

// temp and hum
DHT dht(DHT_PIN, DHT_TYPE);
float temperature = 0.0;
float humidity = 0.0;
unsigned long lastDHTReadMillis = 0;
unsigned long dhtInterval = 10000;

// feed counter 
int counter = 0;

// Notification
const float notFull = 20;
unsigned long lastNotificationMillis = 0;
const long notificationInterval = 3600000;
bool initialSent = false;

// loop counter
int loopcounter = 0;

// water ultra
unsigned long lastWaterRead = 0;
const long waterReadInterval = 1000;

String getCurrentPath() {
  // Get current time and format as yymmdd/hour/minute
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return "";
  }

  char dateStr[10], hourStr[3], minuteStr[3];
  strftime(dateStr, sizeof(dateStr), "%y%m%d", &timeinfo);
  strftime(hourStr, sizeof(hourStr), "%H", &timeinfo);
  strftime(minuteStr, sizeof(minuteStr), "%M", &timeinfo);

  // Create the path in the format yymmdd/hour/minute
  String path = "/" + String(dateStr) + "/" + String(hourStr) + "/" + String(minuteStr);
  return path;
}

int getCurrentTimeInSeconds() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return -1;
  }

  int seconds = timeinfo.tm_hour * 3600 + timeinfo.tm_min * 60;
  return seconds;
}

void setup_wifi(){
  delay(10);
  WiFi.begin(ssid, pass);
  while(WiFi.status() != WL_CONNECTED){
    Serial.println("WiFi reconnecting...");
    delay(500);
  }
  Serial.println("WiFi connected.");
}

void setup() {
  Serial.begin(115200);
  //timeClient.begin();
  // WiFi and Firebase initialization
  setup_wifi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
  }
  
  initialiseFirebase();

  // Blynk initialization
  Blynk.begin(blynkAuth, ssid, pass);

  // Initialize ultrasonic, servo, load cell, and relay
  pinMode(ULTRASONIC_TRIG_PIN_WATER, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN_WATER, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); 

  pinMode(ULTRASONIC_TRIG_PIN_FOOD, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN_FOOD, INPUT);
  pinMode(LED_PIN, OUTPUT);

  // load cell
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(1497);
  scale.tare();

  servo1.attach(servoPin);
  servo1.write(0);  // Servo starts at 0 degrees

  // dht
  dht.begin();
}


void getCurrentTime(){
  int currentTimeInSec = getCurrentTimeInSeconds();
  if (currentTimeInSec == startTimeInSec && counter == 0) {
    Serial.println("timematch");
    moveServo();
    counter++;
  }else if (currentTimeInSec != startTimeInSec) {
    counter = 0;
  }
}

void loop() {
  Blynk.run();  // Keeps Blynk connection alive

  unsigned long currentMillis = millis();

  // Corrected Blynk Timer Update Condition
  if (currentMillis - blynkPrevMillis >= blynkInterval) {
    getCurrentTime();
    blynkPrevMillis = currentMillis;
  }

  if(currentMillis - lastWaterRead >= waterReadInterval){
    readWater();
    controlRelay();
    lastWaterRead = currentMillis;
  }

  // Firebase updates based on interval
  if (currentMillis - sendDataPrevMillis >= firebaseInterval) {
    sendSomethingtoFB();  // Send data to Firebase
    sendDataPrevMillis = currentMillis;
  }

  // DHT sensor readings every dhtInterval
  if (currentMillis - lastDHTReadMillis >= dhtInterval) {
    readDHT();  // Read temperature and humidity from DHT sensor
    readUltrasonic();
    readWeight();
    
    sendDataToBlynk();
    if (loopcounter != 0){
      if(food_fullness_percentage < notFull){
        sendNotification();
      }
    }
    lastDHTReadMillis = currentMillis;
  }
  loopcounter++;
}

void readWeight() {
  currentWeight = scale.get_units(10);
  Serial.println(currentWeight);
  scale.power_down();
  delay(1000);
  scale.power_up();
}

void controlRelay(){
  if (water_fullness_percentage < 50) { 
      digitalWrite(RELAY_PIN, LOW);  
      Serial.println("Water pump is ON");
  } else {
      digitalWrite(RELAY_PIN, HIGH); // Turn relay off
      Serial.println("Water pump is OFF");
  }
}

void initialiseFirebase(){
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if(Firebase.signUp(&config, &auth, "", "")){
    Serial.println("ok");
    signupOK = true;
  }
  else{
    Serial.printf("%s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

BLYNK_WRITE(V1) {
  int buttonState = param.asInt();
  if (buttonState == 1) {
    moveServo();  // Move servo to dispense food
  }
}

BLYNK_WRITE(V0) {
  startTimeInSec = param[0].asInt();

  // Optionally handle other parameters if needed
  Serial.print("Start time in sec: "); Serial.println(startTimeInSec);
  Serial.print("Stop time in sec: "); Serial.println(param[1].asInt());
  Serial.print("Timezone: "); Serial.println(param[2].asStr());
  Serial.print("Day of week: "); Serial.println(param[3].asInt());
  Serial.print("Time zone offset from UTC: "); Serial.println(param[4].asInt());
}


void sendDataToBlynk() {
  Blynk.virtualWrite(V2, food_fullness_percentage);
  Blynk.virtualWrite(V4, temperature);
  Blynk.virtualWrite(V5, humidity);
}

// BLYNK_WRITE(V4) {
//   int pumpState = param.asInt();  // Read the value from virtual pin V4
//   if (pumpState == 1) {
//     digitalWrite(RELAY_PIN, LOW);   // Activate the relay (pump ON)
//     Serial.println("Water pump ON");
//   } else {
//     digitalWrite(RELAY_PIN, HIGH);  // Deactivate the relay (pump OFF)
//     Serial.println("Water pump OFF");
//   }
// }

// Function to move the servo
void moveServo() {
  servo1.write(45);  // Move to 45 degrees
  delay(1000);  // Wait for a second
  servo1.write(0);  // Move to 
  Serial.println("Servo moved to 90 degrees, then 45 degrees");
}

// Function to read ultrasonic sensor
void readUltrasonic() {
  // food read
  digitalWrite(ULTRASONIC_TRIG_PIN_FOOD, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN_FOOD, LOW);

  // Measure the duration of the echo
  duration_us = pulseIn(ULTRASONIC_ECHO_PIN_FOOD, HIGH);
  distance_cm = duration_us * 0.017;
  food_fullness_cm = FEEDER_DEPTH_CM - distance_cm;

  if (food_fullness_cm < 0) food_fullness_cm= 0;
  if (food_fullness_cm > FEEDER_DEPTH_CM) food_fullness_cm = FEEDER_DEPTH_CM;
  food_fullness_percentage = (food_fullness_cm / FEEDER_DEPTH_CM) * 100;

  // Display the distance and fullness percentage on the Serial Monitor
  Serial.print("Distance from sensor: ");
  Serial.print(distance_cm);
  Serial.println(" cm");

  Serial.print("Feeder fullness: ");
  Serial.print(food_fullness_percentage);
  Serial.println("%");

  if (food_fullness_percentage < 20){
    digitalWrite(LED_PIN, HIGH);  // Turn LED on
  } else {
    digitalWrite(LED_PIN, LOW);   // Turn LED off
  }
}

void readWater(){
    // water read
  digitalWrite(ULTRASONIC_TRIG_PIN_WATER, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN_WATER, LOW);

  // Measure the duration of the echo
  duration_us = pulseIn(ULTRASONIC_ECHO_PIN_WATER, HIGH);
  distance_cm = duration_us * 0.017;
  water_fullness_cm = BOTTLE_DEPTH_CM - distance_cm;

  if (water_fullness_cm < 0) water_fullness_cm = 0;
  if (water_fullness_cm > BOTTLE_DEPTH_CM) water_fullness_cm = BOTTLE_DEPTH_CM;
  water_fullness_percentage = (water_fullness_cm / BOTTLE_DEPTH_CM) * 100;

  // Display the distance and fullness percentage on the Serial Monitor
  Serial.print("Distance from water: ");
  Serial.print(distance_cm);
  Serial.println(" cm");

  Serial.print("Bottle fullness: ");
  Serial.print(water_fullness_percentage);
  Serial.println("%");
}

void sendSomethingtoFB() {
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 20000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    
    String basePath = getCurrentPath();  // Function to generate yymmdd/hour/minute path

    sendToFirebase(basePath);

    String currentPath = "current";
    sendToFirebase(currentPath);  // Always send latest values to 'current' path
  }
}


void sendToFirebase(String basePath) {
  // Send distance from ultrasonic sensor
  String distancePath = basePath + "/distance";
  if (Firebase.RTDB.setFloat(&fbdo, distancePath.c_str(), distance_cm)) {
    Serial.println("Distance sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send distance to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  // Send load cell reading (weight)
  String weightPath = basePath + "/weight";
  if (Firebase.RTDB.setFloat(&fbdo, weightPath.c_str(), currentWeight)) {
    Serial.println("Weight sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send weight to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  // Send water pump status
  bool pumpStatus = digitalRead(RELAY_PIN);  // Read relay status (HIGH or LOW)
  String pumpPath = basePath + "/pump_status";
  if (Firebase.RTDB.setString(&fbdo, pumpPath.c_str(), pumpStatus ? "ON" : "OFF")) {
    Serial.println("Pump status sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send pump status to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  // Send fullness percentage (calculated in `readUltrasonic`)
  String foodFullnessPath = basePath + "/food_fullness_percentage";
  if (Firebase.RTDB.setFloat(&fbdo, foodFullnessPath.c_str(), food_fullness_percentage)) {
    Serial.println("Food Fullness percentage sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send food fullness percentage to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  String waterFullnessPath = basePath + "/water_fullness_percentage";
  if (Firebase.RTDB.setFloat(&fbdo, waterFullnessPath.c_str(), water_fullness_percentage)) {
    Serial.println("Bottle Fullness percentage sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send water fullness percentage to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  String tempPath = basePath + "/temperature";
  String humPath = basePath + "/humidity";
  
  if (Firebase.RTDB.setFloat(&fbdo, tempPath.c_str(), temperature)) {
    Serial.println("Temperature sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send temperature to " + basePath);
    Serial.println(fbdo.errorReason());
  }

  if (Firebase.RTDB.setFloat(&fbdo, humPath.c_str(), humidity)) {
    Serial.println("Humidity sent successfully to " + basePath);
  } else {
    Serial.println("Failed to send humidity to " + basePath);
    Serial.println(fbdo.errorReason());
  }
}

void readDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  float f = dht.readTemperature(true);
  
  if (isnan(h) || isnan(t) || isnan(f)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    return;
  } else {
    Serial.println(F("Success reading from DHT sensor!"));
  }

  humidity = h;
  temperature = t;

  float hif = dht.computeHeatIndex(f, h);
  float hic = dht.computeHeatIndex(t, h, false);
 
  Serial.print(F("Humidity: "));
  Serial.print(h);
  Serial.print(F("% Temperature: "));
  Serial.print(t);
  Serial.print(F("°C "));
  Serial.print(f);
  Serial.print(F("°F Heat index: "));
  Serial.print(hic);
  Serial.print(F("C "));
  Serial.print(hif);
  Serial.println(F("°F"));
}

void sendNotification() {
  Blynk.logEvent("food_low");
  Serial.println("Notification sent to Blynk: Food fullness is low.");
}
