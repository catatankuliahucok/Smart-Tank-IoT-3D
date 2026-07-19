import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// Endpoint to generate ESP32 code using Gemini
app.post("/api/generate-esp32", async (req, res) => {
  const {
    wifiConfig,
    mqttConfig,
    hardwareConfig,
    tankConfig,
  } = req.body;

  const prompt = `
Generate a highly polished, production-ready C++ (Arduino IDE) code for ESP32.
The hardware setup consists of:
- ESP32 Microcontroller
- HC-SR04 Ultrasonic Sensor for water level height measurement
- A Relay connected to a Water Pump (Active High or Low, make it configurable or standard active high)

Configuration to embed in the code:
- Wi-Fi SSID: "${wifiConfig?.ssid || "My_WiFi_SSID"}"
- Wi-Fi Password: "${wifiConfig?.pass || "My_WiFi_Password"}"
- MQTT Broker Address: "${mqttConfig?.broker || "broker.emqx.io"}"
- MQTT Broker Port: ${mqttConfig?.port || 1883}
- MQTT Client ID: "${mqttConfig?.clientId || "ESP32_WaterTank"}"
- MQTT Topic Volume (Publish): "${mqttConfig?.topicVolume || "tank/volume"}"
- MQTT Topic Pump Status (Publish/Subscribe): "${mqttConfig?.topicPump || "tank/pump"}"
- MQTT Topic System Status (Publish): "${mqttConfig?.topicStatus || "tank/status"}"
- Ultrasonic TRIG Pin: GPIO ${hardwareConfig?.pinTrig || 5}
- Ultrasonic ECHO Pin: GPIO ${hardwareConfig?.pinEcho || 18}
- Relay Pin: GPIO ${hardwareConfig?.pinRelay || 19}
- Tank Max Volume: ${tankConfig?.maxVolume || 1000} Liters
- Tank Upper Threshold (MAX): ${tankConfig?.highThreshold || 900} Liters
- Tank Lower Threshold (MIN): ${tankConfig?.lowThreshold || 200} Liters

Logic details to implement:
1. Wi-Fi and MQTT connection with automatic reconnection.
2. Read the HC-SR04 sensor distance.
   - Convert distance to volume in Liters (assume a cylinder shape with height. Make height configurable, say 100cm height is empty (0L) and 10cm is full (1000L)).
   - Formula can be: volume = mapped distance from sensor. Let's say: 10cm distance = 1000L, 100cm distance = 0L. Any distance between 10cm and 100cm should be linearly mapped to volume (0L to 1000L).
3. Publish current volume in Liters to "${mqttConfig?.topicVolume || "tank/volume"}" every 2 seconds.
4. Publish current pump status ("ON" or "OFF") to "${mqttConfig?.topicPump || "tank/pump"}" whenever it changes.
5. Subscribe to "${mqttConfig?.topicPump || "tank/pump"}". If a message "ON" or "OFF" is received, trigger the relay accordingly (this allows Manual overrides).
6. Implement the local Hysteresis Safety logic (Otomatis):
   - If the volume drops below MIN (${tankConfig?.lowThreshold || 200}L), turn the pump Relay ON.
   - If the volume rises above MAX (${tankConfig?.highThreshold || 900}L), turn the pump Relay OFF.
7. Send diagnostic information to Serial Monitor.

Format output cleanly as a complete, single block of Arduino C++ code with comprehensive comments explaining the wiring pins and MQTT flow. Avoid any extra chatty text outside the markdown code block.
`;

  try {
    if (!ai) {
      console.warn("GEMINI_API_KEY is not defined. Using high-quality fallback generator.");
      return res.json({ code: getFallbackCode(wifiConfig, mqttConfig, hardwareConfig, tankConfig) });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert embedded systems developer specializing in ESP32 IoT firmware and MQTT applications. Your outputs are clean, compile-ready C++ code block with elegant and robust structure.",
        temperature: 0.2,
      },
    });

    const generatedText = response.text || "";
    // Extract code from markdown block if any, or return raw text
    const codeBlockRegex = /```(?:cpp|arduino)?([\s\S]*?)```/i;
    const match = generatedText.match(codeBlockRegex);
    const code = match ? match[1].trim() : generatedText.trim();

    res.json({ code });
  } catch (error: any) {
    console.error("Gemini Code Generation Error:", error);
    res.status(500).json({
      error: "Failed to generate code via Gemini",
      details: error.message,
      fallback: getFallbackCode(wifiConfig, mqttConfig, hardwareConfig, tankConfig),
    });
  }
});

// Fallback high-quality ESP32 firmware generator code
function getFallbackCode(
  wifiConfig: any,
  mqttConfig: any,
  hardwareConfig: any,
  tankConfig: any
) {
  const ssid = wifiConfig?.ssid || "My_WiFi_SSID";
  const pass = wifiConfig?.pass || "My_WiFi_Password";
  const broker = mqttConfig?.broker || "broker.emqx.io";
  const port = mqttConfig?.port || 1883;
  const clientId = mqttConfig?.clientId || "ESP32_WaterTank";
  const topicVol = mqttConfig?.topicVolume || "tank/volume";
  const topicPump = mqttConfig?.topicPump || "tank/pump";
  const topicStat = mqttConfig?.topicStatus || "tank/status";
  const trig = hardwareConfig?.pinTrig || 5;
  const echo = hardwareConfig?.pinEcho || 18;
  const relay = hardwareConfig?.pinRelay || 19;
  const maxVol = tankConfig?.maxVolume || 1000;
  const highThr = tankConfig?.highThreshold || 900;
  const lowThr = tankConfig?.lowThreshold || 200;

  return `/*
 * Smart Water Tank IoT System - ESP32 Firmware
 * Digital Twin Web Companion Sync Code
 * 
 * Hardware Wiring:
 * 1. HC-SR04 Ultrasonic Sensor:
 *    - VCC  -> 5V or 3.3V (ESP32 Vin or 3V3 depending on module)
 *    - GND  -> GND
 *    - TRIG -> GPIO ${trig}
 *    - ECHO -> GPIO ${echo}
 * 2. 5V Relay Module (Controls Submersible Pump):
 *    - VCC  -> 5V or 3V3
 *    - GND  -> GND
 *    - IN   -> GPIO ${relay}
 * 3. Water Pump:
 *    - Connected via Relay Normally Open (NO) and COM contacts.
 */

#include <WiFi.h>
#include <PubSubClient.h>

// Wi-Fi Configurations
const char* ssid = "${ssid}";
const char* password = "${pass}";

// MQTT Configurations
const char* mqtt_server = "${broker}";
const int mqtt_port = ${port};
const char* client_id = "${clientId}";
const char* topic_volume = "${topicVol}";
const char* topic_pump = "${topicPump}";
const char* topic_status = "${topicStat}";

// Pin Configurations
#define PIN_TRIG  ${trig}
#define PIN_ECHO  ${echo}
#define PIN_RELAY ${relay}

// Tank Dimensions & Logic Settings
const float TANK_MAX_VOLUME = ${maxVol}.0;    // Liters
const float LEVEL_HIGH = ${highThr}.0;         // Liters (Pump OFF threshold)
const float LEVEL_LOW = ${lowThr}.0;          // Liters (Pump ON threshold)

// Ultrasonic Sensor physical thresholds
const float DISTANCE_FULL_CM = 10.0;    // 10cm is considered 100% full (${maxVol}L)
const float DISTANCE_EMPTY_CM = 100.0;  // 100cm is considered empty (0L)

// Global Objects
WiFiClient espClient;
PubSubClient client(espClient);

// Timing variables
unsigned long lastMsgTime = 0;
const long publishInterval = 2000; // publish every 2 seconds

// State Variables
float currentVolume = 0.0;
bool isPumpOn = false;
bool isAutomaticMode = true; // Enabled by default, can be toggled via MQTT if desired

// Function declarations
void setup_wifi();
void callback(char* topic, byte* payload, unsigned int length);
void reconnect();
float measureVolume();
void setPumpState(bool state);

void setup() {
  Serial.begin(115200);
  
  // Set Pin Modes
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_RELAY, OUTPUT);
  
  // Start with pump turned OFF
  setPumpState(false);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsgTime > publishInterval) {
    lastMsgTime = now;

    // 1. Measure water volume in Liters
    currentVolume = measureVolume();
    Serial.printf("Current Water Volume: %.1f L\\n", currentVolume);

    // 2. Local safety hysteresis controller logic (Automatic control)
    if (isAutomaticMode) {
      if (currentVolume <= LEVEL_LOW && !isPumpOn) {
        Serial.println("Water level low. Turning on pump automatically.");
        setPumpState(true);
      } else if (currentVolume >= LEVEL_HIGH && isPumpOn) {
        Serial.println("Water level high. Turning off pump automatically.");
        setPumpState(false);
      }
    }

    // 3. Publish volume level to MQTT
    char volStr[8];
    dtostrf(currentVolume, 1, 1, volStr);
    client.publish(topic_volume, volStr);

    // 4. Publish system status / diagnostics
    String diagJson = "{\\"volume\\":" + String(currentVolume) + 
                      ",\\"pump\\":\\"" + String(isPumpOn ? "ON" : "OFF") + 
                      "\\",\\"mode\\":\\"" + String(isAutomaticMode ? "AUTO" : "MANUAL") + 
                      "\\",\\"signal\\":\\"OK\\"}";
    client.publish(topic_status, diagJson.c_str());
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to SSID: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi Connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived on topic [");
  Serial.print(topic);
  Serial.print("] ");
  
  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }
  Serial.println(messageTemp);

  // If we receive a message on the pump topic
  if (String(topic) == String(topic_pump)) {
    if (messageTemp == "ON" || messageTemp == "on") {
      isAutomaticMode = false; // Override automatic control when manually triggered
      setPumpState(true);
    } else if (messageTemp == "OFF" || messageTemp == "off") {
      isAutomaticMode = false;
      setPumpState(false);
    } else if (messageTemp == "AUTO" || messageTemp == "auto") {
      isAutomaticMode = true;
      Serial.println("Control mode set to AUTOMATIC");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(client_id)) {
      Serial.println("connected");
      
      // Subscribe to pump control topic
      client.subscribe(topic_pump);
      
      // Publish initial connection announcement
      client.publish(topic_status, "{\\"status\\":\\"online\\",\\"device\\":\\"ESP32_WaterTank\\"}");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

float measureVolume() {
  // Trigger HC-SR04 ultrasonic pulse
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  
  // Read duration of ECHO pulse in microseconds
  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout
  if (duration == 0) {
    // Sensor failure or out of range, return previous or safe empty value
    return 0.0;
  }
  
  // Calculate distance in cm (Speed of sound = ~340m/s -> 29.1 ms/cm)
  float distanceCm = (duration / 2.0) / 29.1;
  
  // Constrain distance to physical range
  if (distanceCm < DISTANCE_FULL_CM) distanceCm = DISTANCE_FULL_CM;
  if (distanceCm > DISTANCE_EMPTY_CM) distanceCm = DISTANCE_EMPTY_CM;
  
  // Map distance to Volume (linear mapping)
  // DISTANCE_FULL_CM (10cm) -> TANK_MAX_VOLUME (${maxVol}L)
  // DISTANCE_EMPTY_CM (100cm) -> 0.0L
  float factor = (DISTANCE_EMPTY_CM - distanceCm) / (DISTANCE_EMPTY_CM - DISTANCE_FULL_CM);
  float volume = factor * TANK_MAX_VOLUME;
  
  return volume;
}

void setPumpState(bool state) {
  isPumpOn = state;
  // If active high, state = true turns ON the relay
  digitalWrite(PIN_RELAY, state ? HIGH : LOW);
  
  // Publish updated status to MQTT if client connected
  if (client.connected()) {
    client.publish(topic_pump, state ? "ON" : "OFF");
  }
  
  Serial.printf("Pump state updated: %s\\n", state ? "ON" : "OFF");
}
`;
}

// Vite and Static serving setups
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
