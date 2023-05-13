import { then } from '@beenotung/tslib/result.js'
import { fetchCache } from './fetch-cache'

export type StoryDTO = {
  by: string
  descendants: number
  id: number
  kids?: number[]
  score: number
  time: number
  title: string
  type: string
  url?: string
  text: string
  parent?: number
  deleted?: boolean
}

function get<T>(url: string, updateFn: (data: T) => void) {
  let task = fetchCache.fetchUrl<T>(url, updateFn)
  return task.data ? task.data : task.promise
}

export function getStoryById(id: number, updateFn: (story: StoryDTO) => void) {
  let url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  return get(url, updateFn)
}

export function getStoryByIdRecursively(
  id: number,
  updateFn: (story: StoryDTO) => void,
) {
  then(getStoryById(id, updateFn), story => {
    if (!story) return
    walkStory(story, updateFn)
  })
}

function walkStory(story: StoryDTO, updateFn: (story: StoryDTO) => void) {
  if (story.deleted || !story.kids) return
  for (let id of story.kids) {
    getStoryByIdRecursively(id, updateFn)
  }
}
