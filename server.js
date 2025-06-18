import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

const wss = new WebSocketServer({ port: 8080 })
const clients = new Map()

wss.on('connection', (ws) => {
  const clientId = uuidv4()
  clients.set(clientId, ws)

  ws.send(JSON.stringify({ type: 'init', id: clientId }))

  ws.on('message', (message) => {
    let data
    try {
      data = JSON.parse(message)
    } catch (err) {
      return
    }

    // Broadcast 
    if (data.type === 'move') {
      const msg = JSON.stringify({
        type: 'playerUpdate',
        id: clientId,
        position: data.position,
      })

      for (const [id, client] of clients.entries()) {
        if (client !== ws && client.readyState === 1) {
          client.send(msg)
        }
      }
    }
  })

  ws.on('close', () => {
    clients.delete(clientId)
    const disconnectMsg = JSON.stringify({
      type: 'disconnect',
      id: clientId,
    })
    for (const client of clients.values()) {
      if (client.readyState === 1) client.send(disconnectMsg)
    }
  })
})
