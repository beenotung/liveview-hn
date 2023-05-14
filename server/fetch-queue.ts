import debug from 'debug'

let log = debug('hn:fetch-queue')
log.enabled = true
log.enabled = false

let lastTime = 0
let interval = 1000 / 200

async function getText(url: string) {
  // log('getText:', url)
  while (true) {
    let passedTime = Date.now() - lastTime
    if (passedTime >= interval) break
    let waitTime = interval - passedTime
    // log('wait:', { waitTime, url })
    await sleep(waitTime)
  }
  log('downloading:', { url })
  lastTime = Date.now()
  let res = await fetch(url)
  let text = await res.text()
  // log('downloaded:', { url })
  return text
}

let jobs = 0

export let fetchQueue = {
  getText: async (url: string): Promise<string> => {
    for (;;) {
      jobs++
      try {
        let text = await getText(url)
        jobs--
        log('ok', { jobs })
        return text
      } catch (error) {
        jobs--
        log('fail', { jobs })
        console.error('Failed to GET:', url, 'Reason:', error)
        await sleep(500)
      }
    }
  },
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
