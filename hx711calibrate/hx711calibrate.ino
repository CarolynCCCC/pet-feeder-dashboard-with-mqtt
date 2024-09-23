#include "HX711.h"

const int LOADCELL_DOUT_PIN = 13;
const int LOADCELL_SCK_PIN = 12;
HX711 scale;

//6.85 = bowl weight

void setup() {
  Serial.begin(115200);
  Serial.println("Load cell with esp32");
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.tare();
}

void loop() {
  if(scale.is_ready()){
    Serial.print("HX711 reading: ");
    Serial.println(scale.get_value(5));
  }else{
    Serial.println("HX711 not found.");
  }
  delay(500);
}
