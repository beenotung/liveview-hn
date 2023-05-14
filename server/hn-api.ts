import { then } from '@beenotung/tslib/result.js'
import { fetchCache } from './fetch-cache'

function get<T>(url: string, updateFn: (data: T) => void) {
  let task = fetchCache.fetchUrl<T>(url, updateFn)
  return task.data ? task.data : task.promise
}

type StoryList = number[] | UpdatesDTO
type UpdatesDTO = {
  items: number[]
}

export function getStoryList(
  url: string,
  updateStoryList: (storyList: StoryDTO[]) => void,
  updateStory: (story: StoryDTO) => void,
) {
  return then(
    get<StoryList>(url, data =>
      then(getStoryListFromResult(data, updateStory), storyList => {
        updateStoryList(storyList)
      }),
    ),
    data => getStoryListFromResult(data, updateStory),
  )
}

function getStoryListFromResult(
  data: StoryList | void,
  updateStory: (story: StoryDTO) => void,
) {
  let ids = !data ? [] : Array.isArray(data) ? data : data.items
  return getStoryListFromIds(ids, updateStory)
}

export async function getStoryListFromIds(
  storyIds: number[],
  updateStory: (story: StoryDTO) => void,
) {
  let stories: StoryDTO[] = []
  for (let id of storyIds.slice(0, 30)) {
    let story = await getStoryById(id, story => updateStory(story))
    if (story) {
      stories.push(story)
    }
  }
  return stories
}

export type ProfileDTO = {
  about: string
  created: number
  delay: number
  id: string
  karma: number
  submitted?: number[]
}

export function getProfile(
  id: number,
  updateFn: (profile: ProfileDTO) => void,
) {
  let url = `https://hacker-news.firebaseio.com/v0/user/${id}.json`
  return get(url, updateFn)
}

export function getUserSubmissions(
  id: number,
  updateProfile: (profile: ProfileDTO) => void,
  updateStory: (story: StoryDTO) => void,
) {
  then(getProfile(id, updateProfile), profile => {
    let ids = !profile ? [] : profile.submitted || []
    return getStoryListFromIds(ids, updateStory)
  })
}

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
