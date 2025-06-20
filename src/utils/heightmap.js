export function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.src = url
    })
  }
  
  export function getHeightData(img, size = 512) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
  
    const imgData = ctx.getImageData(0, 0, size, size).data
    const data = []
    for (let i = 0; i < imgData.length; i += 4) {
      const avg = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3
      data.push(avg / 255) // normalize to 0–1
    }
    return data
  }
  