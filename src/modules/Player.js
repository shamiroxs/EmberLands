import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export class Player {
  constructor(scene, world, isLocal = true, terrainMesh = null, camera = null) {
    this.isLocal = isLocal
    this.terrainMesh = terrainMesh
    this.camera = camera

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

  updateCameraRotation() {
    if (!this.camera) return
  
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.rotation.yaw
    this.camera.rotation.x = this.rotation.pitch
  }
  

  setupControls() {
    
    this.pointerLocked = false
    this.rotation = { yaw: 0, pitch: 0 }

    const onMouseMove = (e) => {
      if (!this.pointerLocked) return

      const sensitivity = 0.002
      this.rotation.yaw -= e.movementX * sensitivity
      this.rotation.pitch -= e.movementY * sensitivity

      this.rotation.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.pitch))

      this.updateCameraRotation()
      this.mesh.rotation.y = this.rotation.yaw

    }

    window.addEventListener('mousemove', onMouseMove)


    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.forward = true;
      if (key === 's') this.keys.backward = true;
      if (key === 'a') this.keys.left = true;
      if (key === 'd') this.keys.right = true;
      if (e.code === 'Space') this.keys.jump = true;
    });
    
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.forward = false;
      if (key === 's') this.keys.backward = false;
      if (key === 'a') this.keys.left = false;
      if (key === 'd') this.keys.right = false;
      if (e.code === 'Space') this.keys.jump = false;
    });
    

    const canvas = document.getElementById('game')

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock()
      
    })
  
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas
    })
  }

  update(world) {
    if (this.isLocal) {
      const speed = 5
      const jumpForce = 5
      const vel = this.body.velocity

      //movement direction
      const forward = new THREE.Vector3()
      this.camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()

      const right = new THREE.Vector3()
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

      const moveDir = new THREE.Vector3()
      if (this.keys.forward) moveDir.add(forward)
      if (this.keys.backward) moveDir.sub(forward)
      if (this.keys.left) moveDir.sub(right)
      if (this.keys.right) moveDir.add(right)

      moveDir.normalize()

      const pos = this.body.position;
      const maxDist = 52; 

      const nextX = pos.x + moveDir.x * speed
      const nextZ = pos.z + moveDir.z * speed

      vel.x = (Math.abs(nextX) < maxDist) ? moveDir.x * speed : 0
      vel.z = (Math.abs(nextZ) < maxDist) ? moveDir.z * speed : 0

      if (this.keys.jump && this.canJump) {
        vel.y = jumpForce
        this.canJump = false
      }

      if (this.camera) {
        const cameraOffset = new THREE.Vector3(0, 2, 5) 
        const playerDirection = new THREE.Vector3()
        this.camera.getWorldDirection(playerDirection)
      
        const offset = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.yaw)
      
        this.camera.position.copy(this.body.position).add(offset)
      
        const bodyPosition = new THREE.Vector3(
          this.body.position.x,
          this.body.position.y,
          this.body.position.z
        )
        
        this.camera.lookAt(bodyPosition.clone().add(new THREE.Vector3(0, 2, 0)))
        
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
