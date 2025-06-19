import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { Player } from './modules/Player.js'
import { world } from './physics/physics.js'


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

const localPlayer = new Player(scene, world, true)

const remotePlayers = new Map() 
//const remotePlayers = {} // id: { mesh, position }
let myId = null
const cameraTarget = new THREE.Vector3()


function animate() {
  requestAnimationFrame(animate)
  world.step(1 / 60)

  for (const player of remotePlayers.values()) {
    player.update(world)
  }
  
  localPlayer.update(world)

  cameraTarget.copy(localPlayer.getPosition())
  camera.position.set(cameraTarget.x, cameraTarget.y + 2, cameraTarget.z + 5)
  camera.lookAt(cameraTarget)

  renderer.render(scene, camera)
}
animate()


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


socket.onmessage = (event) => {
  const message = JSON.parse(event.data)

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
    }
  }
}


