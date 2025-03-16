function runFlashSequence() {
    const flashOverlay = document.createElement('div');
    flashOverlay.style.position = 'fixed';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.zIndex = '9999';
    document.body.appendChild(flashOverlay);

    const colors = ['white', 'green', 'blue', 'red', 'black'];
    let colorIndex = 0;

    const intervalId = setInterval(() => {
        flashOverlay.style.backgroundColor = colors[colorIndex];
        colorIndex = (colorIndex + 1) % colors.length;
    }, 100);

    setTimeout(() => {
        clearInterval(intervalId);
        document.body.removeChild(flashOverlay);
    }, 1000);
}
