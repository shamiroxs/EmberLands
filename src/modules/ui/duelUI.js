import { acceptDuelRequest, isDuelProcess } from '../../main'
import { sendDuelRequest } from '/src/main.js'

let potentialOpponentId = null

const socket = new WebSocket("ws://localhost:8080")

export function showDuelPrompt(opponentId) {
  potentialOpponentId = opponentId
  document.getElementById('duel-ui').style.display = 'block'
}

export function hideDuelPrompt() {
    document.getElementById('duel-ui').style.display = 'none'
}

let duelChallengerId = null

export function showDuelInvite(fromId) {
  duelChallengerId = fromId
  document.getElementById('duel-invite').style.display = 'block'
}


document.getElementById('duel-button').onclick = () => {
  sendDuelRequest(potentialOpponentId);
  console.log('clicked')
  document.getElementById('duel-ui').style.display = 'none';
  //isDuelProcess(true)
};

document.getElementById('accept-duel').onclick = () => {
  acceptDuelRequest(duelChallengerId)
  document.getElementById('duel-invite').style.display = 'none';
};

document.getElementById('decline-duel').onclick = () => {
  document.getElementById('duel-invite').style.display = 'none';
  showDuelPrompt(potentialOpponentId);
  isDuelProcess(false)
};

  


