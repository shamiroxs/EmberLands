import { isMobileDevice } from "../../main";


// Create a container for the message
const messageDiv = document.createElement("div");
messageDiv.style.position = "absolute";

messageDiv.style.left = "50%";
messageDiv.style.transform = "translate(-50%, -50%)";
messageDiv.style.color = "white";

messageDiv.style.fontFamily = "Arial, sans-serif";
messageDiv.style.padding = "10px";
messageDiv.style.background = "rgba(0, 0, 0, 0.7)";
messageDiv.style.borderRadius = "10px";
messageDiv.style.textAlign = "center";
messageDiv.style.opacity = "0"; 
messageDiv.style.transition = "opacity 1s";

if(!isMobileDevice()){
    messageDiv.style.top = "90%";
    messageDiv.style.fontSize = "24px";
}
document.body.appendChild(messageDiv);

function showMessage(text, delay, callback) {
    setTimeout(() => {
        messageDiv.innerHTML = text;
        messageDiv.style.opacity = "1"; // Fade in
        setTimeout(() => {
            messageDiv.style.opacity = "0"; // Fade out
            if (callback) setTimeout(callback, 1000); // Wait for fade-out before next step
        }, 3500);
    }, delay);
}
export function startStory(scene) {
    // Show messages without blocking other animations
    showMessage("Welcome to EmberLands!", 20, () => {
        showMessage("Movement: W A S D", 20, () => {
            showMessage("Block: Left Shift", 20, () => {
                showMessage("Punch: Right Click<br>Kick: Left Click", 20, () => {
                    showMessage("Block, Punch, and Kick start at the duel.", 400, () => {
                        document.body.removeChild(messageDiv);
                    });
                });
            });
        });
    });    
}

export function endStory(){
    messageDiv.style.opacity = "0";
}