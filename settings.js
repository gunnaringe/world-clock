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

        const timeZoneInput = document.createElement('input');
        timeZoneInput.className = 'location-timezone';
        timeZoneInput.placeholder = 'Search Timezone';
        timeZoneInput.value = timeZone;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'location-name';
        nameInput.placeholder = 'Location Name';
        nameInput.value = name;

        timeZoneInput.addEventListener("input", () => {
            const results = searchTimeZones(timeZoneInput.value);
            showSuggestions(timeZoneInput, results);
            saveLocations();
        });

        nameInput.addEventListener("input", saveLocations);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = '−';
        removeButton.className = 'remove-button';
        removeButton.addEventListener('click', () => {
            locationsContainer.removeChild(container);
            saveLocations();
        });

        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.innerHTML = '↑';
        upButton.className = 'arrow-button';
        upButton.addEventListener('click', () => {
            const prev = container.previousElementSibling;
            if (prev) {
                locationsContainer.insertBefore(container, prev);
                saveLocations();
            }
        });

        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.innerHTML = '↓';
        downButton.className = 'arrow-button';
        downButton.addEventListener('click', () => {
            const next = container.nextElementSibling;
            if (next) {
                locationsContainer.insertBefore(next, container);
                saveLocations();
            }
        });

        container.appendChild(dragHandle);
        container.appendChild(timeZoneInput);
        container.appendChild(nameInput);
        container.appendChild(upButton);
        container.appendChild(downButton);
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

        updateArrows();
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
        updateArrows();
    }

    function updateArrows() {
        const containers = locationsContainer.children;
        Array.from(containers).forEach((container, index) => {
            const upButton = container.querySelector('.arrow-button:nth-of-type(1)');
            const downButton = container.querySelector('.arrow-button:nth-of-type(2)');
            upButton.style.display = 'inline-flex';
            downButton.style.display = 'inline-flex';
            if (index === 0) {
                upButton.innerHTML = '';
            } else {
                upButton.innerHTML = '↑';
            }
            if (index === containers.length - 1) {
                downButton.innerHTML = '';
            } else {
                downButton.innerHTML = '↓';
            }
        });
    }

    function updateTimeAndPlanner() {
        if (window.opener) {
            window.opener.updateTime();
            window.opener.populateMeetingPlanner();
        }
    }

    function searchTimeZones(query) {
        const timeZones = Intl.supportedValuesOf('timeZone');
        const fuse = new Fuse(timeZones, { includeScore: true });
        const results = fuse.search(query);
        return results.map(result => result.item);
    }

    function showSuggestions(input, suggestions) {
        let suggestionBox = input.nextElementSibling;
        if (!suggestionBox || !suggestionBox.classList.contains('suggestion-box')) {
            suggestionBox = document.createElement('div');
            suggestionBox.className = 'suggestion-box';
            input.parentNode.insertBefore(suggestionBox, input.nextSibling);
        }
        suggestionBox.innerHTML = '';
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = suggestion;
            suggestionItem.addEventListener('click', () => {
                input.value = suggestion;
                suggestionBox.innerHTML = '';
                saveLocations();
            });
            suggestionBox.appendChild(suggestionItem);
        });
    }
});
