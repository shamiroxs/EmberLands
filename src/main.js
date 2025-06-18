import * as THREE from 'three'
import { world } from './physics/physics.js'
import * as CANNON from 'cannon-es'

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




// Player 
const playerMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
)
playerMesh.position.set(0, 5, 0)
scene.add(playerMesh)

const playerBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  position: new CANNON.Vec3(0, 5, 0),
})
world.addBody(playerBody)



const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'w') keys.forward = true
  if (e.key === 's') keys.backward = true
  if (e.key === 'a') keys.left = true
  if (e.key === 'd') keys.right = true
  if (e.code === 'Space') keys.jump = true
})

window.addEventListener('keyup', (e) => {
  if (e.key === 'w') keys.forward = false
  if (e.key === 's') keys.backward = false
  if (e.key === 'a') keys.left = false
  if (e.key === 'd') keys.right = false
  if (e.code === 'Space') keys.jump = false
})

const remotePlayers = {} // id: { mesh, position }
let myId = null
const moveSpeed = 5
const jumpForce = 5
let canJump = false

const cameraTarget = new THREE.Vector3()


function animate() {
  requestAnimationFrame(animate)

  // Movement input
  const velocity = new CANNON.Vec3(0, 0, 0)
  if (keys.forward) velocity.z -= moveSpeed
  if (keys.backward) velocity.z += moveSpeed
  if (keys.left) velocity.x -= moveSpeed
  if (keys.right) velocity.x += moveSpeed

  playerBody.velocity.x = velocity.x
  playerBody.velocity.z = velocity.z

  // Jump
  if (keys.jump && canJump) {
    playerBody.velocity.y = jumpForce
    canJump = false
  }
 
  world.step(1 / 60)
  playerMesh.position.copy(playerBody.position)

  const ray = new CANNON.Ray()

ray.from.copy(playerBody.position) // start at player
ray.to.set(
  playerBody.position.x,
  playerBody.position.y - 1.5, // cast ray down 1.5 units
  playerBody.position.z
)

ray.intersectBodies([groundBody])

if (ray.result?.hasHit && ray.result.distance < 1.1) {
  canJump = true
}

cameraTarget.set(
  playerBody.position.x,
  playerBody.position.y,
  playerBody.position.z
)
camera.position.set(
  playerBody.position.x,
  playerBody.position.y + 2,
  playerBody.position.z + 5
)
camera.lookAt(cameraTarget)

renderer.render(scene, camera)
}
animate()


const socket = new WebSocket("ws://localhost:8080")

socket.addEventListener('open', () => {
  console.log('WebSocket connection established.')

  setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      const data = {
        type: 'move',
        position: {
          x: playerBody.position.x,
          y: playerBody.position.y,
          z: playerBody.position.z
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

    if (!remotePlayers[id]) {
      // Create remote player cube
      const remoteMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      )
      remoteMesh.position.set(position.x, position.y, position.z)
      scene.add(remoteMesh)

      remotePlayers[id] = { mesh: remoteMesh, targetPos: position }
    } else {
      remotePlayers[id].targetPos = position
    }

  } else if (message.type === 'disconnect') {
    if (remotePlayers[message.id]) {
      scene.remove(remotePlayers[message.id].mesh)
      delete remotePlayers[message.id]
    }
  }
}

