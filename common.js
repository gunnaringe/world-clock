function runFlashSequence() {
    const flashOverlay = document.createElement('div');
    flashOverlay.style.position = 'fixed';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.zIndex = '9999';
    flashOverlay.style.backgroundColor = 'white';
    document.body.appendChild(flashOverlay);

    setTimeout(() => {
        flashOverlay.style.backgroundColor = 'black';
    }, 500);

    setTimeout(() => {
        document.body.removeChild(flashOverlay);
    }, 1000);
}
