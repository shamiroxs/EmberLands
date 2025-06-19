import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { Player } from './modules/Player.js'
import { world } from './physics/physics.js'
import { loadImage, getHeightData } from './utils/heightmap.js'

import cannonDebugger from 'cannon-es-debugger'

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

const localPlayer = new Player(scene, world, true, terrainMesh)

const remotePlayers = new Map() 
let myId = null
const cameraTarget = new THREE.Vector3()

function buildHeightMatrix(heightData, resolution) {
  const matrix = []
  for (let y = 0; y < resolution; y++) {
    const row = []
    for (let x = 0; x < resolution; x++) {
      row.push(heightData[y * resolution + x] * 15) // same heightScale
    }
    matrix.push(row)
  }
  return matrix
}


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


// Terrain
async function createTerrain(scene) {
  const img = await loadImage('/terrain.png')
  const resolution = 512
  const size = 100
  const heightScale = 15

  const heightData = getHeightData(img, resolution)
  const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1)
  geometry.rotateX(-Math.PI / 2)
  geometry.rotateY(Math.PI / 2)

  for (let i = 0; i < geometry.attributes.position.count; i++) {
    const y = heightData[i] * heightScale
    geometry.attributes.position.setY(i, y)
  }

  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    color: 0x556633,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  scene.add(mesh)

  return { mesh, heightData, size, resolution }
}
