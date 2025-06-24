import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'; 

export class Player {
  constructor(scene, world, isLocal = true, terrainMesh = null, camera = null) {
    this.isLocal = isLocal
    this.terrainMesh = terrainMesh
    this.camera = camera

    this.isJumping = false
    this.jumpGracePeriod = 1
    this.jumpTimer = 0


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

    //character adding
    this.actions = {}
    this.activeAction = null
    this.mixer = null

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    const animations = [
      { name: 'idle', url: '/models/character/idle.glb' },
      { name: 'walking', url: '/models/character/walking.glb' },
      { name: 'jump', url: '/models/character/jump.glb' }
    ]

    const promises = animations.map(anim => 
      new Promise(resolve => {
        loader.load(anim.url, (gltf) => resolve({ name: anim.name, gltf }))
      })
    )

    this.ready = false
    Promise.all(promises).then(results => {
      const idleResult = results.find(r => r.name === 'idle')
      this.mesh = idleResult.gltf.scene
      this.mesh.scale.set(1, 1, 1)
      this.mesh.position.set(spawnX, spawnY, spawnZ)
      this.mesh.traverse(child => {
        if (child.isMesh) child.castShadow = true
      })

      if (!isLocal) {
       
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.6, 0.1, 16, 100),
          new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.5
          })
        )
        //ring.scale.set(0.8, 0.8, 0.8)
        ring.position.y = 0.8
        ring.position.z = -0.5
        this.mesh.add(ring)        
      }

      scene.add(this.mesh)

      this.mixer = new THREE.AnimationMixer(this.mesh)

      results.forEach(({ name, gltf }) => {
        const clip = gltf.animations[0]
        this.actions[name] = this.mixer.clipAction(clip)
      })

      this.playAction('idle')
      this.currentState = 'idle'

      this.ready = true;

      if (this._queuedRemoteState) {
        this.setRemoteState(this._queuedRemoteState)
        delete this._queuedRemoteState
      }       
      })
    
    this.body = new CANNON.Body({
        mass: isLocal ? 1 : 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)),
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

    this.currentState = 'idle'
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
      this.mesh.rotation.y = this.rotation.yaw + Math.PI

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

  playAction(name) {
    if (!this.actions[name] || this.activeAction === this.actions[name]) return
  
    const nextAction = this.actions[name]
    if (this.activeAction) {
      this.activeAction.stop()
    }
    nextAction.play()
    this.activeAction = nextAction
  }
  

  update(world, deltaTime) {
    if (!this.ready || !this.mesh) return
    if (this.isLocal) {
      const speed = 5
      const jumpForce = 7
      const vel = this.body.velocity

      if (this.isJumping) {
        this.jumpTimer += deltaTime
      }

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

      //rotate player
      if (moveDir.lengthSq() > 0) {
        const moveYaw = Math.atan2(moveDir.x, moveDir.z)
        this.mesh.rotation.y = moveYaw
      } else {
        //idle, then look forward
        this.mesh.rotation.y = this.rotation.yaw + Math.PI
      }
      const pos = this.body.position;
      const maxDist = 52; 

      const nextX = pos.x + moveDir.x * speed
      const nextZ = pos.z + moveDir.z * speed

      vel.x = (Math.abs(nextX) < maxDist) ? moveDir.x * speed : 0
      vel.z = (Math.abs(nextZ) < maxDist) ? moveDir.z * speed : 0   

      const isMoving = moveDir.lengthSq() > 0

      if (!this.isJumping && isMoving && this.currentState !== 'walking') {
        this.playAction('walking')
        this.currentState = 'walking'
      } else if (!this.isJumping && !isMoving && this.currentState !== 'idle') {
        this.playAction('idle')
        this.currentState = 'idle'
      }

      if (this.camera) {
        const cameraOffset = new THREE.Vector3(0, 2.5, 2) 
        const playerDirection = new THREE.Vector3()
        this.camera.getWorldDirection(playerDirection)
      
        const offset = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.yaw)
      
        this.camera.position.copy(this.body.position).add(offset)
      
        const bodyPosition = new THREE.Vector3(
          this.body.position.x,
          this.body.position.y,
          this.body.position.z
        )
        
        this.camera.lookAt(bodyPosition.clone().add(new THREE.Vector3(0, 1.5, 0)))
        
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

      this.canJump = result.hasHit
      this.mesh.position.copy(this.body.position).add(new THREE.Vector3(0, -0.5, 0)) 

      if (this.keys.jump && this.canJump && !this.isJumping) {
        vel.y = jumpForce
        this.canJump = false
      
        this.playAction('jump')
        this.currentState = 'jump'
        this.isJumping = true
        this.jumpTimer = 0
      }      

      // Check landing
      if (this.isJumping && this.canJump && this.jumpTimer > this.jumpGracePeriod) {
        this.isJumping = false
        const isMoving = moveDir.lengthSq() > 0
        if (isMoving) {
          this.playAction('walking')
          this.currentState = 'walking'
        } else {
          this.playAction('idle')
          this.currentState = 'idle'
        }
      }      

    } else {
      this.currentPosition.lerp(this.targetPosition, this.lerpAlpha)
      this.body.position.copy(this.currentPosition)
      this.mesh.position.copy(this.currentPosition).add(new THREE.Vector3(0, -0.5, 0))
    }

    //animation
    if (this.mixer) {
      this.mixer.update(deltaTime)
    }    
  }

  setPosition(pos) {
    if (!this.mesh) return
    if (this.isLocal) {
      this.body.position.set(pos.x, pos.y, pos.z)
      this.mesh.position.copy(this.body.position).add(new THREE.Vector3(0, -0.5, 0)) 
    } else {
      this.targetPosition.set(pos.x, pos.y, pos.z)

      if (this.currentPosition.lengthSq() === 0) {
        this.currentPosition.copy(this.targetPosition)
        this.body.position.copy(this.currentPosition)
        this.mesh.position.copy(this.currentPosition).add(new THREE.Vector3(0, -0.5, 0))
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

  getForwardVector() {
    const forward = new THREE.Vector3(-1, 0, 0)
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.rotation.yaw)
    return forward.normalize()
  }

  getRotationY() {
    return this.mesh?.rotation.y || 0
  }
  
  getState() {
    return this.currentState || 'idle'
  }
  

  setState(state) {
    if (this.currentState === state || !this.actions[state]) return
    this.playAction(state)
    this.currentState = state
  } 

  setRemoteState({ position, rotationY, state }) {
    if (!this.ready) {
      this._queuedRemoteState = { position, rotationY, state }
      return
    }

    this.setPosition(position)
  
    if (this.mesh) {
      this.mesh.rotation.y = rotationY
    }
  
    this.setState(state)
  }
  
  
}
