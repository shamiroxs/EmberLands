import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

let mixer = null 
let arenaBody = null
let arenaGroup = null
let wallBodies = []

/**
 * Summons a magical duel arena at the given center.
 * @param {THREE.Scene} scene - The Three.js scene.
 * @param {CANNON.World} world - The Cannon physics world.
 * @param {THREE.Vector3} center - Center point of the arena.
 * @returns {Promise<Object>} Arena metadata: { center, radius, mixer }
 */
export async function summonArena(scene, world, center) {
    //const arenaSize = 20
    arenaGroup = new THREE.Group()

    const textureLoader = new THREE.TextureLoader()
    const ringTexture = textureLoader.load('/textures/magic_ring.png')

    //ringTexture.center.set(0.5, 0.5);
  
    const loader = new GLTFLoader()
  
    const gltf = await loader.loadAsync('/models/magic_ring.glb')
  
    const ring = gltf.scene
    ring.position.copy(center)
    ring.position.y = center.y - 0.3
    ring.scale.set(3, 3, 3) 
    ring.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true

        obj.material = new THREE.MeshStandardMaterial({
            map: ringTexture,
            transparent: true,
            opacity: 0.7
        })
      }
    })
  
    mixer = new THREE.AnimationMixer(ring)
    gltf.animations.forEach(clip => mixer.clipAction(clip).play())
  
    arenaGroup.add(ring)
    scene.add(arenaGroup)
  
    const arenaRadius = 8;
    const wallHeight = 6;
    const wallThickness = 0.1;
    const segmentCount = 64; 

    for (let i = 0; i < segmentCount; i++) {
      const angle = (i / segmentCount) * Math.PI * 2;

      const x = center.x + arenaRadius * Math.cos(angle);
      const z = center.z + arenaRadius * Math.sin(angle);

      const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, 0.5));
      const wallBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        shape: wallShape,
        collisionFilterGroup: 1,
        collisionFilterMask: 1,
      });

      wallBody.position.set(x, center.y - 2 + wallHeight / 2, z);

      // Rotate each wall segment to face outward
      const quat = new CANNON.Quaternion();
      quat.setFromEuler(0, angle, 0);
      wallBody.quaternion.copy(quat);

      world.addBody(wallBody);
      wallBodies.push(wallBody)
    }

  
 //radius: arenaSize,
    return {
      center: center.clone(),
      mixer
    }
}
  

/**
 * Teleports a player to a position inside the arena.
 * @param {Player} player - The player object with a setPosition method.
 * @param {THREE.Vector3} center - Arena center.
 * @param {number} offsetX - Lateral offset from center.
 */
export function teleportToArena(player, center, offsetX = 0) {
  const newPos = new THREE.Vector3(center.x + offsetX, center.y + 2, center.z)
  player.setPosition(newPos)
}

//Removes the arena from the scene.
export function destroyArena(scene, world) {
  if (arenaGroup) {
    scene.remove(arenaGroup)
    arenaGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    arenaGroup = null
  }

  if (wallBodies.length > 0) {
    wallBodies.forEach(body => world.removeBody(body))
    wallBodies = []
  }

  if (arenaBody) {
    world.removeBody(arenaBody)
    arenaBody = null
  }
}

/**
 * @returns {Object} center and radius, or null if no arena exists.
 */
export function getArenaBounds() {
  if (!arenaGroup) return null
  const floor = arenaGroup.children.find(child => child.geometry instanceof THREE.CircleGeometry)
  
  return {
    center: floor?.position.clone() || new THREE.Vector3(),
    radius: 20
  }
}
