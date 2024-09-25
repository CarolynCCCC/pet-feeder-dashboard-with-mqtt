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

function fetchCurrentData() {
    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        client.subscribe('BAIT2123_IOT_PET_FEEDER/weight', (err) => {
            if (err) console.error('Subscription error: ', err);
        });
        client.subscribe('BAIT2123_IOT_PET_FEEDER/food_fullness_percentage', (err) => {
            if (err) console.error('Subscription error: ', err);
        });
        client.subscribe('BAIT2123_IOT_PET_FEEDER/temperature', (err) => {
            if (err) console.error('Subscription error: ', err);
        });
        client.subscribe('BAIT2123_IOT_PET_FEEDER/humidity', (err) => {
            if (err) console.error('Subscription error: ', err);
        });
        client.subscribe('BAIT2123_IOT_PET_FEEDER/water_fullness', (err) => {
            if (err) console.error('Subscription error: ', err);
        });
    });

    client.on('message', (topic, message) => {
        const value = message.toString();
        console.log(value)
        if (topic === 'BAIT2123_IOT_PET_FEEDER/weight') {
            document.getElementById('current-weight').innerText = value || 0;
        } else if (topic === 'BAIT2123_IOT_PET_FEEDER/food_fullness_percentage') {
            document.getElementById('current-food-fullness').innerText = value || 0;
        } else if (topic === 'BAIT2123_IOT_PET_FEEDER/temperature') {
            document.getElementById('current-temperature').innerText = value || 0;
        } else if (topic === 'BAIT2123_IOT_PET_FEEDER/humidity') {
            document.getElementById('current-humidity').innerText = value || 0;
         }else if (topic === 'BAIT2123_IOT_PET_FEEDER/water_fullness') {
            document.getElementById('current-water-fullness').innerText = value || 0;
        }
    });

    client.on('error', (error) => {
        console.error('Connection error: ', error);
    });
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
            borderColor: 'rgba(75, 192, 192, 1)',
            fill: false
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
            borderColor: 'rgba(255, 255, 0, 1)',
            fill: false
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


const ctxTemperature = document.getElementById('temperatureChart').getContext('2d');
const temperatureChart = new Chart(ctxTemperature, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperature (°C)',
            data: [],
            borderColor: 'rgba(255, 99, 132, 1)',
            fill: false
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

const ctxHumidity = document.getElementById('humidityChart').getContext('2d');
const humidityChart = new Chart(ctxHumidity, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Humidity (%)',
            data: [],
            borderColor: 'rgba(54, 162, 235, 1)',
            fill: false
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
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
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
    setDefaultDate(); // Set the default date and fetch today's data
    
    // Update today's graph every minute
    setInterval(updateTodayGraph, 60000); // 60000 ms = 1 minute
};