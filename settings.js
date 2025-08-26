document.addEventListener("DOMContentLoaded", () => {
    const hourFormatSelect = document.getElementById("hour-format");
    const locationsContainer = document.getElementById("locations-container");
    const screenFlashCheckbox = document.getElementById("screen-flash");
    const previewFlashButton = document.getElementById("preview-flash");

    // Load existing settings
    hourFormatSelect.value = localStorage.getItem('hourFormat') || '24';
    screenFlashCheckbox.checked = JSON.parse(localStorage.getItem('screenFlash')) || false;
    const locations = JSON.parse(localStorage.getItem('locations')) || [];
    locations.forEach(location => addLocationInput(location.name, location.timeZone));

    // Auto-save hour format
    hourFormatSelect.addEventListener("change", () => {
        localStorage.setItem('hourFormat', hourFormatSelect.value);
        updateTimeAndPlanner();
    });

    // Auto-save screen flash setting
    screenFlashCheckbox.addEventListener("change", () => {
        localStorage.setItem('screenFlash', screenFlashCheckbox.checked);
    });

    // Preview screen flash
    previewFlashButton.addEventListener("click", () => {
        runFlashSequence();
    });

    // Add new location input
    document.getElementById("add-location").addEventListener("click", () => {
        addLocationInput();
    });

    function addLocationInput(name = '', timeZone = '') {
        const container = document.createElement('div');
        container.className = 'location-input';
        container.draggable = true;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';

        const timeZoneContainer = document.createElement('div');
        timeZoneContainer.className = 'timezone-container';

        const timeZoneInput = document.createElement('input');
        timeZoneInput.className = 'location-timezone';
        timeZoneInput.placeholder = 'Search Timezone or UTC+/-X';
        timeZoneInput.value = timeZone;

        // Add timezone validation indicator
        const validationIndicator = document.createElement('span');
        validationIndicator.className = 'timezone-validation';

        // Add error message container
        const errorMessage = document.createElement('div');
        errorMessage.className = 'timezone-error';
        errorMessage.style.display = 'none';

        timeZoneContainer.appendChild(validationIndicator);
        timeZoneContainer.appendChild(errorMessage);

        const quickSelectContainer = document.createElement('div');
        quickSelectContainer.className = 'utc-quick-select';
        quickSelectContainer.style.display = 'none';

        // Create quick GMT offset buttons
        const commonOffsets = ['-12', '-8', '-5', '-4', '0', '+1', '+2', '+5', '+8', '+9', '+12'];
        commonOffsets.forEach(offset => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'utc-button';
            button.textContent = offset === '0' ? 'UTC' : `UTC${offset}`;
            button.addEventListener('click', () => {
                const zones = getTimeZonesByUTCOffset(offset);
                if (zones.length > 0) {
                    timeZoneInput.value = zones[0].id;
                    quickSelectContainer.style.display = 'none';

                    // Trigger validation after GMT selection
                    validateTimezone(timeZoneInput, validationIndicator, errorMessage);
                    saveLocations();
                }
            });
            quickSelectContainer.appendChild(button);
        });

        timeZoneContainer.appendChild(timeZoneInput);
        timeZoneContainer.appendChild(quickSelectContainer);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'location-name';
        nameInput.placeholder = 'Location Name';
        nameInput.value = name;

        timeZoneInput.addEventListener("input", () => {
            const query = timeZoneInput.value.trim();
            if (query.length === 0) {
                hideSuggestions(timeZoneInput);
                quickSelectContainer.style.display = 'none';
                // Clear validation when input is empty
                validationIndicator.className = 'timezone-validation';
                validationIndicator.textContent = '';
                timeZoneInput.classList.remove('valid', 'invalid');
                errorMessage.style.display = 'none';
                return;
            }

            // Show GMT quick select for GMT-related queries
            if (query.toLowerCase().includes('gmt') || query.toLowerCase().includes('utc')) {
                quickSelectContainer.style.display = 'flex';
            } else {
                quickSelectContainer.style.display = 'none';
            }

            const results = searchTimeZones(query);
            showSuggestions(timeZoneInput, results);
            // Don't validate on every keystroke - only on blur or selection
        });

        timeZoneInput.addEventListener("focus", () => {
            const query = timeZoneInput.value.trim();
            if (query.toLowerCase().includes('gmt') || query.toLowerCase().includes('utc')) {
                quickSelectContainer.style.display = 'flex';
            }
        });

        timeZoneInput.addEventListener("blur", (e) => {
            // Delay hiding to allow clicking on GMT buttons
            setTimeout(() => {
                if (!quickSelectContainer.contains(document.activeElement)) {
                    quickSelectContainer.style.display = 'none';
                }
            }, 150);

            // Validate on blur
            validateTimezone(timeZoneInput, validationIndicator, errorMessage);
        });

        // Initial validation if there's a value
        if (timeZone) {
            validateTimezone(timeZoneInput, validationIndicator, errorMessage);
        }

        nameInput.addEventListener("input", saveLocations);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.innerHTML = '🗑️';
        removeButton.className = 'remove-button';
        removeButton.title = 'Remove location';
        removeButton.addEventListener('click', () => {
            locationsContainer.removeChild(container);
            saveLocations();
        });

        container.appendChild(dragHandle);
        container.appendChild(timeZoneContainer);
        container.appendChild(nameInput);
        container.appendChild(removeButton);
        locationsContainer.appendChild(container);

        // Add drag and drop functionality
        container.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', null);
            container.classList.add('dragging');
        });

        container.addEventListener('dragend', () => {
            container.classList.remove('dragging');
            saveLocations();
        });

        locationsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(locationsContainer, e.clientY);
            const draggingElement = document.querySelector('.dragging');
            if (afterElement == null) {
                locationsContainer.appendChild(draggingElement);
            } else {
                locationsContainer.insertBefore(draggingElement, afterElement);
            }
        });


    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.location-input:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function saveLocations() {
        const newLocations = Array.from(locationsContainer.children).map(container => {
            const name = container.querySelector('.location-name').value;
            const timeZone = container.querySelector('.location-timezone').value;
            return { id: `clock-${name.toLowerCase().replace(/\s+/g, '-')}`, name, timeZone };
        });
        localStorage.setItem('locations', JSON.stringify(newLocations));
        updateTimeAndPlanner();
    }



    function updateTimeAndPlanner() {
        if (window.opener) {
            window.opener.updateTime();
            window.opener.populateMeetingPlanner();
        }
    }

    function searchTimeZones(query) {
        if (!query.trim()) return [];

        const timeZones = Intl.supportedValuesOf('timeZone');

        // Handle UTC offset format (UTC, UTC+1, UTC-5, GMT+2, etc.)
        const utcMatch = query.match(/^(GMT|UTC)([+-]\d{1,2})?$/i);
        if (utcMatch) {
            return getTimeZonesByUTCOffset(utcMatch[2] || '+0');
        }

        // Create enhanced timezone data with additional searchable fields
        const enhancedTimeZones = timeZones.map(tz => {
            const parts = tz.split('/');
            const city = parts[parts.length - 1].replace(/_/g, ' ');
            const region = parts.length > 1 ? parts[0] : '';

            // Get current offset for this timezone
            const now = new Date();
            const offset = getTimezoneOffset(tz, now);
            const utcString = formatUTCOffset(offset);

            return {
                id: tz,
                city: city,
                region: region,
                full: tz,
                searchText: `${tz} ${city} ${region} ${utcString}`.toLowerCase(),
                offset: offset,
                utcString: utcString
            };
        });

        // Prioritize common/major timezones
        const commonTimezones = [
            'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
            'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
            'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
            'UTC', 'GMT'
        ];

        // Configure Fuse.js with better options
        const fuse = new Fuse(enhancedTimeZones, {
            keys: [
                { name: 'city', weight: 0.4 },
                { name: 'region', weight: 0.2 },
                { name: 'full', weight: 0.3 },
                { name: 'utcString', weight: 0.1 }
            ],
            threshold: 0.4,
            includeScore: true,
            minMatchCharLength: 1
        });

        const results = fuse.search(query);

        // Sort results: prioritize common timezones, then by score
        const sortedResults = results.sort((a, b) => {
            const aIsCommon = commonTimezones.includes(a.item.id);
            const bIsCommon = commonTimezones.includes(b.item.id);

            if (aIsCommon && !bIsCommon) return -1;
            if (!aIsCommon && bIsCommon) return 1;

            return a.score - b.score;
        });

        return sortedResults.slice(0, 10).map(result => ({
            id: result.item.id,
            display: `${result.item.city} (${result.item.utcString})`,
            region: result.item.region
        }));
    }

    function getTimeZonesByUTCOffset(offsetStr) {
        const targetOffset = parseInt(offsetStr) * 60; // Convert to minutes
        const timeZones = Intl.supportedValuesOf('timeZone');
        const now = new Date();

        const matchingZones = timeZones
            .map(tz => {
                const offset = getTimezoneOffset(tz, now);
                return { id: tz, offset: offset };
            })
            .filter(tz => tz.offset === targetOffset)
            .slice(0, 8) // Limit results
            .map(tz => {
                const parts = tz.id.split('/');
                const city = parts[parts.length - 1].replace(/_/g, ' ');
                const utcString = formatUTCOffset(tz.offset);
                return {
                    id: tz.id,
                    display: `${city} (${utcString})`,
                    region: parts.length > 1 ? parts[0] : ''
                };
            });

        return matchingZones;
    }

    function getTimezoneOffset(timeZone, date) {
        // The most reliable way to get timezone offset in JavaScript
        // Create a date formatter for the target timezone
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timeZone }));

        // Calculate the difference in minutes
        return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
    }

    function formatUTCOffset(offsetMinutes) {
        if (offsetMinutes === 0) return 'UTC+0';
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        const minutes = Math.abs(offsetMinutes) % 60;
        const sign = offsetMinutes >= 0 ? '+' : '-';
        return minutes > 0 ? `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}` : `UTC${sign}${hours}`;
    }

    function showSuggestions(input, suggestions) {
        let suggestionBox = input.nextElementSibling;
        if (!suggestionBox || !suggestionBox.classList.contains('suggestion-box')) {
            suggestionBox = document.createElement('div');
            suggestionBox.className = 'suggestion-box';
            input.parentNode.insertBefore(suggestionBox, input.nextSibling);
        }
        suggestionBox.innerHTML = '';

        if (suggestions.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }

        suggestionBox.style.display = 'block';

        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';

            // Handle both old string format and new object format
            const displayText = typeof suggestion === 'string' ? suggestion : suggestion.display;
            const timezoneId = typeof suggestion === 'string' ? suggestion : suggestion.id;
            const region = typeof suggestion === 'object' ? suggestion.region : '';

            suggestionItem.innerHTML = `
                <div class="suggestion-main">${displayText}</div>
                ${region ? `<div class="suggestion-region">${region}</div>` : ''}
            `;

            suggestionItem.addEventListener('click', () => {
                input.value = timezoneId;
                suggestionBox.innerHTML = '';
                suggestionBox.style.display = 'none';

                // Trigger validation after selection
                const container = input.closest('.timezone-container');
                if (container) {
                    const validationIndicator = container.querySelector('.timezone-validation');
                    const errorMessage = container.querySelector('.timezone-error');
                    if (validationIndicator && errorMessage) {
                        validateTimezone(input, validationIndicator, errorMessage);
                    }
                }

                saveLocations();
            });
            suggestionBox.appendChild(suggestionItem);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', function hideSuggestionsHandler(e) {
            if (!input.contains(e.target) && !suggestionBox.contains(e.target)) {
                suggestionBox.style.display = 'none';
                document.removeEventListener('click', hideSuggestionsHandler);
            }
        });
    }

    function hideSuggestions(input) {
        let suggestionBox = input.nextElementSibling;
        if (suggestionBox && suggestionBox.classList.contains('suggestion-box')) {
            suggestionBox.style.display = 'none';
        }
    }

    function validateTimezone(input, indicator, errorContainer) {
        const value = input.value.trim();

        if (!value) {
            indicator.className = 'timezone-validation';
            indicator.textContent = '';
            input.classList.remove('valid', 'invalid');
            if (errorContainer) {
                errorContainer.style.display = 'none';
            }
            return true;
        }

        try {
            // Test if the timezone is valid by trying to create a date with it
            const testDate = new Date();
            testDate.toLocaleString('en-US', { timeZone: value });

            // If we get here, the timezone is valid
            indicator.className = 'timezone-validation valid';
            indicator.textContent = '✓';
            input.classList.add('valid');
            input.classList.remove('invalid');

            if (errorContainer) {
                errorContainer.style.display = 'none';
            }

            // Show current time in this timezone
            const currentTime = new Date().toLocaleString('en-US', {
                timeZone: value,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            indicator.title = `Current time: ${currentTime}`;

            return true;

        } catch (error) {
            // Invalid timezone
            indicator.className = 'timezone-validation invalid';
            indicator.textContent = '✗';
            indicator.title = 'Invalid timezone';
            input.classList.add('invalid');
            input.classList.remove('valid');

            if (errorContainer) {
                errorContainer.textContent = getSuggestionForInvalidTimezone(value);
                errorContainer.style.display = 'block';
            }

            return false;
        }
    }

    function getSuggestionForInvalidTimezone(value) {
        const lowerValue = value.toLowerCase();

        // Common mistakes and suggestions
        const suggestions = {
            'est': 'Try "America/New_York" for Eastern Time',
            'pst': 'Try "America/Los_Angeles" for Pacific Time',
            'cst': 'Try "America/Chicago" for Central Time',
            'mst': 'Try "America/Denver" for Mountain Time',
            'bst': 'Try "Europe/London" for British Time',
            'cet': 'Try "Europe/Paris" for Central European Time',
            'jst': 'Try "Asia/Tokyo" for Japan Time',
            'ist': 'Try "Asia/Kolkata" for India Time'
        };

        for (const [key, suggestion] of Object.entries(suggestions)) {
            if (lowerValue.includes(key)) {
                return suggestion;
            }
        }

        // UTC format suggestions
        if (lowerValue.includes('gmt') || lowerValue.includes('utc')) {
            return 'Use format like "UTC+1" or "UTC-5", or try searching for a city name';
        }

        return 'Invalid timezone. Try searching for a city name or use UTC+/-X format';
    }

    function showTimezoneInfo(timeZone) {
        if (!timeZone) return '';

        try {
            const now = new Date();
            const offset = getTimezoneOffset(timeZone, now);
            const utcString = formatUTCOffset(offset);
            const currentTime = now.toLocaleString('en-US', {
                timeZone: timeZone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            return `${utcString} • ${currentTime}`;
        } catch (error) {
            return '';
        }
    }
});
