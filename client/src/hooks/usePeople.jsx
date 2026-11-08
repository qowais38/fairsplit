import { createContext, useContext } from 'react'
export const PeopleContext = createContext([])
export const usePeople = () => useContext(PeopleContext)
