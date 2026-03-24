import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import type { Annotation } from '../types/annotations'

export function useAnnotations(tabId: string) {
  const { state, dispatch } = useApp()
  const tab = state.tabs.find(t => t.id === tabId)

  const getPage = useCallback(
    (page: number): Annotation[] => tab?.annotations[page] ?? [],
    [tab]
  )

  const add = useCallback(
    (page: number, ann: Annotation) =>
      dispatch({ type: 'ADD_ANNOTATION', payload: { tabId, page, ann } }),
    [dispatch, tabId]
  )

  const undo = useCallback(
    (page: number) =>
      dispatch({ type: 'UNDO_ANNOTATION', payload: { tabId, page } }),
    [dispatch, tabId]
  )

  return { getPage, add, undo, annotations: tab?.annotations ?? {} }
}
