import * as THREE from 'three'
import * as CANNON from 'cannon-es'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'; 
import { getDuelState } from './duelManager.js'
import { isMobileDevice, onDuelEnd, sendAttemptAttack, sendDuelEnd, sendHealthUpdate } from '../main.js';

export class Player {
  constructor(scene, world, isLocal = true, terrainMesh = null, camera = null, playerMaterial = null, id=null) {
    this.isLocal = isLocal
    this.terrainMesh = terrainMesh
    this.camera = camera
    this.id = id

    this.isJumping = false
    this.jumpGracePeriod = 1
    this.jumpTimer = 0

    this.lockedState = null;
    this.lockTimer = 0;
    this.lockDuration = 0;  
    
    this.attackIntent = null  
    this.attackCooldown = false
    this.attackRange = 1.3

    this.mouseButtonsHeld = {
      left: false,
      right: false
    };    

    this.touchControls = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      block: false,
      punch: false,
      kick: false
    }    
    
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
      { name: 'jump', url: '/models/character/jump.glb' },
      { name: 'blocking', url: '/models/character/blocking.glb' },
      { name: 'punching', url: '/models/character/punching.glb' },
      { name: 'kicking', url: '/models/character/kicking.glb' },
      { name: 'taking_punch', url: '/models/character/taking_punch.glb' },
      { name: 'victory', url: '/models/character/victory.glb' },
      { name: 'defeated', url: '/models/character/defeated.glb' }
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
        ring.scale.set(0.8, 0.8, 0.8)
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

      if(!isLocal){
        this.healthBar = this.createHealthBar()
        this.mesh.add(this.healthBar)

        this.healthBar.position.set(0, 2, 0)   
      }
    })

    this.playerMaterial = playerMaterial || new CANNON.Material('playerMaterial');

    this.body = new CANNON.Body({
      mass: isLocal ? 1 : 0,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.3, 0.3)),
      position: new CANNON.Vec3(spawnX, spawnY, spawnZ),
      material: this.playerMaterial,
    })
    world.addBody(this.body)

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      block: false,
    }

    this.canJump = false
    if (isLocal) this.setupControls()

    this.currentPosition = new THREE.Vector3()
    this.targetPosition = new THREE.Vector3()
    this.lerpAlpha = 0.1

    this.currentState = 'idle'
    this.health = 100
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

    let touchStartX = null
    const container = document.getElementById('thumbstick-container')
    const knob = document.getElementById('thumbstick-knob')
    let origin = { x: 0, y: 0 }
    let active = false

    const onMouseMove = (e) => {
      simulateMouseMove(e);
    }

    const simulateMouseMove = (e) => {

      let sensitivity = 0.004
      if(!isMobileDevice()){
        if (!this.pointerLocked) return
        sensitivity = 0.002
      }

      this.rotation.yaw -= e.movementX * sensitivity
      this.rotation.pitch -= e.movementY * sensitivity
    
      this.rotation.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.pitch))
    
      this.updateCameraRotation()
      this.mesh.rotation.y = this.rotation.yaw + Math.PI
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX
      }
    }
    
    const onTouchMove = (e) => {
      if (touchStartX === null || e.touches.length !== 1) return
    
      const touchCurrentX = e.touches[0].clientX
      const deltaX = touchCurrentX - touchStartX
    
      simulateMouseMove({ movementX: deltaX, movementY: 0 })
    
      touchStartX = touchCurrentX
    }
    
    const onTouchEnd = () => {
      touchStartX = null
    }
    
    const resetThumbstick = () => {
      knob.style.left = '40px'
      knob.style.top = '40px'
      this.keys.forward = false
      this.keys.backward = false
      this.keys.left = false
      this.keys.right = false
    }
    
    const updateDirection = (dx, dy) => {
      this.keys.forward = dy < -20
      this.keys.backward = dy > 20
      this.keys.left = dx < -20
      this.keys.right = dx > 20
    }
    
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      active = true
      const touch = e.touches[0]
      origin.x = touch.clientX
      origin.y = touch.clientY
    })
    
    container.addEventListener('touchmove', (e) => {
      if (!active || e.touches.length !== 1) return
      const touch = e.touches[0]
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
    
      knob.style.left = `${40 + dx}px`
      knob.style.top = `${40 + dy}px`
    
      updateDirection(dx, dy)
    })
    
    container.addEventListener('touchend', () => {
      active = false
      resetThumbstick()
    })
    

    window.addEventListener('mousemove', onMouseMove)


    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.forward = true;
      if (key === 's') this.keys.backward = true;
      if (key === 'a') this.keys.left = true;
      if (key === 'd') this.keys.right = true;
      if (e.code === 'Space') this.keys.jump = true;
      if (e.code === 'ShiftLeft') this.keys.block = true;
    });
    
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w') this.keys.forward = false;
      if (key === 's') this.keys.backward = false;
      if (key === 'a') this.keys.left = false;
      if (key === 'd') this.keys.right = false;
      if (e.code === 'Space') this.keys.jump = false;
      if (e.code === 'ShiftLeft') this.keys.block = false;
    });

    // Mouse buttons
    window.addEventListener('mousedown', (e) => {
      if (!getDuelState().active) return;  

      if(!isMobileDevice()){
        if (!this.pointerLocked) return;
      }

      if (e.button === 2) { 
        this.mouseButtonsHeld.right = true;

        if (this.attackCooldown) return
        this.attackIntent = 'punch'

        this.playAction('punching', 1);
        this.currentState = 'punching'
      } else if (e.button === 0) {
        this.mouseButtonsHeld.left = true;

        if (this.attackCooldown) return
        this.attackIntent = 'kick'

        this.playAction('kicking', 1);
        this.currentState = 'kicking'
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!getDuelState().active || !this.pointerLocked) return;
    
      if (e.button === 0 && this.currentState === 'kicking') {
        this.mouseButtonsHeld.left = false;
        this.playAction('idle'); 
        this.currentState = 'idle';
      }
    
      if (e.button === 2 && this.currentState === 'punching') {
        this.mouseButtonsHeld.right = false;
        this.playAction('idle');
        this.currentState = 'idle';
      }
    });

    const canvas = document.getElementById('game')

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock()
      
    })
  
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas
    })

    canvas.addEventListener('touchstart', onTouchStart)
    canvas.addEventListener('touchmove', onTouchMove)
    canvas.addEventListener('touchend', onTouchEnd)

    const setupTouchButton = (id, key) => {
      const btn = document.getElementById(id)
      if (!btn) return
    
      btn.addEventListener('touchstart', e => {
        e.preventDefault()
        this.touchControls[key] = true
      }, { passive: false })
    
      btn.addEventListener('touchend', e => {
        e.preventDefault()
        this.touchControls[key] = false
      }, { passive: false })
    }
    
    setupTouchButton('btn-up', 'up')
    setupTouchButton('btn-left', 'left')
    setupTouchButton('btn-right', 'right')
    setupTouchButton('btn-jump', 'jump')
    setupTouchButton('btn-block', 'block')   

  }

  attemptAttack() {
    if (!getDuelState().active || this.attackCooldown) return 

    const opponentId = getDuelState().players.find(id => id !== this.id && id !== null)
    const opponent = window.remotePlayers?.get(opponentId)
    if (!opponent) return
  
    const myPos = this.getPosition()
    const oppPos = opponent.getPosition()
    const distance = myPos.distanceTo(oppPos)
  
    if (distance < this.attackRange) {
      const isBlocking = opponent.currentState === 'blocking'
      const damage = this.attackIntent === 'kick' ? 15 : 10
      const finalDamage = isBlocking ? damage / 2 : damage
  
      // Send damage via WebSocket
      sendAttemptAttack();
    }
  
    // Set cooldown
    this.attackCooldown = true
    setTimeout(() => {
      this.attackCooldown = false
    }, 1000)
  }
  

  playAction(name, lockDuration = 0) {
    if (!this.actions[name] || this.activeAction === this.actions[name]) return;
  
    const nextAction = this.actions[name];
    if (this.activeAction) {
      this.activeAction.stop();
    }
  
    nextAction.reset().play();
    this.activeAction = nextAction;
  
    if (lockDuration > 0) {
      this.lockedState = name;
      this.lockDuration = lockDuration;
      this.lockTimer = 0;
    }
  }
  

  createHealthBar() {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 16
  
    const context = canvas.getContext('2d')
    context.fillStyle = 'black'
    context.fillRect(0, 0, 128, 16)
  
    context.fillStyle = 'lime'
    context.fillRect(0, 0, 128, 16)
  
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(1.5, 0.2, 1)  // Size in world units
  
    sprite.userData.canvas = canvas
    sprite.userData.context = context
    sprite.userData.texture = texture
    sprite.visible = false
  
    return sprite
  }
  

  takeDamage(amount) {

    if(this.currentState === 'blocking') return;

    this.health = Math.max(0, this.health - amount)

    this.playAction('taking_punch', 0.31)
    this.currentState = 'taking_punch'
  
    if (this.health === 0) {
      if (typeof onDuelEnd === 'function') {
        onDuelEnd(this.id || myId)
        sendDuelEnd(this.id || myId)
      }
    }

    if (this.healthBar) {
      const ctx = this.healthBar.userData.context
      ctx.clearRect(0, 0, 128, 16)
    
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, 128, 16)
    
      const healthWidth = (this.health / 100) * 128
      ctx.fillStyle = this.health > 40 ? 'lime' : this.health > 20 ? 'orange' : 'red'
      ctx.fillRect(0, 0, healthWidth, 16)
    
      this.healthBar.userData.texture.needsUpdate = true
    }

    if (!this.id || this.isLocal) {
      const bar = document.getElementById('localHealthBar')
      if (bar) {
        bar.style.width = `${this.health}%`
        bar.style.background = this.health > 40 ? 'limegreen' : this.health > 20 ? 'orange' : 'red'
      }
    }
    
    sendHealthUpdate(this.id, this.health)
  }  

  update(world, deltaTime) {
    const duelState = getDuelState()
    if (!this.ready || !this.mesh) return

    if (this.isLocal) {
      const speed = 5
      const jumpForce = 7
      const vel = this.body.velocity

      //Allow rotation before lockstate
      if (this.camera) {
        const cameraOffset = new THREE.Vector3(0, 2.5, 2.5) 
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

      //lock animations actions on mouse down
      if (this.lockedState) {
        this.lockTimer += deltaTime;
        if (this.lockTimer < this.lockDuration) {
          this.mixer.update(deltaTime);
          return;
        } else {
          this.lockedState = null;
          const attackStillHeld = (this.attackIntent === 'punch' && this.mouseButtonsHeld.right) || (this.attackIntent === 'kick' && this.mouseButtonsHeld.left);


          if (this.attackIntent && attackStillHeld) {
            this.attemptAttack()
            this.attackIntent = null
          }
        }
      }

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
      if (this.touchControls.forward || this.keys.forward) moveDir.add(forward)
      if (this.touchControls.backward || this.keys.backward) moveDir.sub(forward)
      if (this.touchControls.left || this.keys.left) moveDir.sub(right)
      if (this.touchControls.right || this.keys.right) moveDir.add(right)
      

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

      if (getDuelState().active && (this.touchControls.block || this.keys.block)) {
        if (this.currentState !== 'blocking') {
          this.playAction('blocking');
          this.currentState = 'blocking';
        }
      } else {
        if (!this.isJumping && isMoving && this.currentState !== 'walking') {
          this.playAction('walking')
          this.currentState = 'walking'
        } else if (this.lockedState == null && !this.isJumping && !isMoving && this.currentState !== 'idle') {
          this.playAction('idle')
          this.currentState = 'idle'
        }
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

      if ((this.touchControls.jump || this.keys.jump) && this.canJump && !this.isJumping) {
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

    if(!this.isLocal){
      this.healthBar.visible = duelState.active && duelState.players.includes(this.id)
    }

    //animation
    if (this.mixer) {
      this.mixer.update(deltaTime)
    }    

    if (this.healthBar && this.camera) {
      this.healthBar.lookAt(this.camera.position)
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
