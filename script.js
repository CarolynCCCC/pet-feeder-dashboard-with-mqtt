const firebaseConfig = {
    apiKey: "AIzaSyDqQnnyfqtBZWIzv_E3_FvvbjpnUu4JU_w",
    authDomain: "iotfirebase-69ec6.firebaseapp.com",
    databaseURL: "https://iotfirebase-69ec6-default-rtdb.firebaseio.com",
    projectId: "iotfirebase-69ec6",
    storageBucket: "iotfirebase-69ec6.appspot.com",
    messagingSenderId: "35307327120",
    appId: "1:35307327120:web:81f7323cf8fe1334ddd215",
    measurementId: "G-MQYY16M3P1"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const mqttBroker = 'wss://test.mosquitto.org:8081';
const clientId = '01c0f074-fd84-47e6-8f57-de6dcf674ca3';
const client = mqtt.connect(mqttBroker, { clientId });


function resizeCanvases() {
    const foodCanvas = document.getElementById('food-gauge');
    const waterCanvas = document.getElementById('water-gauge');
    foodCanvas.width = foodCanvas.clientWidth;
    foodCanvas.height = foodCanvas.clientHeight;
    waterCanvas.width = waterCanvas.clientWidth;
    waterCanvas.height = waterCanvas.clientHeight;
}

function drawGauge(canvas, value, maxValue, gaugeColor) {
    const ctx = canvas.getContext('2d');
    const radius = Math.min(canvas.width, canvas.height) / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const startAngle = Math.PI;
    const endAngle = Math.PI * 2;
    const percentage = value / maxValue;
    const angle = startAngle + (endAngle - startAngle) * percentage;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 10, startAngle, endAngle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 10, startAngle, angle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = gaugeColor;
    ctx.stroke();
}

function fetchCurrentData() {
    // Connect to MQTT broker
    client.on('connect', () => {
        console.log('Connected to MQTT broker');

        // Subscribe to all necessary topics
        const topics = [
            'BAIT2123_IOT_PET_FEEDER/weight',
            'BAIT2123_IOT_PET_FEEDER/food_fullness_percentage',
            'BAIT2123_IOT_PET_FEEDER/temperature',
            'BAIT2123_IOT_PET_FEEDER/humidity',
            'BAIT2123_IOT_PET_FEEDER/water_fullness'
        ];

        topics.forEach(topic => {
            client.subscribe(topic, (err) => {
                if (err) console.error(`Subscription error for topic ${topic}: `, err);
            });
        });
    });

    // Handle incoming messages
    client.on('message', (topic, message) => {
        const value = parseFloat(message.toString()).toFixed(2); // Ensure two decimal places

        console.log(`Received from ${topic}: ${value}`);

        // Update respective elements based on the topic
        switch (topic) {
            case 'BAIT2123_IOT_PET_FEEDER/weight':
                document.getElementById('current-weight').innerText = `${value} g` || 0;
                break;
            case 'BAIT2123_IOT_PET_FEEDER/food_fullness_percentage':
                document.getElementById('food-value').innerText =`${value}%` || 0;
                updateGauge('food-gauge', value);
                break;
            case 'BAIT2123_IOT_PET_FEEDER/temperature':
                document.getElementById('current-temperature').innerText = `${value}°C` || 0;
                break;
            case 'BAIT2123_IOT_PET_FEEDER/humidity':
                document.getElementById('current-humidity').innerText = `${value}%` || 0;
                break;
            case 'BAIT2123_IOT_PET_FEEDER/water_fullness':
                document.getElementById('water-value').innerText = `${value}%` || 0;
                updateGauge('water-gauge', value); // Update gauge dynamically
                break;
        }
    });

    // Error handling for the client
    client.on('error', (error) => {
        console.error('Connection error: ', error);
    });
}

// Function to update the gauge value
function updateGauge(gaugeId, value) {
    const gauge = document.getElementById(gaugeId);
    if (gauge) {
        drawGauge(gauge, parseFloat(value), 100, gaugeId === 'food-gauge' ? '#4caf50' : '#2196f3');
    }
}


function fetchHistoricalData() {
    const dateInput = document.getElementById('date-select').value;
    if (dateInput) {
        const formattedDate = dateInput.slice(2).replace(/-/g, '');
        const historicalRef = database.ref(formattedDate);

        historicalRef.once('value', (snapshot) => {
            const data = snapshot.val();
            console.log(data);
            if (data) {
                const allEntries = [];

                for (let hour = 0; hour < 24; hour++) {
                    const hourString = hour.toString().padStart(2, '0');
                    if (data[hourString]) {
                        const hourData = data[hourString];
                        for (let minute = 0; minute < 60; minute++) {
                            const minuteString = minute.toString().padStart(2, '0');
                            if (hourData[minuteString]) {
                                const entry = hourData[minuteString];
                                allEntries.push({
                                    time: `${hourString}:${minuteString}`,
                                    food_fullness_percentage: entry.food_fullness_percentage,
                                    temperature: entry.temperature,
                                    humidity: entry.humidity,
                                    weight: entry.weight
                                });
                            }
                        }
                    }
                }

                updateHistoricalChart(allEntries);
            } else {
                alert('No data available for the selected date');
            }
        });
    } else {
        alert('Please select a date.');
    }
}

const ctxFood = document.getElementById('foodChart').getContext('2d');
const foodChart = new Chart(ctxFood, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Food Fullness (%)',
            data: [],
            borderColor: '#4caf50',
            fill: false,
            pointRadius: 0,
            spanGaps: true
        }]
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'hour',
                    tooltipFormat: 'HH:mm',
                    displayFormats: {
                        hour: 'HH:mm'
                    }
                },
                title: {
                    display: true,
                    text: 'Time of Day'
                }
            },
            y: {
                beginAtZero: true,
                max: 100
            }
        }
    }
});

const ctxWeight= document.getElementById('eatingChart').getContext('2d');
const eatingChart = new Chart(ctxWeight, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Food Bowl Weight (g)',
            data: [],
            borderColor: 'grey',
            fill: false,
            pointRadius: 0,
            spanGaps: true
        }]
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'hour',
                    tooltipFormat: 'HH:mm',
                    displayFormats: {
                        hour: 'HH:mm'
                    }
                },
                title: {
                    display: true,
                    text: 'Time of Day'
                }
            },
            y: {
                beginAtZero: true,
                max: 20
            }
        }
    }
});


const ctxTemperature = document.getElementById('temperatureChart').getContext('2d');
const temperatureChart = new Chart(ctxTemperature, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: 'orange',
            fill: false,
            pointRadius: 0,
            spanGaps: true
        }]
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'hour',
                    tooltipFormat: 'HH:mm',
                    displayFormats: {
                        hour: 'HH:mm'
                    }
                },
                title: {
                    display: true,
                    text: 'Time of Day'
                }
            },
            y: {
                beginAtZero: true,
                max: 50
            }
        }
    }
});

const ctxHumidity = document.getElementById('humidityChart').getContext('2d');
const humidityChart = new Chart(ctxHumidity, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Humidity (%)',
            data: [],
            borderColor: 'blue',
            fill: false,
            pointRadius: 0,
            spanGaps: true
        }]
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'hour',
                    tooltipFormat: 'HH:mm',
                    displayFormats: {
                        hour: 'HH:mm'
                    }
                },
                title: {
                    display: true,
                    text: 'Time of Day'
                }
            },
            y: {
                beginAtZero: true,
                max: 100
            }
        }
    }
});

function setDefaultDate() {
    const today = new Date();
    const utcPlus8 = new Date(today.getTime() + (8 * 60 * 60 * 1000));
    const formattedDate = utcPlus8.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    document.getElementById('date-select').value = formattedDate;
    fetchHistoricalData();
}
function updateTodayGraph() {
    const dateInput = document.getElementById('date-select').value;
    if (dateInput) {
        fetchHistoricalData(); // Re-fetch the data
    }
}

function updateHistoricalChart(data) {
    const timeLabels = data.map(entry => {
        const [hour, minute] = entry.time.split(':');
        return new Date(new Date().setHours(hour, minute)); // Set the date to today and adjust hours/minutes
    });

    const foodFullnessData = data.map(entry => entry.food_fullness_percentage);
    const weightData = data.map(entry => entry.weight);
    const temperatureData = data.map(entry => entry.temperature);
    const humidityData = data.map(entry => entry.humidity);
    
    // Update food chart
    foodChart.data.labels = timeLabels;
    foodChart.data.datasets[0].data = foodFullnessData;
    foodChart.update();

    // update weight chart
    eatingChart.data.labels = timeLabels;
    eatingChart.data.datasets[0].data = weightData;
    eatingChart.update();

    // Update temperature chart
    temperatureChart.data.labels = timeLabels;
    temperatureChart.data.datasets[0].data = temperatureData;
    temperatureChart.update();

    // Update humidity chart
    humidityChart.data.labels = timeLabels;
    humidityChart.data.datasets[0].data = humidityData;
    humidityChart.update();
}

window.onload = function() {
    fetchCurrentData();
    setDefaultDate();
    resizeCanvases();
    setInterval(updateTodayGraph, 60000);
};