import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { world } from '/src/physics/physics.js'
import { TextureLoader, Vector2, PlaneGeometry, RepeatWrapping, Color } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadImage, getHeightData } from '/src/utils/heightmap.js'

export async function createTerrain(scene) {
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

export function buildHeightMatrix(heightData, resolution) {
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

const loader = new GLTFLoader()

const modelPaths = {
  tree: '/models/tree.glb',
  rock: '/models/rock.glb',
  bush: '/models/bush.glb',
  grass: '/models/grass.glb',
}


function addObstacle(scene, path, position, scale = 1, obstacles) {
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

    obstacles.push(position.clone());
  })
}

// Place N objects randomly on terrain
export async function scatterObstacles(scene, heightData, size, resolution, heightScale = 15, count = 30, rng = Math.random, obstacles) {
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

    addObstacle(scene, path, new THREE.Vector3(x, y, z), scale_model, obstacles)
  }
}