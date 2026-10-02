import { listRegions } from '../index'
import { createApp } from './app'

// Build the indexes during startup, which has a much larger CPU budget on Workers than a request.
listRegions()

export default createApp()
