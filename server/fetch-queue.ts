import debug from 'debug'

let log = debug('hn:fetch-queue')
log.enabled = true

let lastTime = 0
let interval = 1000 / 200

async function getText(url: string) {
  log('getText:', url)
  while (true) {
    let passedTime = Date.now() - lastTime
    if (passedTime >= interval) break
    let waitTime = interval - passedTime
    log('wait:', { waitTime, url })
    await sleep(waitTime)
  }
  log('download:', { url })
  lastTime = Date.now()
  let res = await fetch(url)
  let text = await res.text()
  return text
}

export let fetchQueue = { getText }

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
