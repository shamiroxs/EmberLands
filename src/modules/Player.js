import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export class Player {
  constructor(scene, world, isLocal = true, terrainMesh = null) {
    this.isLocal = isLocal
    this.terrainMesh = terrainMesh

    const spawnX = 0
    const spawnZ = 0
    let spawnY = 15
    if (terrainMesh) {
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(spawnX, 100, spawnZ),
        new THREE.Vector3(0, -1, 0)
      )
      const intersects = raycaster.intersectObject(terrainMesh)
      if (intersects.length > 0) {
        spawnY = intersects[0].point.y + 5
      }
    }

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: isLocal ? 0x00ff00 : 0xff0000 })
    )
    this.mesh.castShadow = true
    this.mesh.position.set(spawnX, spawnY, spawnZ)
    scene.add(this.mesh)

    this.body = new CANNON.Body({
        mass: isLocal ? 1 : 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
      position: new CANNON.Vec3(spawnX, spawnY, spawnZ),
    })
    world.addBody(this.body)

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
    }

    this.canJump = false
    if (isLocal) this.setupControls()

    this.currentPosition = new THREE.Vector3()
    this.targetPosition = new THREE.Vector3()
    this.lerpAlpha = 0.1
  }

  setupControls() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'w') this.keys.forward = true
      if (e.key === 's') this.keys.backward = true
      if (e.key === 'a') this.keys.left = true
      if (e.key === 'd') this.keys.right = true
      if (e.code === 'Space') this.keys.jump = true
    })

    window.addEventListener('keyup', (e) => {
      if (e.key === 'w') this.keys.forward = false
      if (e.key === 's') this.keys.backward = false
      if (e.key === 'a') this.keys.left = false
      if (e.key === 'd') this.keys.right = false
      if (e.code === 'Space') this.keys.jump = false
    })
  }

  update(world) {
    if (this.isLocal) {
      const speed = 5
      const jumpForce = 5
      const vel = this.body.velocity

      vel.x = 0
      vel.z = 0

      const pos = this.body.position;
      const maxDist = 49; 
  
      const moveX = (this.keys.left ? -1 : 0) + (this.keys.right ? 1 : 0);
      const moveZ = (this.keys.forward ? -1 : 0) + (this.keys.backward ? 1 : 0);
  
      if (Math.abs(pos.x) < maxDist || (pos.x < -maxDist && moveX > 0) || (pos.x > maxDist && moveX < 0)) {
        vel.x = moveX * speed;
      }
  
      if (Math.abs(pos.z) < maxDist || (pos.z < -maxDist && moveZ > 0) || (pos.z > maxDist && moveZ < 0)) {
        vel.z = moveZ * speed;
      }

      if (this.keys.jump && this.canJump) {
        vel.y = jumpForce
        this.canJump = false
      }

      // Ground check
      const ray = new CANNON.Ray()
      ray.from.copy(this.body.position)
      ray.to.set(
        this.body.position.x,
        this.body.position.y - 1.5,
        this.body.position.z
      )

      const result = new CANNON.RaycastResult()

      const otherBodies = world.bodies.filter(body => body !== this.body)

      ray.intersectBodies(otherBodies, result)

      if (result.hasHit) {
        this.canJump = true
      }
      else { this.canJump = false}
      this.mesh.position.copy(this.body.position)

    } else {
      this.currentPosition.lerp(this.targetPosition, this.lerpAlpha)
      this.body.position.copy(this.currentPosition)
      this.mesh.position.copy(this.currentPosition)
    }
  }

  setPosition(pos) {
    if (this.isLocal) {
      this.body.position.set(pos.x, pos.y, pos.z)
      this.mesh.position.copy(this.body.position)
    } else {
      this.targetPosition.set(pos.x, pos.y, pos.z)

      if (this.currentPosition.lengthSq() === 0) {
        this.currentPosition.copy(this.targetPosition)
        this.body.position.copy(this.currentPosition)
        this.mesh.position.copy(this.currentPosition)
      }
    }
  }

  getPosition() {
    return this.body.position
  }

  setColor(hex) {
    this.mesh.material.color.setHex(hex)
  }

  destroy(scene, world) {
    scene.remove(this.mesh)
    world.removeBody(this.body)
  }
}
