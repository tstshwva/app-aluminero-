export function createRateLimit({
  limit,
  windowMs = 60000,
  maxKeys = 10000,
  now = Date.now,
}) {
  const buckets = new Map();
  let cleanupAt = 0;
  return (key) => {
    const time = now();
    if (time >= cleanupAt) {
      for (const [stored, value] of buckets)
        if (value.until <= time) buckets.delete(stored);
      cleanupAt = time + windowMs;
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (!bucket && buckets.size >= maxKeys)
        return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
      bucket = { until: time + windowMs, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count++;
    return {
      allowed: bucket.count <= limit,
      retryAfter: Math.max(1, Math.ceil((bucket.until - time) / 1000)),
    };
  };
}
