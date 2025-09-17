/**
 * Compute a fingerprint for a given buffer.
 */
export default function compute_fingerprint(buffer: Uint8Array): number {
  const HASH_MULTIPLIER = uint32_t(1540483477);
  const BUFFER_LENGTH = uint32_t(buffer.length);

  // Precompute normalized length of the buffer, excluding whitespace characters
  const normalizedLength = uint32_t(countNonWhitespaceCharacters(buffer));

  // Initialize hash variables
  let hashAccumulator = uint32_t(1) ^ normalizedLength;
  let currentWord = uint32_t(0);
  let bitShiftCount = uint32_t(0);

  // Process each byte in the buffer
  for (let index = uint32_t(0); index < BUFFER_LENGTH; index++) {
    // @ts-ignore
    const byte = uint32_t(buffer[index]);

    if (!is_whitespace_character(byte)) {
      // Ignore whitespace characters
      currentWord |= byte << bitShiftCount; // Build 32-bit word by shifting in 8 bits at a time
      bitShiftCount += uint32_t(8);

      // When we've accumulated 32 bits, mix it into the hash
      if (bitShiftCount === uint32_t(32)) {
        const mixedValue = uint32_t(currentWord * HASH_MULTIPLIER);
        const rotatedValue = uint32_t(
          (mixedValue ^ (mixedValue >> uint32_t(24))) * HASH_MULTIPLIER,
        );

        // Update the hash accumulator with the new mixed value
        hashAccumulator = uint32_t(
          (hashAccumulator * HASH_MULTIPLIER) ^ rotatedValue,
        );

        // Reset the temporary variables for the next 32-bit block
        currentWord = uint32_t(0);
        bitShiftCount = uint32_t(0);
      }
    }
  }

  // If there are remaining bits after processing all bytes, incorporate them into the hash
  if (bitShiftCount > 0) {
    hashAccumulator = uint32_t(
      (hashAccumulator ^ currentWord) * HASH_MULTIPLIER,
    );
  }

  // Finalize the hash by mixing and returning the resulting 32-bit integer
  const finalHashValue = uint32_t(
    (hashAccumulator ^ (hashAccumulator >> uint32_t(13))) * HASH_MULTIPLIER,
  );
  return parseInt(
    String(uint32_t(finalHashValue ^ (finalHashValue >> uint32_t(15)))),
  );

  /**
   * Converts a number to a 32-bit unsigned integer (simulates C-style uint32 behavior).
   */
  function uint32_t(num: number | bigint) {
    return BigInt.asUintN(32, BigInt(num));
  }

  /**
   * Counts non-whitespace characters in the buffer.
   */
  function countNonWhitespaceCharacters(buffer: Uint8Array) {
    let count = 0;
    const length = buffer.length;

    for (let index = 0; index < length; index++) {
      if (!is_whitespace_character(buffer[index])) {
        count++;
      }
    }

    return count;
  }

  /**
   * Checks if a byte represents a whitespace character.
   * Whitespace characters considered: tab (9), newline (10), carriage return (13), and space (32).
   */
  function is_whitespace_character(b: number | bigint) {
    return b == 9 || b == 10 || b == 13 || b == 32;
  }
}
