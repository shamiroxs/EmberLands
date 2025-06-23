import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { Player } from './modules/Player.js'
import { world } from './physics/physics.js'
import { Water } from 'three/examples/jsm/objects/Water2.js'
import { TextureLoader, Vector2, PlaneGeometry, RepeatWrapping, Color } from 'three'
import seedrandom from 'seedrandom'
import { pauseBackgroundMusic, playBackgroundMusic, resumeBackgroundMusic, stopBackgroundMusic } from './core/sound.js'
import cannonDebugger from 'cannon-es-debugger'
import { createTerrain, buildHeightMatrix, scatterObstacles } from './modules/world/world.js'
import { hideDuelPrompt, showDuelInvite, showDuelPrompt } from './modules/ui/duelUI.js'

const canvas = document.getElementById('game')
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setSize(window.innerWidth, window.innerHeight)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x222233)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 2, 5)

const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(5, 10, 5)
scene.add(light)

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x333333 })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

const groundBody = new CANNON.Body({
  mass: 0, // static
  shape: new CANNON.Plane(),
})
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)

const { mesh: terrainMesh, heightData, size, resolution } = await createTerrain(scene)

//terrain
const matrix = buildHeightMatrix(heightData, resolution)
const shape = new CANNON.Heightfield(matrix, { elementSize: size / (resolution - 1) })

const terrainBody = new CANNON.Body({ mass: 0 })
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
scene.fog = new THREE.Fog(0x88bb88, 20, 60) // color, near, far

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

const localPlayer = new Player(scene, world, true, terrainMesh, camera)

const remotePlayers = new Map() 
let myId = null
const cameraTarget = new THREE.Vector3()

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

function animate() {
  requestAnimationFrame(animate)
  world.step(1 / 60)

  //cannonDebug.update();

  for (const player of remotePlayers.values()) {
    player.update(world)
  }
  
  localPlayer.update(world)
  for (const p of remotePlayers.values()) p.update(world)

  drawRadar()
  checkNearbyPlayers()

  renderer.render(scene, camera)
}
animate()

let duelProcess = false;

const socket = new WebSocket("ws://localhost:8080")

socket.addEventListener('open', () => {
  console.log('WebSocket connection established.')

  setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const pos = localPlayer.getPosition()

      const data = {
        type: 'move',
        position: {
          x: pos.x,
          y: pos.y,
          z: pos.z
        }
      }
      socket.send(JSON.stringify(data))
    }
  }, 100)
})

let msgType;

socket.onmessage = (event) => {
  
}

socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  msgType = message.type

  if (message.type === 'init') {
    myId = message.id
    console.log("My ID:", myId)

  } else if (message.type === 'playerUpdate') {
    const { id, position } = message

    if (id === myId) return // ignore our own updates

    if (!remotePlayers.has(id)) {
      const newRemote = new Player(scene, world, false)
      newRemote.setPosition(position)
      newRemote.setColor(0xff0000)
      remotePlayers.set(id, newRemote)
    } else {
      const remote = remotePlayers.get(id)
      remote.setPosition(position)
    }

  } else if (message.type === 'disconnect') {
    const remote = remotePlayers.get(message.id)
    if (remote) {
      remote.destroy(scene, world)
      remotePlayers.delete(message.id)
      hideDuelPrompt()
    }
  } else if (message.type === 'duelInvite') {
    console.log('invitation recieved!')
    hideDuelPrompt()
    showDuelInvite(message.from)
  }
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


function checkNearbyPlayers() {
  const myPos = localPlayer.getPosition()
  for (const [id, player] of remotePlayers.entries()) {
    const dist = myPos.distanceTo(player.getPosition())
    if(msgType === 'duelInvite'){
      duelProcess = true;
    }
    if (dist < 5 && !duelProcess) {
      opponentId = id
      showDuelPrompt(id) 
    }
    else{
      hideDuelPrompt()
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
