// EXPORTS: compressImage, readFileAsDataURL

/**
 * 将 File/Blob 压缩为 base64 dataURL，最大边 maxSize，质量 quality
 * 用于头像上传、评价图片等本地持久化场景
 */
export function compressImage(
  input: File | Blob | string,
  maxSize = 800,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const loadImg = (src: string) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        } catch {
          resolve(src)
        }
      }
      img.onerror = reject
      img.src = src
    }

    if (typeof input === 'string') {
      loadImg(input)
    } else {
      const reader = new FileReader()
      reader.onload = () => loadImg(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(input)
    }
  })
}

export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
