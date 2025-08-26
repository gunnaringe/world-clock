const defaultLocations = [
    { id: 'clock-trondheim', name: 'Trondheim', timeZone: 'Europe/Oslo' },
    { id: 'clock-san-jose', name: 'San Jose', timeZone: 'America/Los_Angeles' },
];

function updateTime() {
    const locations = getLocations();
    const hourFormat = getHourFormat() === '12';
    locations.forEach(location => {
        const now = new Date();
        const time = now.toLocaleString("en-US", { timeZone: location.timeZone, hour: '2-digit', minute: '2-digit', hour12: hourFormat });
        const date = now.toLocaleString("en-US", { timeZone: location.timeZone, day: '2-digit', month: 'long' });
        const offset = getTimezoneOffset(location.timeZone);
        document.getElementById(`time-${location.id}`).innerText = time;
        document.getElementById(`date-${location.id}`).innerText = date;
        document.getElementById(`timezone-${location.id}`).innerText = offset.replace('GMT', 'UTC');
    });
}

function getTimezoneOffset(timeZone) {
    const now = new Date();
    const options = { timeZone, timeZoneName: 'shortOffset' };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const offset = parts.find(part => part.type === 'timeZoneName').value;
    return offset;
}

function populateMeetingPlanner() {
    const tableBody = document.getElementById("meeting-planner-table").getElementsByTagName("tbody")[0];
    tableBody.innerHTML = ''; // Clear existing rows
    const currentHour = new Date().getHours();
    const hourFormat = getHourFormat() === '12';
    const locations = getLocations();
    for (let i = 0; i < 24; i++) {
        const hour = (currentHour + i) % 24;
        const row = tableBody.insertRow();
        locations.forEach(location => {
            const cell = row.insertCell();
            const localTime = new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleString("en-US", { timeZone: location.timeZone, hour: '2-digit', minute: '2-digit', hour12: hourFormat });
            const localHour = new Date(new Date().setHours(hour, 0, 0, 0)).toLocaleString("en-US", { timeZone: location.timeZone, hour: '2-digit', hour12: false });
            if (localHour >= 8 && localHour < 17) {
                cell.classList.add('lightgreen');
            } else if (localHour == 7 || (localHour >= 17 && localHour <= 22)) {
                cell.classList.add('yellowish');
            } else if (localHour >= 23 || localHour < 7) {
                cell.classList.add('redish');
            }
            if (hour === currentHour) {
                cell.classList.add('bold');
            }
            cell.innerText = localTime;
        });
    }
}

function getHourFormat() {
    return localStorage.getItem('hourFormat') || '24';
}

function setHourFormat(format) {
    localStorage.setItem('hourFormat', format);
    updateTime();
    populateMeetingPlanner();
}

function getLocations() {
    const locations = JSON.parse(localStorage.getItem('locations')) || defaultLocations;
    return locations.filter(location => {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: location.timeZone }).format(new Date());
            return true;
        } catch (e) {
            console.warn(`Invalid time zone: ${location.timeZone}`);
            return false;
        }
    });
}

function setLocations(locations) {
    localStorage.setItem('locations', JSON.stringify(locations));
    updateTime();
    populateMeetingPlanner();
    renderClocks();
}

function renderClocks() {
    const clockContainer = document.querySelector('.clock-container');
    clockContainer.innerHTML = ''; // Clear existing clocks
    const locations = getLocations();
    locations.forEach(location => {
        const clockDiv = document.createElement('div');
        clockDiv.className = 'clock';
        clockDiv.id = location.id;
        clockDiv.innerHTML = `<h2>${location.name}</h2><p id="time-${location.id}" class="time"></p><p id="date-${location.id}" class="date"></p><p id="timezone-${location.id}" class="timezone"></p>`;
        clockContainer.appendChild(clockDiv);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderClocks();

    function updateAll() {
        updateTime();
        populateMeetingPlanner();
    }

    updateAll();
    setInterval(updateAll, 1000); // Update every second

    // Run flash sequence every 30 minutes if the setting is enabled
    if (JSON.parse(localStorage.getItem('screenFlash'))) {
        setInterval(runFlashSequence, 1800000);
    }
});
