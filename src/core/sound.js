import { Howl } from 'howler';

const backgroundMusic = new Howl({
    src: ['/audio/Heaven.ogg'],
    volume: 0.5,
    loop: true  
});

export function playBackgroundMusic() {
    backgroundMusic.stop();
    backgroundMusic.play();
}

export function stopBackgroundMusic() {
    backgroundMusic.stop();
}

export function pauseBackgroundMusic() {
    backgroundMusic.pause();
}

export function resumeBackgroundMusic() {
    backgroundMusic.play(); 
}

