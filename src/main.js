import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { Player } from './modules/Player.js'
import { world } from './physics/physics.js'
import { Water } from 'three/examples/jsm/objects/Water2.js'
import { TextureLoader, Vector2, PlaneGeometry, RepeatWrapping, Color } from 'three'
import seedrandom from 'seedrandom'
import { pauseBackgroundMusic, playBackgroundMusic, playBattleMusic, playFailSound, playPunchSound, playWinSound, resumeBackgroundMusic, stopBackgroundMusic, stopBattleMusic } from './core/sound.js'
import cannonDebugger from 'cannon-es-debugger'
import { createTerrain, buildHeightMatrix, scatterObstacles } from './modules/world/world.js'
import { hideDuelPrompt, showDuelInvite, showDuelPrompt } from './modules/ui/duelUI.js'
import { destroyArena, summonArena } from './modules/world/arena.js'
import { duelState } from './modules/duelManager.js'
import { startStory } from './modules/ui/tutorial.js'
import { Slime } from './modules/slime.js'

const canvas = document.getElementById('game')
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setSize(window.innerWidth, window.innerHeight)

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

function onWindowResize() {
  const width = window.innerWidth
  const height = window.innerHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()

  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
}


const scene = new THREE.Scene()
scene.background = new THREE.Color(0x222233)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 5, 4)

const directionalLight = new THREE.DirectionalLight(0x88ffcc, 0.9)
directionalLight.position.set(10, 20, 10)
directionalLight.castShadow = true

directionalLight.shadow.mapSize.width = 1024
directionalLight.shadow.mapSize.height = 1024
directionalLight.shadow.camera.near = 0.5
directionalLight.shadow.camera.far = 100

directionalLight.shadow.camera.left = -30
directionalLight.shadow.camera.right = 30
directionalLight.shadow.camera.top = 30
directionalLight.shadow.camera.bottom = -30


scene.add(directionalLight)


const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

//prevent body to immerse to terrian
const groundMaterial = new CANNON.Material('groundMaterial');
const playerMaterial = new CANNON.Material('playerMaterial');

const contactMaterial = new CANNON.ContactMaterial(
  groundMaterial,
  playerMaterial,
  {
    friction: 1.0,      
    restitution: 0.0    
  }
);

world.addContactMaterial(contactMaterial);

const { mesh: terrainMesh, heightData, size, resolution } = await createTerrain(scene)

//terrain
const matrix = buildHeightMatrix(heightData, resolution)
const shape = new CANNON.Heightfield(matrix, { elementSize: size / (resolution - 1) })

const terrainBody = new CANNON.Body({ 
  mass: 0,
  material: groundMaterial,
})
terrainBody.addShape(shape)
terrainBody.position.set(-size/2, 0, -size/2 +100) // align with mesh

terrainBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)

world.addBody(terrainBody)

const cannonDebug = cannonDebugger(scene, world, {
  color: 0x00ff00, 
});

//textures
const loader_sky = new THREE.CubeTextureLoader()
const skybox = loader_sky.setPath('/textures/skybox/').load([
  'xpos.jpg', 'xneg.jpg',
  'ypos.jpg', 'yneg.jpg',
  'zpos.jpg', 'zneg.jpg',
])
scene.background = skybox

//fog
scene.fog = new THREE.Fog(0x88bb88, 10, 60) // color, near, far

//water
const textureLoader = new TextureLoader()
const normalMap0 = textureLoader.load('/textures/waternormals.jpg')
const normalMap1 = textureLoader.load('/textures/waternormals.jpg')
normalMap0.wrapS = normalMap0.wrapT = RepeatWrapping
normalMap1.wrapS = normalMap1.wrapT = RepeatWrapping

const waterGeometry = new PlaneGeometry(100, 100)

const water = new Water(waterGeometry, {
  color: 0x447799,
  scale: 2,                    
  flowDirection: new Vector2(0, 1), 
  textureWidth: 512,
  textureHeight: 512,
  normalMap0,
  normalMap1,
  flowSpeed: 0.01,            
})

water.rotation.x = -Math.PI / 2
water.position.y = 0.9 //0.74
scene.add(water)

//Obstacles
const obstacles = [];
const rng = seedrandom("forest-map-v1")

scatterObstacles(scene, heightData, size, resolution, 15, 40, rng, obstacles)

//Add slimes
const slimes = []

const slimeData = [
  { position: new THREE.Vector3(38, 5, 10),  model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(-19, 5, 47), model: '/models/slime2.glb', anim: 'slime-idle' },
  { position: new THREE.Vector3(39, 5, -27),  model: '/models/slime2.glb', anim: 'slime-jump' },
  { position: new THREE.Vector3(-40, 5, -50), model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(40, 5, 15),  model: '/models/slime2.glb', anim: 'slime-idle' },
  { position: new THREE.Vector3(22, 5, 30),  model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(10, 5, -33), model: '/models/slime2.glb', anim: 'slime-jump' },
  { position: new THREE.Vector3(-18, 5, 18),  model: '/models/slime2.glb', anim: 'slime-idle' },
  { position: new THREE.Vector3(20, 5, -10), model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(-10, 5, 50),  model: '/models/slime2.glb', anim: 'slime-jump' },
  { position: new THREE.Vector3(50, 5, 15),   model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(-10, 5, -19), model: '/models/slime2.glb', anim: 'slime-idle' },
  { position: new THREE.Vector3(47, 5, -10),  model: '/models/slime2.glb', anim: 'slime-jump' },
  { position: new THREE.Vector3(-16, 5, 26),  model: '/models/slime1.glb', anim: '' },
  { position: new THREE.Vector3(50, 5, 30),  model: '/models/slime2.glb', anim: 'slime-idle' },

]

for (const data of slimeData) {
  const slime = new Slime(scene, world, data.model, data.position, data.anim)
  slimes.push(slime)
}

const remotePlayers = new Map() 
window.remotePlayers = remotePlayers
let myId = null
const cameraTarget = new THREE.Vector3()

const localPlayer = new Player(scene, world, true, terrainMesh, camera, playerMaterial, myId)

const minimap = document.getElementById('minimap')
const radarCtx = minimap.getContext('2d')

const radarRange = 50

playBackgroundMusic();
let isMuted = false;

const toggleButton = document.getElementById('soundToggle');

toggleButton.addEventListener('click', () => {
    if (isMuted) {
        resumeBackgroundMusic()
        toggleButton.src = '/icons/sound.png'; 
    } else {
        pauseBackgroundMusic()
        toggleButton.src = '/icons/silent.png';
    }
    isMuted = !isMuted;
});

let opponentId;
const clock = new THREE.Clock()
let arenaMixer = null

function simulateKey(key, type = 'keydown') {
  const event = new KeyboardEvent(type, { key, code: key, bubbles: true });
  window.dispatchEvent(event);
}

function simulateMouse(button, type = 'mousedown') {
  const canvas = document.getElementById('game');
  const event = new MouseEvent(type, {
    bubbles: true,
    button: button
  });
  canvas.dispatchEvent(event);
}

if(!isMobileDevice()){
  startStory()
}

window.addEventListener('resize', onWindowResize)

window.addEventListener('orientationchange', () => {
  setTimeout(onWindowResize, 300)
})

function animate() {
  requestAnimationFrame(animate)
  world.step(1 / 60)

  //cannonDebug.update();

  const deltaTime = clock.getDelta()
  for (const slime of slimes) {
    slime.update(deltaTime)
  }

  const localBar = document.getElementById('localHealthBarContainer')
  if (localBar) {
    localBar.style.display = duelState.active ? 'block' : 'none'
  }

  for (const player of remotePlayers.values()) {
    player.update(world, deltaTime)
  }
  
  localPlayer.update(world, deltaTime)

  drawRadar()
  checkNearbyPlayers()

  if (arenaMixer) {
    arenaMixer.update(deltaTime)
  }  

  renderer.render(scene, camera)
}
animate()

let duelProcess = false;

//const socket = new WebSocket("ws://localhost:8080")
const socket = new WebSocket("wss://emberlands-server.onrender.com")

socket.addEventListener('open', () => {
  console.log('WebSocket connection established.')

  setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const pos = localPlayer.getPosition()
      const rotationY = localPlayer.getRotationY?.() || 0
      const state = localPlayer.getState()
  
      const data = {
        type: 'move',
        position: {
          x: pos.x,
          y: pos.y,
          z: pos.z
        },
        rotationY,
        state
      }
  
      socket.send(JSON.stringify(data))
    }
  }, 100)
  
})

let msgType;

socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  msgType = message.type

  if (message.type === 'init') {
    myId = message.id
    console.log("My ID:", myId)
    localPlayer.id = myId

  } else if (message.type === 'playerUpdate') {
    const { id, position, rotationY, state } = message
  
    if (id === myId) return // Ignore our own updates
  
    let remote = remotePlayers.get(id)
  
    if (!remote) {
      remote = new Player(scene, world, false)
      remote.id = id 
      remotePlayers.set(id, remote)
    }
  
    remote.setRemoteState({ position, rotationY, state })  

  } else if (message.type === 'disconnect') {
    const remote = remotePlayers.get(message.id)
    if (remote) {
      remote.destroy(scene, world)
      remotePlayers.delete(message.id)
      hideDuelPrompt()
      if(opponentId == remote.id){
        destroyArena(scene, world)
        duelProcess = false

        duelState.active = false
      }
    }
  } else if (message.type === 'duelInvite') {
      hideDuelPrompt()
    if(!duelProcess){
      showDuelInvite(message.from)
    }
  } else if (message.type === 'duelAccepted') {
    duelProcess = true
    hideDuelPrompt()

    stopBackgroundMusic();
    if (!isMuted) playBattleMusic();
  {
    (async () => {
      const localPosition = localPlayer.getPosition()
      const arenaData = await summonArena(scene, world, localPosition)
      arenaMixer = arenaData.mixer

      duelState.active = true
      duelState.players = [myId, opponentId]
      duelState.arena = { center: arenaData.center, radius: 8 } 

    })()
  }
  } else if (message.type === 'healthUpdate') {
    if (!isMuted) playPunchSound()
    const player = remotePlayers.get(message.id)
    if (player) {
      player.health = message.health

      if (player.healthBar) {
        const ctx = player.healthBar.userData.context
        ctx.clearRect(0, 0, 128, 16)
  
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, 128, 16)
  
        const healthWidth = (player.health / 100) * 128
        ctx.fillStyle = player.health > 40 ? 'lime' : player.health > 20 ? 'orange' : 'red'
        ctx.fillRect(0, 0, healthWidth, 16)
  
        player.healthBar.userData.texture.needsUpdate = true
      }
    }
  } else if (message.type === 'applyDamage') {
    if (message.to === myId || !message.to) {
      localPlayer.takeDamage(message.damage)
    }
  } else if (message.type === 'duelEnd') {
    onDuelEnd(message.loserId)
    duelProcess = false

    duelState.players = []
    duelState.arena = null

    if (!isMuted) playBackgroundMusic();
    stopBattleMusic();
  }  
}

export function onDuelEnd(loserId) {
  if (!duelState.active) return

  const winnerId = duelState.players.find(id => id !== loserId)

  duelState.active = false

  // UI message
  const text = (winnerId === myId) ? '🏆 You Win the Duel!' : (loserId === myId) ? '💀 You Lost the Duel!' : `👑 Player ${winnerId} wins the duel!`

  // Reset 
  localPlayer.health = 100
  localPlayer.takeDamage(0)
  for (const player of remotePlayers.values()) {
    player.health = 100
    player.takeDamage(0)
  }

  if (localPlayer.id === winnerId) {
    localPlayer.playAction('victory', 6)  
    localPlayer.currentState = 'victory'
    if (!isMuted) playWinSound();
    
  } else if (localPlayer.id === loserId) {
    localPlayer.playAction('defeated', 6)
    localPlayer.currentState = 'defeated'
    if (!isMuted) playFailSound();
  }

  for (const [id, remote] of remotePlayers.entries()) {
    if (id === winnerId) {
      remote.playAction('victory', 6)
      remote.currentState = 'victory'
    } else if (id === loserId) {
      remote.playAction('defeated', 6)
      remote.currentState = 'defeated'
    }
  }

  const resultBox = document.getElementById('duelResult')
  const resultText = document.getElementById('duelResultText')

  resultText.textContent = text
  resultBox.classList.remove('hidden')
  resultBox.classList.add('visible')

  setTimeout(() => {
    resultBox.classList.remove('visible')
    resultBox.classList.add('hidden')
  }, 4000)

  destroyArena(scene, world)
}

export function sendDuelEnd(loserId) {
  const winnerId = duelState.players.find(id => id !== loserId)
  duelProcess = false

  duelState.players = []
  duelState.arena = null

  if (!isMuted) playBackgroundMusic();
  stopBattleMusic();

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'duelEnd',
      loserId: loserId,
      winnerId: winnerId
    }))
  }
}

export function sendAttemptAttack() {
    socket.send(JSON.stringify({
      type: 'duelAttack',
      from: myId,
      to: opponentId,
      damage: 20
    }))
}


export function sendDuelRequest(opponentId) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'duelRequest',
      from: myId,
      to: opponentId
    }))
  }
}

export async function acceptDuelRequest(duelChallengerId){
  stopBackgroundMusic();
  if (!isMuted) playBattleMusic();
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ 
      type: 'duelAccepted', 
      from: myId, 
      to: duelChallengerId 
    }));
  }  

  duelProcess = true
  //summon arena
  const challenger = remotePlayers.get(duelChallengerId)
  if (challenger) {
    const challengerPosition = challenger.getPosition()

    const arenaData = await summonArena(scene, world, challengerPosition) 
    arenaMixer = arenaData.mixer 

    duelState.active = true
    duelState.players = [myId, opponentId]
    duelState.arena = { center: arenaData.center, radius: 8 } 

  } else {
    console.warn('Challenger not found in remotePlayers map')
  }
}

export function isDuelProcess(isDuel){
  duelProcess = isDuel;
}

export function sendHealthUpdate(playerId, health) {
  if (!isMuted) playPunchSound();
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'healthUpdate',
      id: playerId,
      health: health
    }));
  }
}

function checkNearbyPlayers() {
  const myPos = localPlayer.getPosition()
  let foundNearbyPlayer = false;

  for (const [id, player] of remotePlayers.entries()) {
    const dist = myPos.distanceTo(player.getPosition())

    if(msgType === 'duelInvite'){
      duelProcess = true;
    }
    if (dist < 2 && !duelProcess) {
      opponentId = id
      showDuelPrompt(id) 
      foundNearbyPlayer = true;
    }
    if (!foundNearbyPlayer) {
      hideDuelPrompt();
    }
  }
}

// Mini map
function drawRadar() {
  radarCtx.clearRect(0, 0, minimap.width, minimap.height)

  const centerX = minimap.width / 2
  const centerY = minimap.height / 2
  const scale = (minimap.width / 2) / radarRange

  // Radar circle
  radarCtx.beginPath()
  radarCtx.arc(centerX, centerY, minimap.width / 2 - 2, 0, Math.PI * 2)
  radarCtx.strokeStyle = '#aaa'
  radarCtx.lineWidth = 2
  radarCtx.stroke()

  //player
  const forward = localPlayer.getForwardVector?.() || new THREE.Vector3(-1, 0, 0)
  const angle = Math.atan2(forward.z, -forward.x)

  radarCtx.save()
  radarCtx.translate(centerX, centerY)
  radarCtx.rotate(angle)

  // Draw arrow 
  radarCtx.beginPath()
  radarCtx.moveTo(0, -6)   
  radarCtx.lineTo(4, 4)    
  radarCtx.lineTo(-4, 4)   
  radarCtx.closePath()

  radarCtx.fillStyle = 'white'
  radarCtx.fill()

  radarCtx.restore()

  const playerPos = localPlayer.getPosition()

  //remote players
  for (const player of remotePlayers.values()) {
    const pos = player.getPosition()
    const dx = pos.x - playerPos.x
    const dz = pos.z - playerPos.z
    if (Math.hypot(dx, dz) < radarRange) {
      radarCtx.fillStyle = 'red'
      radarCtx.beginPath()
      radarCtx.arc(centerX + dx * scale, centerY + dz * scale, 4, 0, Math.PI * 2)
      radarCtx.fill()
    }
  }

  //obstacles
  for (const pos of obstacles) {
    const dx = pos.x - playerPos.x
    const dz = pos.z - playerPos.z
    if (Math.hypot(dx, dz) < radarRange) {
      radarCtx.fillStyle = '#999'
      radarCtx.beginPath()
      radarCtx.arc(centerX + dx * scale, centerY + dz * scale, 2, 0, Math.PI * 2)
      radarCtx.fill()
    }
  }
}

export function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
}

if(!isMobileDevice()){
  const minimap = document.getElementById('minimap')
  if (minimap) {
    minimap.style.display ='block'
  }
}

if (isMobileDevice()) {
    
  const thumbstick = document.getElementById('thumbstick-container')
  if (thumbstick) thumbstick.style.display = 'block'

  document.getElementById('mobileControls').classList.remove('hidden')

  document.getElementById('btnPunch').addEventListener('click', () => {
    simulateMouse(2, 'mousedown');
    setTimeout(() => simulateMouse(2, 'mouseup'), 300);
  });

  document.getElementById('btnKick').addEventListener('click', () => {
    simulateMouse(0, 'mousedown');
    setTimeout(() => simulateMouse(0, 'mouseup'), 300);
  });

  document.getElementById('btnJump').addEventListener('click', () => {
    simulateKey('Space', 'keydown');
    setTimeout(() => simulateKey('Space', 'keyup'), 200);
  });

  document.getElementById('btnBlock').addEventListener('pointerdown', () => {
    simulateKey('ShiftLeft', 'keydown');
  });
  document.getElementById('btnBlock').addEventListener('pointerup', () => {
    simulateKey('ShiftLeft', 'keyup');
  });

}

function requestFullscreen() {
  const el = document.documentElement
  if (el.requestFullscreen) {
    el.requestFullscreen()
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen()
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen()
  }
}

canvas.addEventListener('click', () => {
  requestFullscreen()
  canvas.requestPointerLock()
})

