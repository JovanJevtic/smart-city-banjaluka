'use client'

import { useState, useEffect, useCallback } from 'react'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  loading: boolean
  error: string | null
}

export function useGeolocation(watch = false) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported' }))
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    const onSuccess = (pos: GeolocationPosition) => {
      setState({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        loading: false,
        error: null,
      })
    }

    const onError = (err: GeolocationPositionError) => {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, opts)
      return () => navigator.geolocation.clearWatch(id)
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, opts)
    }
  }, [watch])

  useEffect(() => {
    const cleanup = requestLocation()
    return cleanup
  }, [requestLocation])

  return { ...state, refresh: requestLocation }
}
