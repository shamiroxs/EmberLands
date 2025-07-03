import { Howl } from 'howler';

const backgroundMusic = new Howl({
    src: ['/audio/Heaven.ogg'],
    volume: 0.5,
    loop: true  
});

const battleMusic = new Howl({
    src: ['/audio/Battle.mp3'],
    volume: 0.2,
    loop: true  
});

const punchSound = new Howl({
    src: ['/audio/Punch.mp3'],
    volume: 0.3,
    rate: 1.2
});

const winSound = new Howl({
    src: ['/audio/Win.mp3'],
    volume: 0.8,
});

const failSound = new Howl({
    src: ['/audio/Fail.mp3'],
    volume: 0.6,
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

export function playBattleMusic() {
    battleMusic.stop();
    battleMusic.play();
}

export function stopBattleMusic() {
    battleMusic.stop();
}

export function playPunchSound() {
    punchSound.stop();
    punchSound.play();
}

export function playWinSound() {
    winSound.stop();
    winSound.play();
}

export function playFailSound() {
    failSound.stop();
    failSound.play();
}