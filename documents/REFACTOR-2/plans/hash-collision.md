# Hash Collision Handling Improvement Plan

## Background

The `POST /api/urls` endpoint generates 6-character short codes by computing MD5 → Base62 of the input URL, then extracting a substring. When two different URLs produce the same short code (hash collision), the system needs a reliable strategy to resolve it.

## Previous Behavior

### How It Worked

1. **Code generation**: `UrlCodeGenerator.md5ToBase62(longUrl)` produces a deterministic Base62 string from the MD5 hash.
2. **Sliding window**: `getCandidate(base62, offset, 6)` extracts a 6-char substring starting at `offset`. The loop tries offsets 0 through 19 (`MAX_COLLISION_ATTEMPTS`).
3. **Check-then-create**: For each candidate, the service called `isShortCodeTaken(candidate)` (a `SELECT` query). If the code was available, it then called `create(candidate, longUrl)` (an `INSERT` query).
4. **Fallback**: When the offset exceeded the Base62 string length, `getCandidate` returned `base62.substring(0, 4) + randomSuffix(2)` — a fixed 4-char prefix plus 2 random characters.

### Flow Diagram (Before)

```
for offset = 0..19:
  candidate = getCandidate(base62, offset, 6)
  SELECT: isShortCodeTaken(candidate)?
    → true  → next offset
    → false → INSERT: create(candidate, longUrl)
                → success → return
                → ConflictException → bubble up as 409 to client
```

### Problems Identified

#### Problem 1: Race Condition (TOCTOU) — High Priority

The `isShortCodeTaken()` check and `create()` insert were not atomic. Under concurrent requests:

```
Thread A: isShortCodeTaken("xyz789") → false
Thread B: isShortCodeTaken("xyz789") → false     ← both pass the check
Thread A: create("xyz789", urlA)     → success
Thread B: create("xyz789", urlB)     → ConflictException → 409 to client
```

The database correctly rejected the duplicate insert, but the service did **not** retry the next offset — it let the `ConflictException` propagate directly to the client as a 409 error.

#### Problem 2: Weak Fallback Randomness — Medium Priority

When offsets exceeded the sliding window range, all fallback candidates shared the same 4-character prefix with only 2 random characters appended (62^2 = 3,844 possibilities). This significantly reduced the candidate space under high collision scenarios.

#### Problem 3: Redundant Database Round-Trips — Low Priority

Each collision attempt performed 2 database queries: one `SELECT` (`isShortCodeTaken`) and one `INSERT` (`create`). This doubled the number of round-trips, adding unnecessary latency — especially when multiple offsets needed to be tried.

## After Modification

### Flow Diagram (After)

```
for offset = 0..19:
  candidate = getCandidate(base62, offset, 6)
  INSERT: create(candidate, longUrl)
    → success          → return
    → ConflictException → next offset (retry)
```

### Improvements

#### Fix 1: Optimistic Insert (Eliminates TOCTOU + Reduces DB Queries)

Removed `isShortCodeTaken()` entirely from the collision loop. The service now directly attempts to `INSERT` the candidate. If the database rejects it with a duplicate key error (`ConflictException`), the loop catches it and moves to the next offset.

**Benefits:**
- Completely eliminates the TOCTOU race condition — there is no gap between check and write
- Reduces database queries from 2 per attempt to 1 per attempt
- Concurrent requests are now safely handled by database-level constraints

#### Fix 2: Fully Random Fallback Codes

Changed the fallback in `getCandidate()` from `base62.substring(0, 4) + randomSuffix(2)` to `randomSuffix(6)` — a fully random 6-character code.

**Benefits:**
- Candidate space increases from 3,844 (62^2) to 56,800,235,584 (62^6)
- No shared prefix means fallback candidates are truly independent
- Dramatically reduces the probability of repeated collisions in the fallback range

### Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| DB queries per attempt | 2 (SELECT + INSERT) | 1 (INSERT only) |
| Race condition handling | Exception propagated to client | Caught and retried |
| Fallback randomness | 4 fixed chars + 2 random (3,844 combos) | 6 fully random chars (56B combos) |
| TOCTOU window | Present between check and insert | Eliminated |

## Files Modified

| File | Description |
|------|-------------|
| `backend/src/url/url.service.ts` | Replaced check-then-create with optimistic insert in collision loop |
| `backend/src/url/url-code-generator.ts` | Changed fallback to fully random code generation |
| `backend/src/url/url.service.spec.ts` | Updated tests for optimistic insert behavior |
| `backend/src/url/url-code-generator.spec.ts` | Updated fallback test expectation |
