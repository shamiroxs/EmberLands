import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { Player } from './modules/Player.js'
import { world } from './physics/physics.js'
import { loadImage, getHeightData } from './utils/heightmap.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Water } from 'three/examples/jsm/objects/Water2.js'
import { TextureLoader, Vector2, PlaneGeometry, RepeatWrapping, Color } from 'three'
import seedrandom from 'seedrandom'

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
water.position.y = 0.74
scene.add(water)

//Obstacles
const loader = new GLTFLoader()

const modelPaths = {
  tree: '/models/tree.glb',
  rock: '/models/rock.glb',
  bush: '/models/bush.glb',
  grass: '/models/grass.glb',
}

const rng = seedrandom("forest-map-v1")

scatterObstacles(heightData, size, resolution, 15, 40, rng)

const localPlayer = new Player(scene, world, true, terrainMesh, camera)

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

  //cannonDebug.update();

  for (const player of remotePlayers.values()) {
    player.update(world)
  }
  
  localPlayer.update(world)

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
  const textureLoader = new THREE.TextureLoader()

  const terrainTexture = await textureLoader.loadAsync('/textures/grass_texture.jpg')
  terrainTexture.wrapS = THREE.RepeatWrapping
  terrainTexture.wrapT = THREE.RepeatWrapping
  terrainTexture.repeat.set(10, 10) // Adjust to tile the texture

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
    map: terrainTexture,
    flatShading: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  scene.add(mesh)

  return { mesh, heightData, size, resolution }
}

function addObstacle(path, position, scale = 1) {
  loader.load(path, (gltf) => {
    const model = gltf.scene
    model.position.copy(position)
    model.scale.setScalar(scale)
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    scene.add(model)

    // Add physics (approximate with box shape)
    const bbox = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    bbox.getSize(size)

    const shape = new CANNON.Box(
      new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
    )

    const body = new CANNON.Body({ mass: 0 })
    body.addShape(shape)
    body.position.set(position.x, position.y + size.y / 2, position.z)
    world.addBody(body)
  })
}

// Place N objects randomly on terrain
async function scatterObstacles(heightData, size, resolution, heightScale = 15, count = 30, rng = Math.random) {
  for (let i = 0; i < count; i++) {
    const type = ['tree', 'rock', 'bush', 'grass'][Math.floor(rng() * 4)]
    const path = modelPaths[type]

    const originalX = (rng() - 0.5) * 100
    const originalZ = (rng() - 0.5) * 100

    const x = originalZ
    const z = -originalX

    // Sample Y from terrain
    const tx = Math.floor(((originalX + size / 2) / size) * (resolution - 1))
    const tz = Math.floor(((originalZ + size / 2) / size) * (resolution - 1))

    const index = tz * resolution + tx
    const y = heightData[index] * heightScale

    let scale_model = 1
    if (type === 'grass') scale_model = 0.5 + rng() * 0.2
    else if (type === 'rock') scale_model = 0.01 + rng() * 0.01
    else if (type === 'bush') scale_model = 5

    addObstacle(path, new THREE.Vector3(x, y, z), scale_model)
  }
}
