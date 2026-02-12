import { db, eq, and, segmentSpeeds } from '@smart-city/database'
import { createLogger } from '../logger.js'

const logger = createLogger('speed-learner')

// Track when device last passed each stop sequence
const deviceStopTimestamps = new Map<string, Map<number, number>>() // deviceId -> (sequence -> timestamp)

export async function recordSegmentSpeed(
  deviceId: string,
  routeId: string,
  direction: string,
  currentStopSequence: number,
  timestamp: number,
): Promise<void> {
  const key = `${deviceId}:${routeId}:${direction}`
  let timestamps = deviceStopTimestamps.get(key)

  if (!timestamps) {
    timestamps = new Map()
    deviceStopTimestamps.set(key, timestamps)
  }

  const lastSequence = findPreviousRecordedSequence(timestamps, currentStopSequence)

  if (lastSequence !== null) {
    const lastTimestamp = timestamps.get(lastSequence)!
    const timeDiff = (timestamp - lastTimestamp) / 1000 // seconds

    // Sanity check: ignore if too fast (< 5s) or too slow (> 30 min per segment)
    if (timeDiff > 5 && timeDiff < 1800) {
      const hour = new Date(timestamp).getHours()
      const dayOfWeek = new Date(timestamp).getDay()
      const dayType = dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : 'weekday'

      try {
        // Upsert with running average
        const existing = await db.select()
          .from(segmentSpeeds)
          .where(
            and(
              eq(segmentSpeeds.routeId, routeId),
              eq(segmentSpeeds.direction, direction),
              eq(segmentSpeeds.fromStopSequence, lastSequence),
              eq(segmentSpeeds.toStopSequence, currentStopSequence),
              eq(segmentSpeeds.hourOfDay, hour),
              eq(segmentSpeeds.dayType, dayType),
            )
          )
          .limit(1)

        if (existing.length > 0) {
          const record = existing[0]
          const newSampleCount = record.sampleCount + 1
          // We don't have distance here directly, so we approximate from avg speed change
          // The actual speed will be refined as more data comes in
          const newAvg = (record.avgSpeedKmh * record.sampleCount + estimateSpeedFromTime(timeDiff)) / newSampleCount

          await db.update(segmentSpeeds)
            .set({
              avgSpeedKmh: newAvg,
              sampleCount: newSampleCount,
              updatedAt: new Date(),
            })
            .where(eq(segmentSpeeds.id, record.id))
        } else {
          await db.insert(segmentSpeeds).values({
            routeId,
            direction,
            fromStopSequence: lastSequence,
            toStopSequence: currentStopSequence,
            hourOfDay: hour,
            dayType,
            avgSpeedKmh: estimateSpeedFromTime(timeDiff),
            sampleCount: 1,
          })
        }

        logger.debug({
          routeId, direction, fromSeq: lastSequence, toSeq: currentStopSequence,
          timeDiff, hour, dayType,
        }, 'Recorded segment speed')
      } catch (err) {
        logger.warn({ err }, 'Failed to record segment speed')
      }
    }
  }

  // Record current timestamp
  timestamps.set(currentStopSequence, timestamp)

  // Clean old entries (keep last 10 sequences)
  if (timestamps.size > 10) {
    const sorted = [...timestamps.entries()].sort((a, b) => a[1] - b[1])
    for (let i = 0; i < sorted.length - 10; i++) {
      timestamps.delete(sorted[i][0])
    }
  }
}

function findPreviousRecordedSequence(
  timestamps: Map<number, number>,
  currentSequence: number
): number | null {
  // Find the most recent sequence before current
  let bestSeq: number | null = null
  let bestTime = 0

  for (const [seq, time] of timestamps) {
    if (seq < currentSequence && time > bestTime) {
      bestSeq = seq
      bestTime = time
    }
  }

  return bestSeq
}

/** Estimate average speed from travel time between stops (rough: assumes ~500m per segment) */
function estimateSpeedFromTime(timeSec: number): number {
  const assumedDistanceKm = 0.5 // rough average inter-stop distance
  return (assumedDistanceKm / timeSec) * 3600 // km/h
}
