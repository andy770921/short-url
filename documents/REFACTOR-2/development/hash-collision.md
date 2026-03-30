# Hash Collision Handling — Implementation Steps

## Step 1: Modify `url-code-generator.ts` — Improve Fallback Randomness

**File**: `backend/src/url/url-code-generator.ts`, line 26

**Before:**
```typescript
getCandidate(base62: string, offset: number, codeLength: number): string {
  if (offset <= base62.length - codeLength) {
    return base62.substring(offset, offset + codeLength);
  }
  return base62.substring(0, codeLength - 2) + this.randomSuffix(2);
}
```

**After:**
```typescript
getCandidate(base62: string, offset: number, codeLength: number): string {
  if (offset <= base62.length - codeLength) {
    return base62.substring(offset, offset + codeLength);
  }
  return this.randomSuffix(codeLength);
}
```

**What changed:** When the offset exceeds the sliding window range, the method now generates a fully random code (`randomSuffix(6)`) instead of reusing a fixed 4-character prefix with only 2 random characters. This expands the fallback candidate space from 3,844 to ~56 billion.

---

## Step 2: Modify `url.service.ts` — Optimistic Insert in Collision Loop

**File**: `backend/src/url/url.service.ts`, lines 119–135 (`createWithGeneratedCode` method)

**Before:**
```typescript
for (let offset = 0; offset < this.maxCollisionAttempts; offset++) {
  const candidate = this.codeGen.getCandidate(base62, offset, this.shortCodeLength);
  const taken = await this.repo.isShortCodeTaken(candidate);

  if (!taken) {
    const record = await this.repo.create(candidate, longUrl);
    return this.buildResponse(candidate, longUrl, record, baseUrl);
  }
}
```

**After:**
```typescript
for (let offset = 0; offset < this.maxCollisionAttempts; offset++) {
  const candidate = this.codeGen.getCandidate(base62, offset, this.shortCodeLength);
  try {
    const record = await this.repo.create(candidate, longUrl);
    return this.buildResponse(candidate, longUrl, record, baseUrl);
  } catch (error) {
    if (error instanceof ConflictException) {
      continue;
    }
    throw error;
  }
}
```

**What changed:**
1. Removed the `isShortCodeTaken()` call — no more pre-check SELECT query.
2. The loop now directly attempts `create()` (INSERT). If the database rejects the insert due to a duplicate key, the `ConflictException` is caught and the loop continues to the next offset.
3. Non-conflict errors (e.g., database connection failures) are re-thrown as before.
4. If all 20 attempts fail, the existing `ConflictException('Unable to generate a unique short code.')` is thrown (unchanged).

---

## Step 3: Update `url-code-generator.spec.ts` — Fallback Test

**File**: `backend/src/url/url-code-generator.spec.ts`, lines 44–50

**Before:**
```typescript
it('should append random suffix when offset is out of bounds', () => {
  const base62 = 'abcd';
  const result = generator.getCandidate(base62, 10, 6);
  expect(result.length).toBe(6);
  // base62.substring(0, 6-2) = 'abcd', + 2 random chars
  expect(result).toMatch(/^abcd[0-9a-zA-Z]{2}$/);
});
```

**After:**
```typescript
it('should return fully random code when offset is out of bounds', () => {
  const base62 = 'abcd';
  const result = generator.getCandidate(base62, 10, 6);
  expect(result.length).toBe(6);
  expect(result).toMatch(/^[0-9a-zA-Z]{6}$/);
});
```

**What changed:** Updated the test name and assertion to reflect that the fallback now returns a fully random 6-character code instead of a fixed-prefix pattern.

---

## Step 4: Update `url.service.spec.ts` — Collision Tests

**File**: `backend/src/url/url.service.spec.ts`, lines 100–120

### Test 4a: Exhausted collision attempts

**Before:**
```typescript
it('should throw ConflictException when all collision attempts are exhausted', async () => {
  mockRepo.isShortCodeTaken.mockResolvedValue(true);

  await expect(
    service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL),
  ).rejects.toThrow(ConflictException);
});
```

**After:**
```typescript
it('should throw ConflictException when all collision attempts are exhausted', async () => {
  mockRepo.create.mockRejectedValue(new ConflictException('duplicate key'));

  await expect(
    service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL),
  ).rejects.toThrow(ConflictException);
});
```

**What changed:** The exhaustion scenario is now triggered by `create()` always throwing `ConflictException` (every INSERT fails) rather than `isShortCodeTaken()` always returning `true`.

### Test 4b: Collision retry

**Before:**
```typescript
it('should retry next offset when create() throws ConflictException (race condition)', async () => {
  mockRepo.isShortCodeTaken.mockResolvedValue(false);
  mockRepo.create
    .mockRejectedValueOnce(new ConflictException('duplicate key'))
    .mockResolvedValueOnce(mockRecord);
  mockCodeGen.getCandidate
    .mockReturnValueOnce('abc123')
    .mockReturnValueOnce('bc123x');

  const result = await service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL);
  expect(result.shortCode).toBe('bc123x');
  expect(mockRepo.create).toHaveBeenCalledTimes(2);
});
```

**After:**
```typescript
it('should retry next offset when create() throws ConflictException (collision)', async () => {
  mockRepo.create
    .mockRejectedValueOnce(new ConflictException('duplicate key'))
    .mockResolvedValueOnce(mockRecord);
  mockCodeGen.getCandidate
    .mockReturnValueOnce('abc123')
    .mockReturnValueOnce('bc123x');

  const result = await service.createShortUrl({ longUrl: 'https://example.com' }, BASE_URL);
  expect(result.shortCode).toBe('bc123x');
  expect(mockRepo.create).toHaveBeenCalledTimes(2);
  expect(mockRepo.isShortCodeTaken).not.toHaveBeenCalled();
});
```

**What changed:**
1. Removed `mockRepo.isShortCodeTaken.mockResolvedValue(false)` — no longer called.
2. Renamed the test from "race condition" to "collision" since this is now the primary collision handling mechanism (not just a race condition edge case).
3. Added assertion `expect(mockRepo.isShortCodeTaken).not.toHaveBeenCalled()` to verify the optimistic approach is in effect.

---

## Verification

All modified test suites pass:

```
PASS src/url/url-code-generator.spec.ts
PASS src/url/url.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       19 passed, 19 total
```
