const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

export async function matchesAnyApiKey(
  provided: string | null,
  candidates: ReadonlyArray<string>,
): Promise<boolean> {
  const providedDigest = await digest(provided ?? "");
  let matched = 0;

  for (const candidate of candidates) {
    const candidateDigest = await digest(candidate);
    let difference = 0;
    for (let index = 0; index < candidateDigest.length; index += 1) {
      difference |= candidateDigest[index]! ^ providedDigest[index]!;
    }
    matched |= Number(difference === 0 && Boolean(provided));
  }

  return matched === 1;
}
