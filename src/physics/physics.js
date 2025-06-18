import * as CANNON from 'cannon-es'

export const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
})
world.broadphase = new CANNON.NaiveBroadphase()
world.solver.iterations = 10
