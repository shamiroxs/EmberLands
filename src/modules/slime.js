import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class Slime {
  constructor(scene, world, url, position, animationName = 'idle') {
    this.scene = scene
    this.world = world
    this.url = url
    this.position = position
    this.animationName = animationName
    this.mixer = null
    this.model = null

    this.loader = new GLTFLoader()
    this.body = null

    this.load()
    this.createBody()
  }

  load() {
    this.loader.load(this.url, (gltf) => {
      this.model = gltf.scene
      this.model.position.copy(this.position)
      if(this.url === '/models/slime2.glb'){
        this.model.scale.set(0.02, 0.02, 0.02)
      }
      else {this.model.scale.set(0.6, 0.6, 0.6)}
      this.scene.add(this.model)

      this.mixer = new THREE.AnimationMixer(this.model)
      const clip = gltf.animations.find(a => a.name.toLowerCase().includes(this.animationName))
      if (clip) {
        const action = this.mixer.clipAction(clip)
        action.play()
      }
    })
  }

  createBody() {
    let radius;
    if(this.url === '/models/slime2.glb'){
        radius = 0.3
    } else {
        radius = 0.6
    }

    const shape = new CANNON.Sphere(radius)
    this.body = new CANNON.Body({
      mass: 0.2, 
      shape,
      position: new CANNON.Vec3(this.position.x, this.position.y+2, this.position.z),
    })
    this.body.linearDamping = 0.9
    this.world.addBody(this.body)
  }

  update(deltaTime) {
    if (this.mixer) this.mixer.update(deltaTime)

    if (this.model && this.body) {
        const offsetY = 0.4; 
        this.model.position.copy(this.body.position)
        this.model.position.y -= offsetY
    }

    if (this.model) {
      this.model.position.x += 0.005 * Math.sin(Date.now() * 0.001 + this.position.z)
    }
  }
}
